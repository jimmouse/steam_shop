/**
 * Telegram Bot 独立进程入口。
 *
 *   npm run bot                 长轮询（本地开发 / 无公网地址时），会自动清除已设置的 webhook
 *   npm run bot:webhook         把 webhook 指到 ${APP_URL}/api/telegram/webhook 后退出（生产）
 *   npm run bot:webhook -- off  删除 webhook
 *
 * 业务逻辑在 src/server/bot/telegram.ts，与 Next 进程共用同一套 services 与数据库。
 */
process.loadEnvFile?.(".env");

async function main() {
  const { setupProxyFromEnv } = await import("../src/server/lib/proxy");
  await setupProxyFromEnv();
  const { getBot, registerCommands } = await import("../src/server/bot/telegram");
  const { env } = await import("../src/server/lib/env");

  const bot = getBot();
  if (!bot) {
    console.error("TELEGRAM_BOT_TOKEN 未配置");
    process.exit(1);
  }

  const mode = process.argv[2];
  if (mode === "webhook") {
    const url = `${env.appUrl.replace(/\/+$/, "")}/api/telegram/webhook`;
    if (process.argv[3] === "off") {
      await bot.api.deleteWebhook();
      console.log("webhook 已删除");
      return;
    }
    if (!/^https:\/\//.test(url)) {
      console.error(`Telegram 只接受 HTTPS webhook，当前 APP_URL=${env.appUrl}`);
      process.exit(1);
    }
    await bot.api.setWebhook(url, {
      secret_token: env.telegramWebhookSecret || undefined,
      allowed_updates: ["message", "callback_query"],
      drop_pending_updates: false,
    });
    await registerCommands(bot);
    const info = await bot.api.getWebhookInfo();
    console.log(`webhook 已设置：${info.url}${env.telegramWebhookSecret ? "（已启用 secret token）" : ""}`);
    return;
  }

  await bot.init();
  await registerCommands(bot);
  console.log(`@${bot.botInfo.username} 长轮询已启动（Ctrl+C 退出）`);
  const stop = () => {
    console.log("\n停止中…");
    void bot.stop();
  };
  process.once("SIGINT", stop);
  process.once("SIGTERM", stop);
  await bot.start({ allowed_updates: ["message", "callback_query"] });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
