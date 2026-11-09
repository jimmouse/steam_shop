import { z } from "zod";
import { fail, handler, ok, parseBody } from "@/server/lib/api";
import { prisma } from "@/server/lib/prisma";
import { requireUser } from "@/server/lib/session";
import { handleMockCallback, mockSign } from "@/server/services/payments";

const schema = z.object({ paymentId: z.string().min(1), status: z.enum(["success", "failed"]).default("success") });

/**
 * 开发用：让用户在页面上“模拟支付成功”。
 * 内部用密钥签名后走与真实 webhook 相同的处理逻辑。生产环境禁用。
 */
export const POST = handler(async (req) => {
  if (process.env.NODE_ENV === "production") return fail("Not available", 404, "NOT_FOUND");
  const user = await requireUser();
  const { paymentId, status } = await parseBody(req, schema);
  const payment = await prisma.payment.findFirst({
    where: { id: paymentId, provider: "MOCK", order: { userId: user.id } },
  });
  if (!payment?.providerRef) return fail("支付记录不存在", 404, "NOT_FOUND");
  await handleMockCallback({ providerRef: payment.providerRef, status, signature: mockSign(payment.providerRef, status) });
  return ok({ simulated: true });
});
