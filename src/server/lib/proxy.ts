/**
 * 让 Node 原生 fetch 遵循 HTTP_PROXY / HTTPS_PROXY / NO_PROXY（Node ≤ 22 默认忽略这些变量）。
 * 用于访问 api.telegram.org 等外网；未设置代理变量时不做任何事。
 * Next 进程由 src/instrumentation.ts 调用，Bot 独立进程由 scripts/telegram-bot.ts 调用。
 */
export async function setupProxyFromEnv(): Promise<void> {
  const hasProxy = ["HTTP_PROXY", "HTTPS_PROXY", "http_proxy", "https_proxy"].some((k) => !!process.env[k]);
  if (!hasProxy) return;
  const { EnvHttpProxyAgent, setGlobalDispatcher } = await import("undici");
  setGlobalDispatcher(new EnvHttpProxyAgent());
}
