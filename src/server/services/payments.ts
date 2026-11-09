import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { OrderStatus, PaymentStatus, type PaymentProvider, type Prisma } from "@prisma/client";
import QRCode from "qrcode";
import { prisma } from "../lib/prisma";
import { env } from "../lib/env";
import {
  BEPUSDT_TRADE_TYPES,
  bepusdtCancelTransaction,
  bepusdtCreateTransaction,
  bepusdtVerify,
  enabledTradeTypes,
  getBepusdtConfig,
  isBepusdtTradeType,
  tradeTypeLabel,
  type BepusdtNotifyBody,
  type BepusdtTradeType,
} from "../lib/bepusdt";
import { AppError } from "../lib/utils";
import { expireStaleOrders, fulfillPaidOrder } from "./orders";

export interface CreatePaymentOptions {
  /** 仅 BEPUSDT 使用：交易类型，如 usdt.trc20 */
  payType?: BepusdtTradeType;
}

/** 为订单创建（或复用）一条待支付记录。 */
export async function createPayment(
  userId: string,
  orderId: string,
  provider: PaymentProvider,
  opts: CreatePaymentOptions = {},
) {
  await expireStaleOrders();
  const order = await prisma.order.findFirst({ where: { id: orderId, userId }, include: { product: true } });
  if (!order) throw new AppError("订单不存在", 404);
  if (order.status !== OrderStatus.PENDING) throw new AppError("订单当前不可支付");

  if (provider === "BEPUSDT") return createBepusdtPayment(order, opts.payType);

  // MOCK：仅开发环境
  const existing = await prisma.payment.findFirst({ where: { orderId, provider, status: PaymentStatus.PENDING } });
  if (existing) return existing;

  return prisma.payment.create({
    data: {
      orderId,
      provider,
      providerRef: `mock_${randomBytes(8).toString("hex")}`,
      amount: order.amount,
      currency: order.currency,
    },
  });
}

/** 支付成功的统一入口：幂等地标记支付 + 触发发货。过期后才到账的也接受，交由发货逻辑转人工。 */
async function confirmPayment(paymentId: string, rawCallback?: Prisma.InputJsonValue): Promise<void> {
  const payment = await prisma.payment.findUnique({ where: { id: paymentId } });
  if (!payment) throw new AppError("支付记录不存在", 404);
  if (payment.status === PaymentStatus.CONFIRMED) return;

  const updated = await prisma.payment.updateMany({
    where: { id: paymentId, status: { in: [PaymentStatus.PENDING, PaymentStatus.EXPIRED] } },
    data: {
      status: PaymentStatus.CONFIRMED,
      confirmedAt: new Date(),
      ...(rawCallback !== undefined ? { rawCallback } : {}),
    },
  });
  if (updated.count === 0) return;

  await fulfillPaidOrder(payment.orderId);
}

// ─────────────────────────── BEpusdt（多链 USDT / USDC / 原生币，纯监听） ───────────────────────────

type OrderWithProduct = Prisma.OrderGetPayload<{ include: { product: true } }>;

/** Payment.meta（provider = BEPUSDT） */
export interface GatewayMeta {
  payType: BepusdtTradeType;
  /** 语言中立展示名，如 "USDT · TRC20" */
  label: string;
  payCurrency: string;
  network: string;
  tradeId: string;
  payUrl: string;
  /** data URL 形式的二维码（内容为收款地址），服务端生成 */
  qrcode: string | null;
  address: string;
  /** 订单法币金额（USD） */
  payAmount: string;
  /** 用户必须精确支付的加密货币金额 */
  uniqueAmount: string;
  /** 1 法币 ≈ rate 加密货币（展示用） */
  rate: string | null;
  expiredAt: string | null;
}

export interface GatewayType {
  type: BepusdtTradeType;
  label: string;
  currency: string;
  network: string;
}

/** 前台可选的链上支付方式；网关未配置则为空 */
export function gatewayAvailableTypes(): GatewayType[] {
  if (!getBepusdtConfig()) return [];
  return enabledTradeTypes().map((type) => ({
    type,
    label: tradeTypeLabel(type),
    currency: BEPUSDT_TRADE_TYPES[type].currency,
    network: BEPUSDT_TRADE_TYPES[type].network,
  }));
}

