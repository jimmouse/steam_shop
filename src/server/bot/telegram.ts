import { Bot, Context, GrammyError, HttpError, InlineKeyboard, type ApiClientOptions } from "grammy";
import { env } from "../lib/env";
import { prisma } from "../lib/prisma";
import { escapeHtml, isPublicUrl } from "../lib/telegram";
import { AppError } from "../lib/utils";
import { ensureTelegramUser, setUserLocale, SUPPORTED_LOCALES, type SupportedLocale } from "../services/auth";
import { cancelOrder, createOrder, getOrderForUser, listOrdersForUser } from "../services/orders";
import { createPayment, gatewayAvailableTypes, handleMockCallback, mockSign, type GatewayMeta } from "../services/payments";
import { isBepusdtTradeType } from "../lib/bepusdt";
import {
  getProductById,
  listProducts,
  localizeProduct,
  localizeVariantName,
  parseInputSchema,
  type ProductInputField,
} from "../services/products";
import { LOCALE_NAMES, statusLabel, t } from "./i18n";

// ─────────────────────────── 上下文与状态 ───────────────────────────

interface BotUser {
  userId: string;
  locale: SupportedLocale;
}
type BotCtx = Context & { user: BotUser };

/** 下单中的多步输入草稿。进程内存即可：单实例部署；丢失只需重新点「购买」。 */
type Draft = {
  kind: "buy";
  productId: string;
  productSlug: string;
  variantId: string | null;
  quantity: number;
  fields: ProductInputField[];
  fieldIndex: number;
  input: Record<string, string>;
};

const drafts = new Map<string, Draft>();
const MOCK_ENABLED = process.env.NODE_ENV !== "production";
const ORDERS_PAGE_SIZE = 10;

// ─────────────────────────── 展示辅助 ───────────────────────────

const INTL_TAG: Record<SupportedLocale, string> = { zh: "zh-CN", en: "en-US", ru: "ru-RU", ar: "ar" };

function money(amount: string | number | { toString(): string }, currency: string): string {
  const n = Number(amount.toString()).toFixed(2);
  return currency === "USD" ? `$${n}` : `${n} ${currency}`;
}

function fmtDate(d: Date, locale: SupportedLocale): string {
  return new Intl.DateTimeFormat(INTL_TAG[locale], { dateStyle: "medium", timeStyle: "short", hour12: false }).format(d);
}

function regionFlag(region: string): string {
  const r = region.toUpperCase();
  if (!/^[A-Z]{2}$/.test(r)) return "🌍";
  return String.fromCodePoint(...[...r].map((c) => 0x1f1e6 + c.charCodeAt(0) - 65));
}

function truncate(s: string, max: number): string {
  return s.length > max ? `${s.slice(0, max - 1)}…` : s;
}

function kv(label: string, value: string): string {
  return `<b>${escapeHtml(label)}:</b> ${value}`;
}

/** 回调里优先原地编辑消息；编辑失败（内容相同 / 消息过旧）则新发一条。 */
async function show(ctx: BotCtx, text: string, keyboard?: InlineKeyboard): Promise<void> {
  const extra = { parse_mode: "HTML" as const, reply_markup: keyboard, link_preview_options: { is_disabled: true } };
  if (ctx.callbackQuery?.message) {
    try {
      await ctx.editMessageText(text, extra);
      return;
    } catch (e) {
      if (e instanceof GrammyError && e.description.includes("message is not modified")) return;
    }
  }
  await ctx.reply(text, extra);
}

function mainMenuKeyboard(l: SupportedLocale): InlineKeyboard {
  const kb = new InlineKeyboard()
    .text(t(l, "menuProducts"), "products")
    .text(t(l, "menuOrders"), "orders")
    .row()
    .text(t(l, "menuLanguage"), "lang");
  if (isPublicUrl(env.appUrl)) kb.url(t(l, "menuWebsite"), env.appUrl);
  return kb;
}

