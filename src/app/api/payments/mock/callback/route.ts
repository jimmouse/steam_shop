import { z } from "zod";
import { handler, ok, parseBody } from "@/server/lib/api";
import { handleMockCallback } from "@/server/services/payments";

const schema = z.object({
  providerRef: z.string().min(1),
  status: z.enum(["success", "failed"]),
  signature: z.string().min(1),
});

/** 模拟支付商的服务端回调（webhook）。真实支付商接入时新建类似路由。 */
export const POST = handler(async (req) => {
  const body = await parseBody(req, schema);
  await handleMockCallback(body);
  return ok({ received: true });
});
