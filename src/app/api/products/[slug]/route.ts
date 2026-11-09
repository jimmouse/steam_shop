import { fail, handler, ok, type RouteCtx } from "@/server/lib/api";
import { getProductBySlug } from "@/server/services/products";

export const GET = handler<RouteCtx<{ slug: string }>>(async (_req, { params }) => {
  const { slug } = await params;
  const product = await getProductBySlug(slug);
  return product ? ok(product) : fail("商品不存在", 404, "NOT_FOUND");
});
