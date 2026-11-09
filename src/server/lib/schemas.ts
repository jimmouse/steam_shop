import { z } from "zod";

export const telegramWidgetSchema = z.object({
  id: z.union([z.number(), z.string()]),
  first_name: z.string().optional(),
  last_name: z.string().optional(),
  username: z.string().optional(),
  photo_url: z.string().optional(),
  auth_date: z.union([z.number(), z.string()]),
  hash: z.string(),
});

export const productInputFieldSchema = z.object({
  key: z.string().min(1).max(40),
  label: z.string().min(1).max(80),
  required: z.boolean().optional(),
  placeholder: z.string().max(120).optional(),
});

export const productUpsertSchema = z.object({
  slug: z.string().min(1).max(80).regex(/^[a-z0-9-]+$/, "只允许小写字母、数字、横线"),
  type: z.enum(["ACCOUNT", "TOPUP", "REGION_CHANGE"]),
  deliveryMode: z.enum(["AUTO_INVENTORY", "MANUAL_TICKET"]),
  region: z.string().min(1).max(20),
  name: z.string().min(1).max(120),
  description: z.string().max(5000).nullable().optional(),
  imageUrl: z.string().max(500).url("图片地址须为完整 URL").nullable().optional().or(z.literal("").transform(() => null)),
  faq: z.array(z.object({ q: z.string().min(1).max(200), a: z.string().min(1).max(2000) })).max(20).nullable().optional(),
  i18n: z
    .record(
      z.enum(["en", "ru", "ar"]),
      z.object({
        name: z.string().min(1).max(120).optional(),
        description: z.string().max(5000).nullable().optional(),
        faq: z.array(z.object({ q: z.string().min(1).max(200), a: z.string().min(1).max(2000) })).max(20).optional(),
      }),
    )
    .nullable()
    .optional(),
  price: z.union([z.string(), z.number()]).refine((v) => !Number.isNaN(Number(v)) && Number(v) >= 0, "价格无效"),
  currency: z.string().length(3).optional(),
  inputSchema: z.array(productInputFieldSchema).nullable().optional(),
  active: z.boolean().optional(),
  sortOrder: z.number().int().optional(),
});
