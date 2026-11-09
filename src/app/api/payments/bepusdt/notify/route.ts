import { handleBepusdtNotify } from "@/server/services/payments";
import type { BepusdtNotifyBody } from "@/server/lib/bepusdt";
import { AppError } from "@/server/lib/utils";

/**
 * BEpusdt 异步通知：POST JSON。
 * 成功必须返回纯文本 "success"，否则网关会按退避策略重试。
 */
export async function POST(req: Request): Promise<Response> {
  const body = (await req.json().catch(() => null)) as BepusdtNotifyBody | null;
  if (!body || typeof body !== "object") return new Response("fail: bad json", { status: 400 });
  try {
    await handleBepusdtNotify(body);
    return new Response("success", { headers: { "Content-Type": "text/plain" } });
  } catch (err) {
    const msg = err instanceof AppError ? err.message : "error";
    if (!(err instanceof AppError)) console.error("[bepusdt notify]", err);
    return new Response(`fail: ${msg}`, { status: err instanceof AppError ? err.status : 500 });
  }
}