/** 支付页按钮：公网地址给 URL 按钮；本地网关地址只能以文本形式附在消息里 */
function payUrlButton(kb: InlineKeyboard, l: SupportedLocale, url: string | null): string {
  if (!url) return "";
  if (isPublicUrl(url)) {
    kb.url(t(l, "openPayPage"), url).row();
    return "";
  }
  return `\n\n${t(l, "openPayPage")}: ${escapeHtml(url)}`;
}

// ─────────────────────────── 商品 ───────────────────────────

async function showProducts(ctx: BotCtx): Promise<void> {
  const l = ctx.user.locale;
  const products = await listProducts();
  if (products.length === 0) {
    await show(ctx, t(l, "productsEmpty"), new InlineKeyboard().text(t(l, "mainMenu"), "menu"));
    return;
  }
  const kb = new InlineKeyboard();
  for (const p of products) {
    const lp = localizeProduct(p, l);
    const price = p.hasVariants ? `${money(p.minPrice, p.currency)} ${t(l, "from")}` : money(p.price, p.currency);
    const avail = p.stock === null ? "" : p.stock === 0 ? ` · ${t(l, "soldOut")}` : "";
    kb.text(truncate(`${regionFlag(p.region)} ${lp.name} · ${price}${avail}`, 60), `p:${p.id}`).row();
  }
  kb.text(t(l, "mainMenu"), "menu");
  await show(ctx, t(l, "productsTitle"), kb);
}

async function showProduct(ctx: BotCtx, productId: string): Promise<void> {
  const l = ctx.user.locale;
  const p = await getProductById(productId);
  if (!p) {
    await ctx.answerCallbackQuery({ text: t(l, "outOfStock"), show_alert: true });
    return;
  }
  const lp = localizeProduct(p, l);
  const lines = [`${regionFlag(p.region)} <b>${escapeHtml(lp.name)}</b>`];
  if (lp.description) lines.push("", escapeHtml(truncate(lp.description, 900)));
  lines.push("");
  const kb = new InlineKeyboard();
  if (p.hasVariants) {
    lines.push(t(l, "chooseVariant"));
    for (const v of p.variants) {
      const label = localizeVariantName(v, l);
      const stock = v.stock === null ? "" : v.stock === 0 ? ` · ${t(l, "soldOut")}` : ` · ${t(l, "stock", { n: v.stock })}`;
      kb.text(truncate(`${label} · ${money(v.price, p.currency)}${stock}`, 60), `v:${p.id}:${v.id}`).row();
    }
  } else {
    const stock = p.stock === null ? t(l, "manualService") : p.stock === 0 ? t(l, "soldOut") : t(l, "stock", { n: p.stock });
    lines.push(`${kv(t(l, "amount"), `<b>${money(p.price, p.currency)}</b>`)} · ${escapeHtml(stock)}`);
    if (p.stock !== 0) kb.text(t(l, "buy", { price: money(p.price, p.currency) }), `v:${p.id}:-`).row();
  }
  kb.text(t(l, "backToProducts"), "products");
  await show(ctx, lines.join("\n"), kb);
}

// ─────────────────────────── 下单流程 ───────────────────────────

async function startBuy(ctx: BotCtx, productId: string, variantId: string | null): Promise<void> {
  const l = ctx.user.locale;
  const p = await getProductById(productId);
  if (!p) {
    await ctx.answerCallbackQuery({ text: t(l, "outOfStock"), show_alert: true });
    return;
  }
  const variant = variantId ? p.variants.find((v) => v.id === variantId) : null;
  if (variantId && !variant) {
    await ctx.answerCallbackQuery({ text: t(l, "outOfStock"), show_alert: true });
    return;
  }
  const stock = variant ? variant.stock : p.stock;
  if (stock === 0) {
    await ctx.answerCallbackQuery({ text: t(l, "outOfStock"), show_alert: true });
    return;
  }
  const draft: Draft = {
    kind: "buy",
    productId: p.id,
    productSlug: p.slug,
    variantId: variant?.id ?? null,
    quantity: 1,
    fields: parseInputSchema(p.inputSchema),
    fieldIndex: 0,
    input: {},
  };
  drafts.set(ctx.user.userId, draft);
  await ctx.answerCallbackQuery();

  // 自动发货且库存 > 1：让用户选数量；人工类商品固定 1 份
  if (p.deliveryMode === "AUTO_INVENTORY" && stock !== null && stock > 1) {
    const max = Math.min(stock, 20);
    const kb = new InlineKeyboard();
    [1, 2, 3, 5, 10, 20].filter((n) => n <= max).forEach((n) => kb.text(String(n), `q:${n}`));
    kb.row().text(t(l, "cancel"), "x");
    await show(ctx, t(l, "chooseQuantity", { stock }), kb);
    return;
  }
  await nextBuyStep(ctx, draft);
}

