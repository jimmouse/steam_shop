import { webhookCallback } from "grammy";
import { getBot } from "@/server/bot/telegram";
import { env } from "@/server/lib/env";

/**
 * Telegram Webhook 入口（生产）。用 `npm run bot:webhook` 注册地址。
 * 本地开发无需公网地址，改用 `npm run bot`（长轮询）。
 */
export async function POST(req: Request) {
  const bot = getBot();
  if (!bot) return new Response("Telegram bot not configured", { status: 404 });
  const handle = webhookCallback(bot, "std/http", {
    secretToken: env.telegramWebhookSecret || undefined,
    timeoutMilliseconds: 25_000,
  });
  return handle(req);
}
