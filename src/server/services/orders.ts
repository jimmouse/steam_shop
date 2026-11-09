import { InventoryStatus, OrderStatus, type OrderSource, type Prisma, type PrismaClient } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { env } from "../lib/env";
import { sendMail } from "../lib/mail";
import { notifyAdmin } from "../lib/notify";
import { escapeHtml, notifyTelegramUser } from "../lib/telegram";
import { AppError, generateOrderNo, generateTicketNo } from "../lib/utils";
import { parseInputSchema } from "./products";
import { t } from "../bot/i18n";
import type { SupportedLocale } from "./auth";

type Tx = Prisma.TransactionClient | PrismaClient;

export async function getUserEmail(userId: string, tx: Tx = prisma): Promise<string | null> {
  const identity = await tx.identity.findFirst({
    where: { userId, provider: "EMAIL" },
    select: { providerUid: true },
  });
  return identity?.providerUid ?? null;
}

async function getUserLocale(userId: string): Promise<SupportedLocale> {
  const u = await prisma.user.findUnique({ where: { id: userId }, select: { locale: true } });
  return (["zh", "en", "ru", "ar"].includes(u?.locale ?? "") ? u!.locale : "en") as SupportedLocale;
}

function orderButton(label: string, orderId: string) {
  return { inline_keyboard: [[{ text: label, callback_data: `o:${orderId}` }]] };
}

// ─────────────────────────── 过期释放 ───────────────────────────

/** 释放超时未支付订单锁定的库存。无 Redis/cron，由下单与查询时顺带调用。 */
export async function expireStaleOrders(): Promise<number> {
  const stale = await prisma.order.findMany({
    where: { status: OrderStatus.PENDING, expiresAt: { lt: new Date() } },
    select: { id: true },
  });
  if (stale.length === 0) return 0;
  const ids = stale.map((o) => o.id);
  await prisma.$transaction([
    prisma.inventoryItem.updateMany({
      where: { orderId: { in: ids }, status: InventoryStatus.LOCKED },
      data: { status: InventoryStatus.AVAILABLE, orderId: null, lockedUntil: null },
    }),
    prisma.payment.updateMany({
      where: { orderId: { in: ids }, status: { in: ["PENDING"] } },
      data: { status: "EXPIRED" },
    }),
    prisma.order.updateMany({
      where: { id: { in: ids }, status: OrderStatus.PENDING },
      data: { status: OrderStatus.EXPIRED },
    }),
  ]);
  return ids.length;
}

// ─────────────────────────── 创建订单 ───────────────────────────

export interface CreateOrderInput {
  userId: string;
  productSlug: string;
  quantity?: number;
  variantId?: string;
  customerInput?: Record<string, string>;
  source?: OrderSource;
}

