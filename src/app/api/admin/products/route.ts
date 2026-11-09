import { handler, ok, parseBody, serialize } from "@/server/lib/api";
import { productUpsertSchema } from "@/server/lib/schemas";
import { requireRole } from "@/server/lib/session";
import { createProduct, listProducts } from "@/server/services/products";

export const GET = handler(async () => {
  await requireRole("ADMIN");
  return ok(serialize(await listProducts({ includeInactive: true })));
});

export const POST = handler(async (req) => {
  await requireRole("ADMIN");
  const body = await parseBody(req, productUpsertSchema);
  return ok(serialize(await createProduct(body)), { status: 201 });
});