/** 回调地址的基址：生产就是 APP_URL；本地联调时可设 PAYMENT_NOTIFY_BASE_URL=http://host.docker.internal:3000 */
function notifyBaseUrl(): string {
  return (process.env.PAYMENT_NOTIFY_BASE_URL || env.appUrl).replace(/\/+$/, "");
}

async function createBepusdtPayment(order: OrderWithProduct, payType?: BepusdtTradeType) {
  const cfg = getBepusdtConfig();
  if (!cfg) throw new AppError("未配置支付网关", 500, "NOT_CONFIGURED");
  if (!payType || !isBepusdtTradeType(payType) || !enabledTradeTypes().includes(payType)) {
    throw new AppError("请选择支付方式");
  }

  // 同一链复用未过期的待支付记录；换链则作废旧记录并通知网关释放金额占用
  const existing = await prisma.payment.findFirst({
    where: { orderId: order.id, provider: "BEPUSDT", status: PaymentStatus.PENDING },
    orderBy: { createdAt: "desc" },
  });
  if (existing) {
    const meta = existing.meta as GatewayMeta | null;
    if (meta?.payType === payType) return existing;
    await prisma.payment.update({ where: { id: existing.id }, data: { status: PaymentStatus.FAILED } });
    if (meta?.tradeId) void bepusdtCancelTransaction(cfg, meta.tradeId);
  }

  const payment = await prisma.payment.create({
    data: { orderId: order.id, provider: "BEPUSDT", amount: order.amount, currency: order.currency },
  });

  const supported = ["USD", "CNY", "EUR", "GBP", "JPY"] as const;
  const fiat = (supported as readonly string[]).includes(order.currency) ? (order.currency as (typeof supported)[number]) : "USD";
  const remainingSec = Math.floor((order.expiresAt.getTime() - Date.now()) / 1000);

  let result;
  try {
    result = await bepusdtCreateTransaction(cfg, {
      orderId: payment.id,
      tradeType: payType,
      amount: Number(order.amount.toFixed(2)),
      fiat,
      name: `${order.product.name} x${order.quantity}`,
      notifyUrl: `${notifyBaseUrl()}/api/payments/bepusdt/notify`,
      redirectUrl: `${env.appUrl}/orders/${order.id}`,
      // 网关有效期略长于我方订单，覆盖链上确认延迟；过期后到账仍会被接受并转人工/补发
      timeoutSeconds: Math.max(remainingSec + 15 * 60, 120),
    });
  } catch (e) {
    await prisma.payment.update({ where: { id: payment.id }, data: { status: PaymentStatus.FAILED } });
    throw e;
  }

  const qrcode = result.address ? await QRCode.toDataURL(result.address, { margin: 1, width: 352 }).catch(() => null) : null;
  const fiatNum = Number(result.fiatAmount);
  const cryptoNum = Number(result.actualAmount);
  const meta: GatewayMeta = {
    payType: result.tradeType,
    label: tradeTypeLabel(result.tradeType),
    payCurrency: result.payCurrency,
    network: result.network,
    tradeId: result.tradeId,
    payUrl: result.paymentUrl,
    qrcode,
    address: result.address,
    payAmount: result.fiatAmount,
    uniqueAmount: result.actualAmount,
    rate: fiatNum > 0 && cryptoNum > 0 ? (cryptoNum / fiatNum).toFixed(4) : null,
    expiredAt: result.expiresInSeconds > 0 ? new Date(Date.now() + result.expiresInSeconds * 1000).toISOString() : null,
  };
  return prisma.payment.update({
    where: { id: payment.id },
    data: { providerRef: result.tradeId, meta: meta as unknown as Prisma.InputJsonValue },
  });
}

/**
 * BEpusdt 异步通知（POST JSON）。验签 → 定位支付记录 → 按 status 处理。
 * 成功须返回纯文本 "success"，否则网关按退避重试（最多 10 次）。
 */