export async function createOrder(input: CreateOrderInput) {
  await expireStaleOrders();

  const product = await prisma.product.findUnique({
    where: { slug: input.productSlug },
    include: { variants: { where: { active: true } } },
  });
  if (!product || !product.active) throw new AppError("商品不存在或已下架", 404);

  // 有规格的商品必须选规格，价格以规格为准
  let variant: (typeof product.variants)[number] | null = null;
  if (product.variants.length > 0) {
    variant = product.variants.find((v) => v.id === input.variantId) ?? null;
    if (!variant) throw new AppError("请选择规格");
  }
  const unitPrice = variant ? variant.price : product.price;

  const quantity = Math.max(1, Math.floor(input.quantity ?? 1));
  if (product.deliveryMode === "MANUAL_TICKET" && quantity !== 1) throw new AppError("该商品每次只能购买 1 份");
  if (quantity > 20) throw new AppError("单次最多购买 20 份");

  const fields = parseInputSchema(product.inputSchema);
  const customerInput: Record<string, string> = {};
  for (const f of fields) {
    const v = input.customerInput?.[f.key]?.trim() ?? "";
    if (f.required && !v) throw new AppError(`请填写：${f.label}`);
    if (v) customerInput[f.key] = v;
  }

  const expiresAt = new Date(Date.now() + env.orderExpireMinutes * 60 * 1000);
  const amount = unitPrice.mul(quantity);

  return prisma.$transaction(async (tx) => {
    const order = await tx.order.create({
      data: {
        orderNo: generateOrderNo(),
        userId: input.userId,
        productId: product.id,
        variantId: variant?.id,
        variantName: variant?.name,
        quantity,
        unitPrice,
        amount,
        currency: product.currency,
        source: input.source ?? "WEB",
        customerInput: Object.keys(customerInput).length ? customerInput : undefined,
        expiresAt,
      },
    });

    if (product.deliveryMode === "AUTO_INVENTORY") {
      const candidates = await tx.inventoryItem.findMany({
        where: { productId: product.id, variantId: variant?.id ?? null, status: InventoryStatus.AVAILABLE },
        select: { id: true },
        take: quantity,
        orderBy: { createdAt: "asc" },
      });
      if (candidates.length < quantity) throw new AppError("库存不足", 409, "OUT_OF_STOCK");
      // 带状态条件的 updateMany 保证并发下不会重复锁定同一条库存
      const locked = await tx.inventoryItem.updateMany({
        where: { id: { in: candidates.map((c) => c.id) }, status: InventoryStatus.AVAILABLE },
        data: { status: InventoryStatus.LOCKED, orderId: order.id, lockedUntil: expiresAt },
      });
      if (locked.count < quantity) throw new AppError("库存不足，请重试", 409, "OUT_OF_STOCK");
    }

    return order;
  });
}

// ─────────────────────────── 查询 ───────────────────────────

const orderInclude = {
  product: { select: { name: true, slug: true, type: true, region: true, deliveryMode: true, i18n: true } },
  variant: { select: { name: true, i18n: true } },
  payments: { orderBy: { createdAt: "desc" as const } },
  tickets: { select: { id: true, ticketNo: true, type: true, status: true } },
} satisfies Prisma.OrderInclude;

export async function listOrdersForUser(userId: string) {
  await expireStaleOrders();
  return prisma.order.findMany({ where: { userId }, include: orderInclude, orderBy: { createdAt: "desc" } });
}

export async function getOrderForUser(userId: string, orderId: string) {
  await expireStaleOrders();
  const order = await prisma.order.findFirst({ where: { id: orderId, userId }, include: orderInclude });
  if (!order) throw new AppError("订单不存在", 404);
  return order;
}

export async function listAllOrders(opts: { status?: OrderStatus; take?: number } = {}) {
  await expireStaleOrders();
  return prisma.order.findMany({
    where: opts.status ? { status: opts.status } : {},
    include: { ...orderInclude, user: { select: { id: true, identities: { select: { provider: true, providerUid: true, displayName: true } } } } },
    orderBy: { createdAt: "desc" },
    take: opts.take ?? 100,
  });
}

export async function cancelOrder(userId: string, orderId: string): Promise<void> {
  const order = await prisma.order.findFirst({ where: { id: orderId, userId } });
  if (!order) throw new AppError("订单不存在", 404);
  if (order.status !== OrderStatus.PENDING) throw new AppError("只有待支付订单可以取消");
  // 先让网关释放金额占用（会把 PENDING 网关单标记 FAILED），再回滚库存
  const { cancelGatewayPayments } = await import("./payments");
  await cancelGatewayPayments(orderId);
  await prisma.$transaction([
    prisma.inventoryItem.updateMany({
      where: { orderId, status: InventoryStatus.LOCKED },
      data: { status: InventoryStatus.AVAILABLE, orderId: null, lockedUntil: null },
    }),
    prisma.payment.updateMany({ where: { orderId, status: "PENDING" }, data: { status: "FAILED" } }),
    prisma.order.update({ where: { id: orderId }, data: { status: OrderStatus.CANCELLED } }),
  ]);
}

// ─────────────────────────── 支付成功 → 发货 ───────────────────────────

/**
 * 支付确认后的发货入口。幂等：已处理过的订单直接返回。
 * - AUTO_INVENTORY：取出锁定库存，直接交付
 * - MANUAL_TICKET：开工单，进入人工处理
 */
