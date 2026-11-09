import { PaymentStatus } from "@prisma/client";
import { handler, ok, serialize } from "@/server/lib/api";
import { requireRole } from "@/server/lib/session";
import { listPaymentsForAdmin } from "@/server/services/payments";

export const GET = handler(async (req) => {
  await requireRole("ADMIN");
  const status = new URL(req.url).searchParams.get("status");
  const valid = status && (Object.values(PaymentStatus) as string[]).includes(status) ? (status as PaymentStatus) : undefined;
  return ok(serialize(await listPaymentsForAdmin(valid)));
});
