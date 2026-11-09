function req(name: string, fallback?: string): string {
  const v = process.env[name] ?? fallback;
  if (v === undefined) throw new Error(`Missing env: ${name}`);
  return v;
}

export const env = {
  appUrl: req("APP_URL", "http://localhost:3000"),
  appName: req("APP_NAME", "Steam Store"),
  sessionSecret: req("SESSION_SECRET"),
  adminEmails: (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean),
  adminNotifyEmail: process.env.ADMIN_NOTIFY_EMAIL ?? "",
  /** 接收后台通知的 Telegram chat id 列表（逗号分隔）；在 Bot 里发 /id 可查看自己的 */
  adminTelegramChatIds: (process.env.ADMIN_TELEGRAM_CHAT_IDS ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean),
  smtp: {
    host: process.env.SMTP_HOST ?? "",
    port: Number(process.env.SMTP_PORT ?? 465),
    secure: (process.env.SMTP_SECURE ?? "true") === "true",
    user: process.env.SMTP_USER ?? "",
    pass: process.env.SMTP_PASS ?? "",
    from: process.env.SMTP_FROM ?? "Steam Store <no-reply@example.com>",
  },
  telegramBotToken: process.env.TELEGRAM_BOT_TOKEN ?? "",
  /** Webhook 模式下 Telegram 回传的 X-Telegram-Bot-Api-Secret-Token，留空则不校验 */
  telegramWebhookSecret: process.env.TELEGRAM_WEBHOOK_SECRET ?? "",
  mockPaymentSecret: req("MOCK_PAYMENT_SECRET", "mock-secret"),
  orderExpireMinutes: Number(process.env.ORDER_EXPIRE_MINUTES ?? 15),
};