export async function fulfillPaidOrder(orderId: string): Promise<void> {
  const result = await prisma.$transaction(async (tx) => {
    const order = await tx.order.findUniqueOrThrow({ where: { id: orderId }, include: { product: true } });
    // EXPIRED：订单超时后钱才到账（网关侧有效期比我方长），同样要发货或转人工，不能吞款
    if (!([OrderStatus.PENDING, OrderStatus.PAID, OrderStatus.EXPIRED] as OrderStatus[]).includes(order.status)) return null;

    const now = new Date();

    if (order.product.deliveryMode === "AUTO_INVENTORY") {
      let items = await tx.inventoryItem.findMany({
        where: { orderId, status: InventoryStatus.LOCKED },
        orderBy: { createdAt: "asc" },
      });
      if (items.length < order.quantity) {
        // 锁定已被释放：尝试从可售库存里重新补齐
        const need = order.quantity - items.length;
        const refill = await tx.inventoryItem.findMany({
          where: { productId: order.productId, variantId: order.variantId ?? null, status: InventoryStatus.AVAILABLE },
          select: { id: true },
          take: need,
          orderBy: { createdAt: "asc" },
        });
        if (refill.length === need) {
          const locked = await tx.inventoryItem.updateMany({
            where: { id: { in: refill.map((r) => r.id) }, status: InventoryStatus.AVAILABLE },
            data: { status: InventoryStatus.LOCKED, orderId },
          });
          if (locked.count === need) {
            items = await tx.inventoryItem.findMany({
              where: { orderId, status: InventoryStatus.LOCKED },
              orderBy: { createdAt: "asc" },
            });
          }
        }
      }
      if (items.length < order.quantity) {
        // 库存确实没了——标记已付待人工处理，不吞用户的钱
        await tx.order.update({ where: { id: orderId }, data: { status: OrderStatus.PAID, paidAt: now } });
        return { kind: "STOCK_MISSING" as const, order };
      }
      await tx.inventoryItem.updateMany({
        where: { id: { in: items.map((i) => i.id) } },
        data: { status: InventoryStatus.SOLD, soldAt: now, lockedUntil: null },
      });
      const payload = items.map((i) => i.payload).join("\n");
      await tx.order.update({
        where: { id: orderId },
        data: { status: OrderStatus.DELIVERED, paidAt: now, deliveredAt: now, deliveryPayload: payload },
      });
      return { kind: "DELIVERED" as const, order, payload };
    }

    const ticketType = order.product.type === "REGION_CHANGE" ? "REGION_CHANGE" : "TOPUP";
    const inputText = formatCustomerInput(order.customerInput);
    const ticket = await tx.ticket.create({
      data: {
        ticketNo: generateTicketNo(),
        userId: order.userId,
        orderId,
        type: ticketType,
        subject: `${order.product.name} · ${order.orderNo}`,
        messages: {
          create: {
            isStaff: false,
            body: `订单已支付，等待处理。\n\n用户提交信息：\n${inputText || "（无）"}`,
          },
        },
      },
    });
    await tx.order.update({ where: { id: orderId }, data: { status: OrderStatus.PROCESSING, paidAt: now } });
    return { kind: "TICKET" as const, order, ticket };
  });

  if (!result) return;
  const email = await getUserEmail(result.order.userId);
  const locale = await getUserLocale(result.order.userId);
  const { orderNo, id: oid, userId } = result.order;
  const summary = `${result.order.product.name}${result.order.variantName ? ` / ${result.order.variantName}` : ""} x${result.order.quantity} · ${result.order.amount} ${result.order.currency}\n用户：${email ?? userId}`;

  if (result.kind === "DELIVERED") {
    await notifyAdmin({ title: `💰 新订单已付款并自动发货 ${orderNo}`, text: summary, path: `/admin/orders`, action: "查看订单 →" });
    if (email) {
      await sendMail({
        to: email,
        subject: `订单 ${result.order.orderNo} 已发货`,
        text: `您的订单已完成，发货内容：\n\n${result.payload}\n\n请尽快修改密码与绑定邮箱。订单详情：${env.appUrl}/orders/${result.order.id}`,
      });
    }
    await notifyTelegramUser(
      userId,
      `${t(locale, "notifyDelivered", { orderNo: escapeHtml(orderNo) })}\n\n${t(locale, "deliveryTitle")}\n<pre>${escapeHtml(result.payload)}</pre>\n<i>${t(locale, "deliveryHint")}</i>`,
      { replyMarkup: orderButton(t(locale, "viewOrder"), oid) },
    );
    return;
  }
  if (result.kind === "TICKET") {
    await notifyAdmin({
      title: `💰 新订单已付款，需人工处理 ${orderNo}`,
      text: `${summary}\n工单 ${result.ticket.ticketNo}（${result.ticket.type}）`,
      path: `/admin/tickets/${result.ticket.id}`,
    });
    if (email) {
      await sendMail({
        to: email,
        subject: `订单 ${result.order.orderNo} 已支付，处理中`,
        text: `我们已收到付款，正在处理，进度可在工单中查看：${env.appUrl}/tickets/${result.ticket.id}`,
      });
    }
    await notifyTelegramUser(userId, t(locale, "notifyProcessing", { orderNo: escapeHtml(orderNo) }), {
      replyMarkup: orderButton(t(locale, "viewOrder"), oid),
    });
    return;
  }
  await notifyAdmin({
    title: `⚠️ 订单已付款但库存缺失，需补发 ${orderNo}`,
    text: summary,
    path: `/admin/orders?status=PAID`,
    action: "去补发 →",
  });
  await notifyTelegramUser(userId, `${t(locale, "notifyProcessing", { orderNo: escapeHtml(orderNo) })}\n${t(locale, "paidNoStock")}`, {
    replyMarkup: orderButton(t(locale, "viewOrder"), oid),
  });
}

