import { handler, ok, parseBody, serialize, type RouteCtx } from "@/server/lib/api";
import { productUpsertSchema } from "@/server/lib/schemas";
import { requireRole } from "@/server/lib/session";
import { updateProduct } from "@/server/services/products";

export const PATCH = handler<RouteCtx<{ id: string }>>(async (req, { params }) => {
  await requireRole("ADMIN");
  const { id } = await params;
  const body = await parseBody(req, productUpsertSchema.partial());
  return ok(serialize(await updateProduct(id, body)));
});
