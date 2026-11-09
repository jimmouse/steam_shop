import { createHash, timingSafeEqual } from "node:crypto";
import { AppError } from "./utils";

/**
 * BEpusdt 客户端（https://github.com/v03413/BEpusdt）。
 * 自托管、纯监听（服务器不放私钥）、多链 USDT/USDC/原生币。
 * 文档：docs/api/api.md、docs/trade-type.md
 */

export interface BepusdtConfig {
  gateway: string; // 例如 https://pay.example.com（不带末尾斜杠）
  token: string; // 后台「对接令牌」
}

export function getBepusdtConfig(): BepusdtConfig | null {
  const gateway = (process.env.BEPUSDT_GATEWAY ?? "").replace(/\/+$/, "");
  const token = process.env.BEPUSDT_TOKEN ?? "";
  if (!gateway || !token) return null;
  return { gateway, token };
}

/** 我们认识的交易类型 → 币种 / 网络展示名（与 BEpusdt trade-type.md 对齐） */
export const BEPUSDT_TRADE_TYPES = {
  "usdt.trc20": { currency: "USDT", network: "TRC20" },
  "usdt.bep20": { currency: "USDT", network: "BEP20" },
  "usdt.polygon": { currency: "USDT", network: "Polygon" },
  "usdt.erc20": { currency: "USDT", network: "ERC20" },
  "usdt.arbitrum": { currency: "USDT", network: "Arbitrum" },
  "usdt.solana": { currency: "USDT", network: "Solana" },
  "usdt.ton": { currency: "USDT", network: "TON" },
  "usdt.aptos": { currency: "USDT", network: "Aptos" },
  "usdt.xlayer": { currency: "USDT", network: "X Layer" },
  "usdt.plasma": { currency: "USDT", network: "Plasma" },
  "usdc.trc20": { currency: "USDC", network: "TRC20" },
  "usdc.bep20": { currency: "USDC", network: "BEP20" },
  "usdc.polygon": { currency: "USDC", network: "Polygon" },
  "usdc.erc20": { currency: "USDC", network: "ERC20" },
  "usdc.arbitrum": { currency: "USDC", network: "Arbitrum" },
  "usdc.solana": { currency: "USDC", network: "Solana" },
  "usdc.base": { currency: "USDC", network: "Base" },
  "tron.trx": { currency: "TRX", network: "Tron" },
  "ethereum.eth": { currency: "ETH", network: "Ethereum" },
  "bsc.bnb": { currency: "BNB", network: "BSC" },
  "ton.gram": { currency: "TON", network: "TON" },
} as const;
export type BepusdtTradeType = keyof typeof BEPUSDT_TRADE_TYPES;

const DEFAULT_TRADE_TYPES: BepusdtTradeType[] = [
  "usdt.trc20",
  "usdt.bep20",
  "usdt.polygon",
  "usdt.erc20",
  "usdt.ton",
  "usdt.solana",
  "usdc.trc20",
  "tron.trx",
];

export function isBepusdtTradeType(v: unknown): v is BepusdtTradeType {
  return typeof v === "string" && v in BEPUSDT_TRADE_TYPES;
}

/** 语言中立的展示名，如 "USDT · TRC20" */
export function tradeTypeLabel(type: BepusdtTradeType): string {
  const m = BEPUSDT_TRADE_TYPES[type];
  return `${m.currency} · ${m.network}`;
}

