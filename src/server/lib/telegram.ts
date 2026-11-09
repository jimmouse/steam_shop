import { prisma } from "./prisma";
import { env } from "./env";

/**
 * 轻量 Bot API 客户端：用于从 Next 进程（支付回调、后台操作）主动给用户推送消息。
 * 不依赖 grammY 实例，长轮询与 Webhook 两种部署方式下都能用。
 */

export function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/** Telegram 拒绝 localhost / 内网 IP 的 URL 按钮（BUTTON_URL_INVALID），本地开发时用它决定是否渲染按钮。 */
export function isPublicUrl(url: string | null | undefined): url is string {
  if (!url) return false;
  try {
    const { protocol, hostname } = new URL(url);
    if (protocol !== "http:" && protocol !== "https:") return false;
    if (hostname === "localhost" || hostname.endsWith(".localhost") || hostname.endsWith(".local")) return false;
    if (/^(127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|0\.|169\.254\.)/.test(hostname)) return false;
    if (hostname === "::1" || hostname === "[::1]") return false;
    return hostname.includes(".");
  } catch {
    return false;
  }
}

/**
 * 网页端 Telegram Login Widget 是否可用：需要配置 Bot 用户名，且站点跑在 BotFather /setdomain 能绑定的公网 https 域名上。
 * - "ready"：渲染组件
 * - "hint"：开发环境，渲染一行说明，方便开发者知道为什么没按钮
 * - "hidden"：正式环境但条件不满足，整块入口不渲染（别把配置问题暴露给用户）
 */
export function telegramLoginAvailability(): "ready" | "hint" | "hidden" {
  const ok = !!process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME && isPublicUrl(env.appUrl) && env.appUrl.startsWith("https://");
  if (ok) return "ready";
  return process.env.NODE_ENV === "development" ? "hint" : "hidden";
}

export interface TelegramSendOptions {
  parseMode?: "HTML";
  replyMarkup?: unknown;
  disablePreview?: boolean;
}

export async function sendTelegramMessage(chatId: string | number, text: string, opts: TelegramSendOptions = {}): Promise<boolean> {
  if (!env.telegramBotToken) return false;
  try {
    const res = await fetch(`https://api.telegram.org/bot${env.telegramBotToken}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: opts.parseMode ?? "HTML",
        link_preview_options: { is_disabled: opts.disablePreview ?? true },
        ...(opts.replyMarkup ? { reply_markup: opts.replyMarkup } : {}),
      }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) console.error("[telegram] sendMessage failed:", res.status, await res.text().catch(() => ""));
    return res.ok;
  } catch (err) {
    console.error("[telegram] sendMessage error:", err);
    return false;
  }
}

/** 用户绑定的 Telegram id（即私聊 chat id），未绑定返回 null。 */
export async function getUserTelegramId(userId: string): Promise<string | null> {
  const identity = await prisma.identity.findFirst({
    where: { userId, provider: "TELEGRAM" },
    select: { providerUid: true },
  });
  return identity?.providerUid ?? null;
}

/** 给用户推送 TG 通知（HTML）。未绑定 TG 或未配置 Bot 时静默跳过。 */
export async function notifyTelegramUser(userId: string, html: string, opts: TelegramSendOptions = {}): Promise<void> {
  const chatId = await getUserTelegramId(userId);
  if (!chatId) return;
  await sendTelegramMessage(chatId, html, opts);
}
