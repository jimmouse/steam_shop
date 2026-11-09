export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { setupProxyFromEnv } = await import("./server/lib/proxy");
    await setupProxyFromEnv();
  }
}