async function nextBuyStep(ctx: BotCtx, draft: Extract<Draft, { kind: "buy" }>): Promise<void> {
  const l = ctx.user.locale;
  const field = draft.fields[draft.fieldIndex];
  if (field) {
    const hint = field.required ? "" : `\n${t(l, "inputOptional")}`;
    const placeholder = field.placeholder ? `\n<i>${escapeHtml(field.placeholder)}</i>` : "";
    await ctx.reply(`${t(l, "inputPrompt", { label: escapeHtml(field.label) })}${placeholder}${hint}`, {
      parse_mode: "HTML",
      reply_markup: new InlineKeyboard().text(t(l, "cancel"), "x"),
    });
    return;
  }
  await showConfirm(ctx, draft);
}

async function showConfirm(ctx: BotCtx, draft: Extract<Draft, { kind: "buy" }>): Promise<void> {
  const l = ctx.user.locale;
  const p = await getProductById(draft.productId);
  if (!p) throw new AppError("商品不存在或已下架", 404);
  const lp = localizeProduct(p, l);
  const variant = draft.variantId ? p.variants.find((v) => v.id === draft.variantId) : null;
  const unit = Number(variant ? variant.price : p.price);
  const lines = [
    t(l, "confirmTitle"),
    "",
    kv(t(l, "product"), `${regionFlag(p.region)} ${escapeHtml(lp.name)}`),
    ...(variant ? [kv(t(l, "variant"), escapeHtml(localizeVariantName(variant, l)))] : []),
    kv(t(l, "quantity"), String(draft.quantity)),
    kv(t(l, "amount"), `<b>${money(unit * draft.quantity, p.currency)}</b>`),
  ];
  const filled = Object.entries(draft.input);
  if (filled.length) {
    lines.push("", `<b>${escapeHtml(t(l, "yourInfo"))}</b>`);
    for (const [k, v] of filled) {
      const label = draft.fields.find((f) => f.key === k)?.label ?? k;
      lines.push(`• ${escapeHtml(label)}: <code>${escapeHtml(v)}</code>`);
    }
  }
  const kb = new InlineKeyboard().text(t(l, "confirmOrder"), "ok").text(t(l, "cancel"), "x");
  await ctx.reply(lines.join("\n"), { parse_mode: "HTML", reply_markup: kb });
}

async function confirmOrder(ctx: BotCtx): Promise<void> {
  const l = ctx.user.locale;
  const draft = drafts.get(ctx.user.userId);
  if (!draft || draft.kind !== "buy") {
    await ctx.answerCallbackQuery({ text: t(l, "nothingToCancel") });
    return;
  }
  const order = await createOrder({
    userId: ctx.user.userId,
    productSlug: draft.productSlug,
    quantity: draft.quantity,
    variantId: draft.variantId ?? undefined,
    customerInput: draft.input,
    source: "TELEGRAM",
  });
  drafts.delete(ctx.user.userId);
  await ctx.answerCallbackQuery();
  await show(
    ctx,
    t(l, "orderCreated", { orderNo: order.orderNo, amount: money(order.amount, order.currency), min: env.orderExpireMinutes }),
    paymentKeyboard(l, order.id),
  );
}