/** 后台人工完成订单（代充/改区做完，或补发账号）。 */
export async function adminCompleteOrder(orderId: string, deliveryPayload?: string): Promise<void> {
  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order) throw new AppError("订单不存在", 404);
  if (!["PAID", "PROCESSING"].includes(order.status)) throw new AppError("当前状态不可完成");
  const now = new Date();
  await prisma.$transaction([
    prisma.order.update({
      where: { id: orderId },
      data: { status: OrderStatus.DELIVERED, deliveredAt: now, ...(deliveryPayload ? { deliveryPayload } : {}) },
    }),
    prisma.ticket.updateMany({
      where: { orderId, status: { notIn: ["CLOSED", "RESOLVED"] } },
      data: { status: "RESOLVED" },
    }),
  ]);
  const email = await getUserEmail(order.userId);
  if (email) {
    await sendMail({
      to: email,
      subject: `订单 ${order.orderNo} 已完成`,
      text: `您的订单已处理完成。${deliveryPayload ? `\n\n${deliveryPayload}\n` : ""}\n订单详情：${env.appUrl}/orders/${order.id}`,
    });
  }
  const locale = await getUserLocale(order.userId);
  await notifyTelegramUser(
    order.userId,
    `${t(locale, "notifyCompleted", { orderNo: escapeHtml(order.orderNo) })}${deliveryPayload ? `\n\n<pre>${escapeHtml(deliveryPayload)}</pre>` : ""}`,
    { replyMarkup: orderButton(t(locale, "viewOrder"), order.id) },
  );
}

export async function adminRefundOrder(orderId: string): Promise<void> {
  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order) throw new AppError("订单不存在", 404);
  if (!["PAID", "PROCESSING", "DELIVERED"].includes(order.status)) throw new AppError("当前状态不可退款");
  await prisma.$transaction([
    prisma.order.update({ where: { id: orderId }, data: { status: OrderStatus.REFUNDED } }),
    prisma.ticket.updateMany({ where: { orderId, status: { notIn: ["CLOSED"] } }, data: { status: "CLOSED" } }),
  ]);
}

export function formatCustomerInput(json: Prisma.JsonValue | null): string {
  if (!json || typeof json !== "object" || Array.isArray(json)) return "";
  return Object.entries(json)
    .map(([k, v]) => `${k}: ${String(v)}`)
    .join("\n");
}