export async function handleBepusdtNotify(body: BepusdtNotifyBody): Promise<void> {
  const cfg = getBepusdtConfig();
  if (!cfg) throw new AppError("未配置支付网关", 500, "NOT_CONFIGURED");
  if (!bepusdtVerify(body, cfg.token)) throw new AppError("签名错误", 401);

  const payment = await prisma.payment.findFirst({ where: { id: String(body.order_id), provider: "BEPUSDT" } });
  if (!payment) throw new AppError("支付记录不存在", 404);
  if (payment.providerRef && body.trade_id && payment.providerRef !== String(body.trade_id)) {
    throw new AppError("交易号不匹配", 400);
  }

  const status = Number(body.status);
  if (status === 3) {
    await prisma.payment.updateMany({ where: { id: payment.id, status: PaymentStatus.PENDING }, data: { status: PaymentStatus.EXPIRED } });
    return;
  }
  if (status !== 2) return;

  // amount 是我们建单时传的法币金额，必须一致（独占地址模式除外，我们不用）
  if (body.amount !== undefined && Math.abs(Number(body.amount) - Number(payment.amount)) > 0.005) {
    throw new AppError("金额不匹配", 400);
  }
  const txHash = typeof body.block_transaction_id === "string" ? body.block_transaction_id : undefined;
  if (txHash) await prisma.payment.updateMany({ where: { id: payment.id, txHash: null }, data: { txHash } });
  await confirmPayment(payment.id, body as unknown as Prisma.InputJsonValue);
}

/** 用户取消待支付订单时，顺手让网关释放该单的金额占用 */
export async function cancelGatewayPayments(orderId: string): Promise<void> {
  const cfg = getBepusdtConfig();
  const pendings = await prisma.payment.findMany({ where: { orderId, provider: "BEPUSDT", status: PaymentStatus.PENDING } });
  if (pendings.length === 0) return;
  await prisma.payment.updateMany({ where: { id: { in: pendings.map((p) => p.id) } }, data: { status: PaymentStatus.FAILED } });
  if (!cfg) return;
  for (const p of pendings) {
    const tradeId = (p.meta as GatewayMeta | null)?.tradeId;
    if (tradeId) void bepusdtCancelTransaction(cfg, tradeId);
  }
}

// ─────────────────────────── 模拟支付商 ───────────────────────────

export function mockSign(providerRef: string, status: string): string {
  return createHmac("sha256", env.mockPaymentSecret).update(`${providerRef}|${status}`).digest("hex");
}

export interface MockCallbackBody {
  providerRef: string;
  status: "success" | "failed";
  signature: string;
}

/** 模拟支付商的异步回调。真实支付商接入时参照此函数：验签 → 定位支付记录 → confirmPayment。 */
export async function handleMockCallback(body: MockCallbackBody): Promise<void> {
  const expected = mockSign(body.providerRef, body.status);
  const a = Buffer.from(expected);
  const b = Buffer.from(body.signature ?? "");
  if (a.length !== b.length || !timingSafeEqual(a, b)) throw new AppError("签名错误", 401);

  const payment = await prisma.payment.findFirst({ where: { provider: "MOCK", providerRef: body.providerRef } });
  if (!payment) throw new AppError("支付记录不存在", 404);

  if (body.status === "failed") {
    await prisma.payment.updateMany({
      where: { id: payment.id, status: PaymentStatus.PENDING },
      data: { status: PaymentStatus.FAILED, rawCallback: { ...body } },
    });
    return;
  }
  await confirmPayment(payment.id, { ...body });
}

// ─────────────────────────── 后台人工干预 ───────────────────────────

/**
 * 人工确认到账：用户转错金额 / 网络导致网关没匹配上，但你在区块浏览器核实已收到钱时使用。
 * 走统一 confirmPayment → 发货。
 */
export async function adminConfirmPayment(paymentId: string, txHash?: string): Promise<void> {
  const hash = txHash?.trim();
  if (hash) await prisma.payment.updateMany({ where: { id: paymentId }, data: { txHash: hash } });
  await confirmPayment(paymentId, { source: "admin_confirm" });
}

export async function adminRejectPayment(paymentId: string): Promise<void> {
  const payment = await prisma.payment.findUnique({ where: { id: paymentId } });
  if (!payment || payment.status !== PaymentStatus.PENDING) return;
  await prisma.payment.update({ where: { id: paymentId }, data: { status: PaymentStatus.FAILED } });
  const cfg = getBepusdtConfig();
  const tradeId = (payment.meta as GatewayMeta | null)?.tradeId;
  if (cfg && payment.provider === "BEPUSDT" && tradeId) void bepusdtCancelTransaction(cfg, tradeId);
}

export async function listPaymentsForAdmin(status?: PaymentStatus) {
  return prisma.payment.findMany({
    where: status ? { status } : { status: { in: [PaymentStatus.PENDING, PaymentStatus.EXPIRED] } },
    include: { order: { select: { id: true, orderNo: true, status: true, userId: true } } },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
}