// ─────────────────────────── 支付 ───────────────────────────

function paymentKeyboard(l: SupportedLocale, orderId: string): InlineKeyboard {
  const kb = new InlineKeyboard();
  const gateway = gatewayAvailableTypes();
  // 两列排布：USDT · TRC20 | USDT · BEP20 ...
  gateway.forEach((m, i) => {
    kb.text(`💎 ${m.label}`, `pay:${orderId}:BEPUSDT:${m.type}`);
    if (i % 2 === 1 || i === gateway.length - 1) kb.row();
  });
  if (gateway.length === 0 && !MOCK_ENABLED) kb.text(t(l, "noPaymentMethod"), "noop").row();
  if (MOCK_ENABLED) kb.text(t(l, "payMock"), `pay:${orderId}:MOCK:-`).row();
  kb.text(t(l, "checkStatus"), `chk:${orderId}`).text(t(l, "cancelOrder"), `oc:${orderId}`);
  return kb;
}

async function startPayment(ctx: BotCtx, orderId: string, provider: string, payType: string): Promise<void> {
  const l = ctx.user.locale;
  if (!["BEPUSDT", "MOCK"].includes(provider)) throw new AppError("不支持的支付方式");
  if (provider === "MOCK" && !MOCK_ENABLED) throw new AppError("不支持的支付方式");
  const payment = await createPayment(ctx.user.userId, orderId, provider as "BEPUSDT" | "MOCK", {
    payType: isBepusdtTradeType(payType) ? payType : undefined,
  });
  await ctx.answerCallbackQuery();

  const kb = new InlineKeyboard();
  let text: string;
  if (provider === "BEPUSDT") {
    const meta = payment.meta as GatewayMeta | null;
    if (!meta) throw new AppError("支付信息缺失", 500);
    text = t(l, "payGatewayHint", {
      label: escapeHtml(meta.label),
      network: escapeHtml(meta.network),
      amount: escapeHtml(meta.uniqueAmount),
      currency: escapeHtml(meta.payCurrency),
      address: escapeHtml(meta.address),
    });
    text += payUrlButton(kb, l, meta.payUrl);
  } else {
    text = t(l, "payMockHint");
    kb.text(t(l, "mockConfirm"), `mock:${payment.id}`).row();
  }
  kb.text(t(l, "checkStatus"), `chk:${orderId}`).text(t(l, "cancelOrder"), `oc:${orderId}`);
  await show(ctx, text, kb);
}

async function simulateMock(ctx: BotCtx, paymentId: string): Promise<void> {
  if (!MOCK_ENABLED) throw new AppError("不支持的支付方式");
  const payment = await prisma.payment.findFirst({
    where: { id: paymentId, provider: "MOCK", order: { userId: ctx.user.userId } },
  });
  if (!payment?.providerRef) throw new AppError("支付记录不存在", 404);
  await handleMockCallback({ providerRef: payment.providerRef, status: "success", signature: mockSign(payment.providerRef, "success") });
  await ctx.answerCallbackQuery();
  await showOrder(ctx, payment.orderId);
}

// ─────────────────────────── 订单 ───────────────────────────

async function showOrders(ctx: BotCtx): Promise<void> {
  const l = ctx.user.locale;
  const orders = (await listOrdersForUser(ctx.user.userId)).slice(0, ORDERS_PAGE_SIZE);
  if (orders.length === 0) {
    await show(ctx, t(l, "ordersEmpty"), new InlineKeyboard().text(t(l, "menuProducts"), "products").text(t(l, "mainMenu"), "menu"));
    return;
  }
  const kb = new InlineKeyboard();
  for (const o of orders) {
    const name = localizeProduct({ ...o.product, description: null, faq: null }, l).name;
    kb.text(truncate(`${statusLabel(l, o.status)} · ${name} · ${money(o.amount, o.currency)}`, 60), `o:${o.id}`).row();
  }
  kb.text(t(l, "mainMenu"), "menu");
  await show(ctx, t(l, "ordersTitle", { n: orders.length }), kb);
}