/** 前台可选的交易类型：BEPUSDT_TRADE_TYPES 环境变量（逗号分隔），默认 8 种；每种都需在 BEpusdt 后台配好对应钱包地址 */
export function enabledTradeTypes(): BepusdtTradeType[] {
  const raw = (process.env.BEPUSDT_TRADE_TYPES ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  if (raw.length === 0) return DEFAULT_TRADE_TYPES;
  const seen = new Set<BepusdtTradeType>();
  for (const r of raw) if (isBepusdtTradeType(r)) seen.add(r);
  return [...seen];
}

/**
 * 签名：排除 signature 与空值（null / ""），按 key ASCII 升序拼 k=v&...，末尾直接追加 token，MD5 小写。
 * 数值按 JSON 数字原样参与（BEpusdt 侧用 Go 的 %v 格式化 float64：28.88 → "28.88"，42 → "42"）。
 */
export function bepusdtSign(params: Record<string, unknown>, token: string): string {
  const str = Object.keys(params)
    .filter((k) => k !== "signature" && params[k] !== undefined && params[k] !== null && params[k] !== "")
    .sort()
    .map((k) => `${k}=${formatValue(params[k])}`)
    .join("&");
  return createHash("md5").update(str + token).digest("hex");
}

function formatValue(v: unknown): string {
  if (typeof v === "number") return String(v);
  if (typeof v === "boolean") return v ? "true" : "false";
  return String(v);
}

export function bepusdtVerify(params: Record<string, unknown>, token: string): boolean {
  const given = typeof params.signature === "string" ? params.signature.toLowerCase() : "";
  if (!given) return false;
  const a = Buffer.from(bepusdtSign(params, token));
  const b = Buffer.from(given);
  return a.length === b.length && timingSafeEqual(a, b);
}

export interface BepusdtCreateInput {
  orderId: string; // 我方唯一单号（用 Payment.id）
  tradeType: BepusdtTradeType;
  amount: number; // 法币金额
  fiat: "USD" | "CNY" | "EUR" | "GBP" | "JPY";
  name: string;
  notifyUrl: string;
  redirectUrl: string;
  timeoutSeconds?: number; // 最低 120
}

export interface BepusdtCreateResult {
  tradeId: string;
  tradeType: BepusdtTradeType;
  address: string;
  payCurrency: string;
  network: string;
  fiatAmount: string;
  actualAmount: string; // 用户必须精确支付的加密货币金额
  expiresInSeconds: number;
  paymentUrl: string;
}

/** POST /api/v1/order/create-transaction */
export async function bepusdtCreateTransaction(cfg: BepusdtConfig, input: BepusdtCreateInput): Promise<BepusdtCreateResult> {
  const params: Record<string, unknown> = {
    order_id: input.orderId,
    trade_type: input.tradeType,
    amount: input.amount,
    fiat: input.fiat,
    name: input.name,
    notify_url: input.notifyUrl,
    redirect_url: input.redirectUrl,
  };
  if (input.timeoutSeconds) params.timeout = Math.max(120, Math.floor(input.timeoutSeconds));
  params.signature = bepusdtSign(params, cfg.token);

  const res = await fetch(`${cfg.gateway}/api/v1/order/create-transaction`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
    signal: AbortSignal.timeout(15_000),
  }).catch((e: Error) => {
    throw new AppError(`支付网关不可用：${e.message}`, 502, "GATEWAY_UNAVAILABLE");
  });

  const json = (await res.json().catch(() => null)) as { status_code?: number; message?: string; data?: Record<string, unknown> } | null;
  if (!json || Number(json.status_code) !== 200 || !json.data) {
    throw new AppError(`支付网关返回错误：${json?.message ?? res.status}`, 502, "GATEWAY_ERROR");
  }
  const d = json.data;
  const str = (k: string) => (d[k] === undefined || d[k] === null ? "" : String(d[k]));
  const tradeType = isBepusdtTradeType(d.trade_type) ? d.trade_type : input.tradeType;
  const meta = BEPUSDT_TRADE_TYPES[tradeType];
  return {
    tradeId: str("trade_id"),
    tradeType,
    address: str("token"),
    payCurrency: meta.currency,
    network: meta.network,
    fiatAmount: str("amount"),
    actualAmount: str("actual_amount"),
    expiresInSeconds: Number(d.expiration_time ?? 0),
    paymentUrl: str("payment_url"),
  };
}

/** POST /api/v1/order/cancel-transaction：释放网关侧的金额占用（用户改选其他链 / 我方订单取消时调用，失败可忽略） */
export async function bepusdtCancelTransaction(cfg: BepusdtConfig, tradeId: string): Promise<void> {
  const params: Record<string, unknown> = { trade_id: tradeId };
  params.signature = bepusdtSign(params, cfg.token);
  await fetch(`${cfg.gateway}/api/v1/order/cancel-transaction`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
    signal: AbortSignal.timeout(10_000),
  }).catch(() => undefined);
}

/** 回调 JSON（status: 1 等待 / 2 成功 / 3 超时） */
export interface BepusdtNotifyBody {
  trade_id: string;
  order_id: string;
  amount: number | string;
  actual_amount: number | string;
  token: string;
  block_transaction_id?: string;
  status: number;
  signature: string;
  [k: string]: unknown;
}
