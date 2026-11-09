import { z } from "zod";
import { handler, ok, parseBody, type RouteCtx } from "@/server/lib/api";
import { requireRole } from "@/server/lib/session";
import { adminConfirmPayment } from "@/server/services/payments";

const schema = z.object({ txHash: z.string().trim().max(128).optional().or(z.literal("")) });

/** 人工确认到账（网关没匹配上但链上已核实收到钱时使用），可附交易哈希。 */
export const POST = handler<RouteCtx<{ id: string }>>(async (req, { params }) => {
  await requireRole("ADMIN");
  const { id } = await params;
  const { txHash } = await parseBody(req, schema).catch(() => ({ txHash: undefined }));
  await adminConfirmPayment(id, txHash || undefined);
  return ok({ confirmed: true });
});