async function showOrder(ctx: BotCtx, orderId: string) {
  const l = ctx.user.locale;
  const o = await getOrderForUser(ctx.user.userId, orderId);
  const name = localizeProduct({ ...o.product, description: null, faq: null }, l).name;
  const lines = [
    t(l, "orderTitle", { orderNo: escapeHtml(o.orderNo) }),
    "",
    kv(t(l, "product"), `${regionFlag(o.product.region)} ${escapeHtml(name)}${o.variantName ? ` · ${escapeHtml(o.variantName)}` : ""} × ${o.quantity}`),
    kv(t(l, "amount"), `<b>${money(o.amount, o.currency)}</b>`),
    kv(t(l, "status"), statusLabel(l, o.status)),
    kv(t(l, "createdAt"), fmtDate(o.createdAt, l)),
  ];
  if (o.status === "PENDING") lines.push(kv(t(l, "expiresAt"), fmtDate(o.expiresAt, l)));
  if (o.deliveryPayload) {
    lines.push("", t(l, "deliveryTitle"), `<pre>${escapeHtml(o.deliveryPayload)}</pre>`, `<i>${t(l, "deliveryHint")}</i>`);
  } else if (o.status === "PROCESSING") {
    lines.push("", t(l, "processingHint", { ticketNo: o.tickets[0]?.ticketNo ?? "-" }));
  } else if (o.status === "PAID") {
    lines.push("", t(l, "paidNoStock"));
  }

  let kb: InlineKeyboard;
  if (o.status === "PENDING") {
    kb = paymentKeyboard(l, o.id);
    // 已有待支付的网关单：再给一次直达按钮
    const active = o.payments.find((p) => p.provider === "BEPUSDT" && p.status === "PENDING");
    const url = (active?.meta as GatewayMeta | null)?.payUrl;
    if (isPublicUrl(url)) kb = new InlineKeyboard().url(t(l, "openPayPage"), url).row().append(kb);
  } else {
    kb = new InlineKeyboard();
    if (o.status === "PAID" || o.status === "PROCESSING") kb.text(t(l, "checkStatus"), `chk:${o.id}`).row();
    if (isPublicUrl(env.appUrl)) kb.url(t(l, "viewOnWeb"), `${env.appUrl}/orders/${o.id}`).row();
  }
  kb.row().text(t(l, "menuOrders"), "orders").text(t(l, "mainMenu"), "menu");
  await show(ctx, lines.join("\n"), kb);
  return o;
}

// ─────────────────────────── 文本输入（多步表单） ───────────────────────────

async function handleText(ctx: BotCtx, text: string): Promise<void> {
  const l = ctx.user.locale;
  const draft = drafts.get(ctx.user.userId);
  if (!draft) {
    await ctx.reply(t(l, "unknown"), { reply_markup: mainMenuKeyboard(l) });
    return;
  }
  const field = draft.fields[draft.fieldIndex];
  if (!field) {
    await showConfirm(ctx, draft);
    return;
  }
  const value = text.trim();
  const skip = value === "-" && !field.required;
  if (!value || (value === "-" && field.required)) {
    await ctx.reply(t(l, "inputRequired"));
    return;
  }
  if (!skip) draft.input[field.key] = value;
  draft.fieldIndex += 1;
  await nextBuyStep(ctx, draft);
}

// ─────────────────────────── Bot 装配 ───────────────────────────

function errorMessage(e: unknown): string {
  if (e instanceof AppError) return e.message;
  if (e instanceof GrammyError) return e.description;
  if (e instanceof HttpError) return "Telegram API unreachable";
  console.error("[telegram bot]", e);
  return "Internal error";
}

