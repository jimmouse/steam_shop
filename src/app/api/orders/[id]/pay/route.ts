import { z } from "zod";
import { handler, ok, parseBody, serialize, type RouteCtx } from "@/server/lib/api";
import { BEPUSDT_TRADE_TYPES, type BepusdtTradeType } from "@/server/lib/bepusdt";
import { requireUser } from "@/server/lib/session";
import { createPayment } from "@/server/services/payments";

const tradeTypes = Object.keys(BEPUSDT_TRADE_TYPES) as [BepusdtTradeType, ...BepusdtTradeType[]];
const schema = z.object({
  provider: z.enum(["MOCK", "BEPUSDT"]),
  payType: z.enum(tradeTypes).optional(),
});

/** 为订单发起支付，返回支付记录与付款指引。 */
export const POST = handler<RouteCtx<{ id: string }>>(async (req, { params }) => {
  const user = await requireUser();
  const { id } = await params;
  const { provider, payType } = await parseBody(req, schema);
  const payment = await createPayment(user.id, id, provider, { payType });

  const instructions =
    provider === "BEPUSDT"
      ? payment.meta
      : { note: "模拟支付：在页面点击“模拟支付成功”即可。" };

  return ok(serialize({ payment, instructions }), { status: 201 });
});
