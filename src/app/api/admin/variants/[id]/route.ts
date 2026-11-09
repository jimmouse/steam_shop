import { z } from "zod";
import { handler, ok, parseBody, serialize, type RouteCtx } from "@/server/lib/api";
import { requireRole } from "@/server/lib/session";
import { deleteVariant, updateVariant } from "@/server/services/products";

const schema = z.object({
  name: z.string().min(1).max(60).optional(),
  price: z.union([z.string(), z.number()]).refine((v) => !Number.isNaN(Number(v)) && Number(v) >= 0, "价格无效").optional(),
  sortOrder: z.number().int().optional(),
  active: z.boolean().optional(),
  i18n: z.record(z.enum(["zh", "en", "ru", "ar"]), z.string().max(60)).nullable().optional(),
});

export const PATCH = handler<RouteCtx<{ id: string }>>(async (req, { params }) => {
  await requireRole("ADMIN");
  const { id } = await params;
  const body = await parseBody(req, schema);
  return ok(serialize(await updateVariant(id, body)));
});

export const DELETE = handler<RouteCtx<{ id: string }>>(async (_req, { params }) => {
  await requireRole("ADMIN");
  const { id } = await params;
  await deleteVariant(id);
  return ok({ deleted: true });
});