export function createBot(token: string): Bot<BotCtx> {
  // 用 Node 原生 fetch 而非 grammY 默认的 node-fetch，这样 setupProxyFromEnv() 配置的代理对 Bot API 同样生效
  const bot = new Bot<BotCtx>(token, {
    client: { fetch: globalThis.fetch as unknown as ApiClientOptions["fetch"] },
  });

  // 只服务私聊；解析/创建站内用户并注入 ctx.user
  bot.use(async (ctx, next) => {
    if (ctx.chat?.type !== "private" || !ctx.from || ctx.from.is_bot) return;
    const u = await ensureTelegramUser(ctx.from);
    ctx.user = { userId: u.userId, locale: u.locale };
    try {
      await next();
    } catch (e) {
      const msg = t(ctx.user.locale, "error", { msg: escapeHtml(errorMessage(e)) });
      if (ctx.callbackQuery) await ctx.answerCallbackQuery({ text: msg.replace(/<[^>]+>/g, ""), show_alert: true }).catch(() => {});
      else await ctx.reply(msg, { parse_mode: "HTML" }).catch(() => {});
    }
  });

  bot.command(["start", "menu"], async (ctx) => {
    drafts.delete(ctx.user.userId);
    const l = ctx.user.locale;
    const payload = ctx.match?.trim();
    // 深链 t.me/<bot>?start=p_<productId> 直达商品
    if (payload?.startsWith("p_")) {
      await ctx.reply(t(l, "welcome", { app: escapeHtml(env.appName), min: env.orderExpireMinutes }), { parse_mode: "HTML" });
      await showProduct(ctx, payload.slice(2));
      return;
    }
    await ctx.reply(t(l, "welcome", { app: escapeHtml(env.appName), min: env.orderExpireMinutes }), {
      parse_mode: "HTML",
      reply_markup: mainMenuKeyboard(l),
    });
  });
  bot.command("help", (ctx) => ctx.reply(t(ctx.user.locale, "help")));
  bot.command("products", (ctx) => showProducts(ctx));
  bot.command("orders", (ctx) => showOrders(ctx));
  bot.command("lang", (ctx) => showLanguage(ctx));
  // 给店主用：把返回的 chat id 填到 ADMIN_TELEGRAM_CHAT_IDS 即可接收后台通知
  bot.command("id", (ctx) => ctx.reply(`chat id: <code>${ctx.chat.id}</code>`, { parse_mode: "HTML" }));
  bot.command("cancel", async (ctx) => {
    const had = drafts.delete(ctx.user.userId);
    await ctx.reply(t(ctx.user.locale, had ? "cancelled" : "nothingToCancel"), { reply_markup: mainMenuKeyboard(ctx.user.locale) });
  });

  bot.on("callback_query:data", async (ctx) => {
    const [action, ...rest] = ctx.callbackQuery.data.split(":");
    const l = ctx.user.locale;
    switch (action) {
      case "noop":
        await ctx.answerCallbackQuery();
        return;
      case "menu":
        await ctx.answerCallbackQuery();
        await show(ctx, t(l, "welcome", { app: escapeHtml(env.appName), min: env.orderExpireMinutes }), mainMenuKeyboard(l));
        return;
      case "products":
        await ctx.answerCallbackQuery();
        await showProducts(ctx);
        return;
      case "p":
        await ctx.answerCallbackQuery();
        await showProduct(ctx, rest[0]);
        return;
      case "v":
        await startBuy(ctx, rest[0], rest[1] === "-" ? null : rest[1]);
        return;
      case "q": {
        const draft = drafts.get(ctx.user.userId);
        const n = Number(rest[0]);
        if (!draft || draft.kind !== "buy" || !Number.isInteger(n) || n < 1 || n > 20) {
          await ctx.answerCallbackQuery({ text: t(l, "nothingToCancel") });
          return;
        }
        draft.quantity = n;
        await ctx.answerCallbackQuery();
        await ctx.editMessageReplyMarkup({ reply_markup: undefined }).catch(() => {});
        await nextBuyStep(ctx, draft);
        return;
      }
      case "ok":
        await confirmOrder(ctx);
        return;
      case "x":
        drafts.delete(ctx.user.userId);
        await ctx.answerCallbackQuery({ text: t(l, "cancelled") });
        await ctx.editMessageReplyMarkup({ reply_markup: undefined }).catch(() => {});
        return;
      case "pay":
        await startPayment(ctx, rest[0], rest[1], rest[2]);
        return;
      case "mock":
        await simulateMock(ctx, rest[0]);
        return;
      case "chk": {
        const o = await showOrder(ctx, rest[0]);
        await ctx.answerCallbackQuery(o.status === "PENDING" ? { text: t(l, "stillPending") } : undefined);
        return;
      }
      case "oc":
        await cancelOrder(ctx.user.userId, rest[0]);
        drafts.delete(ctx.user.userId);
        await ctx.answerCallbackQuery({ text: t(l, "orderCancelled") });
        await showOrder(ctx, rest[0]);
        return;
      case "o":
        await ctx.answerCallbackQuery();
        await showOrder(ctx, rest[0]);
        return;
      case "orders":
        await ctx.answerCallbackQuery();
        await showOrders(ctx);
        return;
      case "lang":
        if (!rest[0]) {
          await ctx.answerCallbackQuery();
          await showLanguage(ctx);
          return;
        }
        if ((SUPPORTED_LOCALES as readonly string[]).includes(rest[0])) {
          const locale = rest[0] as SupportedLocale;
          await setUserLocale(ctx.user.userId, locale);
          ctx.user.locale = locale;
          await ctx.answerCallbackQuery({ text: t(locale, "languageChanged") });
          await show(ctx, t(locale, "welcome", { app: escapeHtml(env.appName), min: env.orderExpireMinutes }), mainMenuKeyboard(locale));
        }
        return;
      default:
        await ctx.answerCallbackQuery();
    }
  });

  bot.on("message:text", (ctx) => handleText(ctx, ctx.message.text));

  bot.catch((err) => console.error("[telegram bot] unhandled:", err.error));
  return bot;
}

