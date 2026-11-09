import { z } from "zod";
import { handler, ok, parseBody, serialize, type RouteCtx } from "@/server/lib/api";
import { requireRole } from "@/server/lib/session";
import { createVariant } from "@/server/services/products";

const i18nSchema = z.record(z.enum(["zh", "en", "ru", "ar"]), z.string().max(60)).nullable().optional();
const schema = z.object({
  i18n: i18nSchema,
  name: z.string().min(1).max(60),
  price: z.union([z.string(), z.number()]).refine((v) => !Number.isNaN(Number(v)) && Number(v) >= 0, "价格无效"),
  sortOrder: z.number().int().optional(),
});

export const POST = handler<RouteCtx<{ id: string }>>(async (req, { params }) => {
  await requireRole("ADMIN");
  const { id } = await params;
  const body = await parseBody(req, schema);
  return ok(serialize(await createVariant(id, body)), { status: 201 });
});