async function showLanguage(ctx: BotCtx): Promise<void> {
  const kb = new InlineKeyboard();
  SUPPORTED_LOCALES.forEach((code, i) => {
    kb.text(`${code === ctx.user.locale ? "✓ " : ""}${LOCALE_NAMES[code]}`, `lang:${code}`);
    if (i % 2 === 1) kb.row();
  });
  await show(ctx, t(ctx.user.locale, "chooseLanguage"), kb);
}

/** 注册 Bot 命令菜单（按语言分别设置） */
export async function registerCommands(bot: Bot<BotCtx>): Promise<void> {
  const defs: Record<SupportedLocale, [string, string][]> = {
    zh: [["start", "主菜单"], ["products", "商品列表"], ["orders", "我的订单"], ["lang", "切换语言"], ["cancel", "取消当前操作"]],
    en: [["start", "Main menu"], ["products", "Products"], ["orders", "My orders"], ["lang", "Language"], ["cancel", "Cancel current action"]],
    ru: [["start", "Главное меню"], ["products", "Товары"], ["orders", "Мои заказы"], ["lang", "Язык"], ["cancel", "Отменить"]],
    ar: [["start", "القائمة الرئيسية"], ["products", "المنتجات"], ["orders", "طلباتي"], ["lang", "اللغة"], ["cancel", "إلغاء"]],
  };
  const toCmds = (l: SupportedLocale) => defs[l].map(([command, description]) => ({ command, description }));
  await bot.api.setMyCommands(toCmds("en"));
  for (const l of SUPPORTED_LOCALES) await bot.api.setMyCommands(toCmds(l), { language_code: l });
}

// 单例：Next dev 热重载时复用，避免重复创建
const g = globalThis as unknown as { __tgBot?: Bot<BotCtx> };

export function getBot(): Bot<BotCtx> | null {
  if (!env.telegramBotToken) return null;
  if (!g.__tgBot) g.__tgBot = createBot(env.telegramBotToken);
  return g.__tgBot;
}

export type { BotCtx };
