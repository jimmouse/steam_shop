import { InventoryStatus, Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { AppError } from "../lib/utils";

export interface ProductInputField {
  key: string;
  label: string;
  required?: boolean;
  placeholder?: string;
}

export function parseInputSchema(json: Prisma.JsonValue | null | undefined): ProductInputField[] {
  if (!Array.isArray(json)) return [];
  return (json as unknown[]).filter(
    (f): f is ProductInputField =>
      typeof f === "object" && f !== null && typeof (f as ProductInputField).key === "string",
  );
}

export interface ProductFaqItem {
  q: string;
  a: string;
}

export function parseFaq(json: Prisma.JsonValue | null | undefined): ProductFaqItem[] {
  if (!Array.isArray(json)) return [];
  return (json as unknown[]).filter(
    (f): f is ProductFaqItem =>
      typeof f === "object" && f !== null && typeof (f as ProductFaqItem).q === "string" && typeof (f as ProductFaqItem).a === "string",
  );
}

export interface ProductTranslation {
  name?: string;
  description?: string | null;
  faq?: ProductFaqItem[];
}
export type ProductI18n = Partial<Record<string, ProductTranslation>>;

/**
 * 按语言取商品展示内容。回退链：目标语言 → en → 主字段（中文）。
 * 只覆盖 name / description / faq，其他字段原样返回。
 */
export function localizeProduct<T extends { name: string; description: string | null; faq: Prisma.JsonValue | null; i18n: Prisma.JsonValue | null }>(
  product: T,
  locale: string,
): Omit<T, "faq"> & { faq: ProductFaqItem[] } {
  const i18n = (product.i18n && typeof product.i18n === "object" && !Array.isArray(product.i18n) ? product.i18n : {}) as ProductI18n;
  const pick = <K extends keyof ProductTranslation>(key: K): ProductTranslation[K] | undefined =>
    i18n[locale]?.[key] ?? (locale !== "zh" ? i18n.en?.[key] : undefined);
  const faq = locale === "zh" ? parseFaq(product.faq) : (pick("faq") as ProductFaqItem[] | undefined) ?? parseFaq(product.faq);
  return {
    ...product,
    name: (locale !== "zh" && pick("name")) || product.name,
    description: locale !== "zh" && pick("description") !== undefined ? (pick("description") ?? null) : product.description,
    faq,
  };
}

function toJsonObj(obj: object | null | undefined) {
  if (obj === null) return Prisma.JsonNull;
  if (obj === undefined) return undefined;
  return obj as Prisma.InputJsonValue;
}

function toJson(fields: unknown[] | null | undefined) {
  if (fields === null) return Prisma.JsonNull;
  if (fields === undefined) return undefined;
  return fields as unknown as Prisma.InputJsonValue;
}

const productListSelect = {
  id: true,
  slug: true,
  type: true,
  deliveryMode: true,
  region: true,
  name: true,
  description: true,
  imageUrl: true,
  faq: true,
  i18n: true,
  price: true,
  currency: true,
  inputSchema: true,
  active: true,
  sortOrder: true,
  variants: {
    select: { id: true, name: true, i18n: true, price: true, active: true, sortOrder: true },
    orderBy: [{ sortOrder: "asc" as const }, { price: "asc" as const }],
  },
} satisfies Prisma.ProductSelect;

export interface VariantView {
  id: string;
  name: string;
  i18n: Prisma.JsonValue | null;
  price: string;
  active: boolean;
  sortOrder: number;
  /** 自动发货商品的该规格可售库存；人工类为 null */
  stock: number | null;
}

type RawProduct = Prisma.ProductGetPayload<{ select: typeof productListSelect }>;

/** 按 (productId, variantId) 统计可售库存 */
async function stockByVariant(productIds: string[]) {
  const rows = await prisma.inventoryItem.groupBy({
    by: ["productId", "variantId"],
    where: { status: InventoryStatus.AVAILABLE, productId: { in: productIds } },
    _count: { _all: true },
  });
  const map = new Map<string, number>();
  for (const r of rows) map.set(`${r.productId}:${r.variantId ?? ""}`, r._count._all);
  return map;
}

function shapeProduct(p: RawProduct, stockMap: Map<string, number>, opts: { includeInactiveVariants?: boolean }) {
  const auto = p.deliveryMode === "AUTO_INVENTORY";
  const variants: VariantView[] = p.variants
    .filter((v) => opts.includeInactiveVariants || v.active)
    .map((v) => ({ ...v, price: v.price.toString(), stock: auto ? (stockMap.get(`${p.id}:${v.id}`) ?? 0) : null }));
  const hasVariants = variants.length > 0;
  // 无规格：库存 = 未绑定规格的库存；有规格：库存 = 各规格之和
  const stock = !auto ? null : hasVariants ? variants.reduce((s, v) => s + (v.stock ?? 0), 0) : (stockMap.get(`${p.id}:`) ?? 0);
  const prices = hasVariants ? variants.map((v) => Number(v.price)) : [Number(p.price)];
  return {
    ...p,
    price: p.price.toString(),
    variants,
    hasVariants,
    minPrice: Math.min(...prices).toFixed(2),
    stock,
  };
}

/** 商品列表，附带可售库存数（人工类商品库存视为无限）。 */
export async function listProducts(opts: { includeInactive?: boolean } = {}) {
  const products = await prisma.product.findMany({
    where: opts.includeInactive ? {} : { active: true },
    select: productListSelect,
    orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
  });
  const stockMap = await stockByVariant(products.map((p) => p.id));
  return products.map((p) => shapeProduct(p, stockMap, { includeInactiveVariants: !!opts.includeInactive }));
}

export async function getProductBySlug(slug: string) {
  const p = await prisma.product.findUnique({ where: { slug }, select: productListSelect });
  if (!p || !p.active) return null;
  const stockMap = await stockByVariant([p.id]);
  return shapeProduct(p, stockMap, {});
}

export async function getProductById(id: string) {
  const p = await prisma.product.findUnique({ where: { id }, select: productListSelect });
  if (!p || !p.active) return null;
  const stockMap = await stockByVariant([p.id]);
  return shapeProduct(p, stockMap, {});
}

// ─────────────────────────── 规格 ───────────────────────────

export type VariantI18n = Partial<Record<string, string>>;

/** 规格显示名：目标语言 → en → 中立 name */
export function localizeVariantName(v: { name: string; i18n: Prisma.JsonValue | null }, locale: string): string {
  const m = (v.i18n && typeof v.i18n === "object" && !Array.isArray(v.i18n) ? v.i18n : {}) as VariantI18n;
  return m[locale] || (locale !== "en" ? m.en : undefined) || v.name;
}

export function localizeVariants<T extends { name: string; i18n: Prisma.JsonValue | null }>(variants: T[], locale: string): (T & { label: string })[] {
  return variants.map((v) => ({ ...v, label: localizeVariantName(v, locale) }));
}

function cleanI18n(i18n: VariantI18n | null | undefined) {
  if (i18n === undefined) return undefined;
  if (i18n === null) return Prisma.JsonNull;
  const entries = Object.entries(i18n).filter(([, v]) => typeof v === "string" && v.trim());
  return entries.length ? (Object.fromEntries(entries.map(([k, v]) => [k, v!.trim()])) as Prisma.InputJsonObject) : Prisma.JsonNull;
}

export async function createVariant(productId: string, input: { name: string; price: string | number; sortOrder?: number; i18n?: VariantI18n | null }) {
  const product = await prisma.product.findUnique({ where: { id: productId } });
  if (!product) throw new AppError("商品不存在", 404);
  return prisma.productVariant.create({
    data: { productId, name: input.name.trim(), price: input.price.toString(), sortOrder: input.sortOrder ?? 0, i18n: cleanI18n(input.i18n) },
  });
}

export async function updateVariant(
  id: string,
  input: { name?: string; price?: string | number; sortOrder?: number; active?: boolean; i18n?: VariantI18n | null },
) {
  return prisma.productVariant.update({
    where: { id },
    data: {
      ...(input.name !== undefined ? { name: input.name.trim() } : {}),
      ...(input.price !== undefined ? { price: input.price.toString() } : {}),
      ...(input.sortOrder !== undefined ? { sortOrder: input.sortOrder } : {}),
      ...(input.active !== undefined ? { active: input.active } : {}),
      ...(input.i18n !== undefined ? { i18n: cleanI18n(input.i18n) } : {}),
    },
  });
}

/** 仅允许删除没有订单、没有库存记录的规格；否则应下架 */
export async function deleteVariant(id: string): Promise<void> {
  const [orders, inventory] = await Promise.all([
    prisma.order.count({ where: { variantId: id } }),
    prisma.inventoryItem.count({ where: { variantId: id } }),
  ]);
  if (orders > 0 || inventory > 0) throw new AppError("该规格已有订单或库存，只能下架不能删除", 409, "VARIANT_IN_USE");
  await prisma.productVariant.delete({ where: { id } });
}

export type ProductUpsertInput = {
  slug: string;
  type: "ACCOUNT" | "TOPUP" | "REGION_CHANGE";
  deliveryMode: "AUTO_INVENTORY" | "MANUAL_TICKET";
  region: string;
  name: string;
  description?: string | null;
  imageUrl?: string | null;
  faq?: ProductFaqItem[] | null;
  i18n?: ProductI18n | null;
  price: string | number;
  currency?: string;
  inputSchema?: ProductInputField[] | null;
  active?: boolean;
  sortOrder?: number;
};

export async function createProduct(input: ProductUpsertInput) {
  const { inputSchema, faq, i18n, price, ...rest } = input;
  return prisma.product.create({
    data: { ...rest, price: price.toString(), inputSchema: toJson(inputSchema), faq: toJson(faq), i18n: toJsonObj(i18n) },
  });
}

export async function updateProduct(id: string, input: Partial<ProductUpsertInput>) {
  const { inputSchema, faq, i18n, price, ...rest } = input;
  return prisma.product.update({
    where: { id },
    data: {
      ...rest,
      ...(price !== undefined ? { price: price.toString() } : {}),
      ...(inputSchema !== undefined ? { inputSchema: toJson(inputSchema) } : {}),
      ...(faq !== undefined ? { faq: toJson(faq) } : {}),
      ...(i18n !== undefined ? { i18n: toJsonObj(i18n) } : {}),
    },
  });
}

/** 批量导入库存，每行一条。有规格的商品必须指定规格。 */
export async function importInventory(productId: string, lines: string[], variantId?: string | null): Promise<number> {
  const product = await prisma.product.findUnique({ where: { id: productId }, include: { variants: { where: { active: true } } } });
  if (!product) throw new AppError("商品不存在", 404);
  if (product.deliveryMode !== "AUTO_INVENTORY") throw new AppError("该商品不是自动发货类型");
  if (product.variants.length > 0) {
    if (!variantId || !product.variants.some((v) => v.id === variantId)) throw new AppError("请选择该商品的规格");
  } else {
    variantId = null;
  }
  const payloads = lines.map((l) => l.trim()).filter(Boolean);
  if (payloads.length === 0) return 0;
  const res = await prisma.inventoryItem.createMany({
    data: payloads.map((payload) => ({ productId, variantId, payload })),
  });
  return res.count;
}

/** 库存汇总，键为 `${productId}:${variantId ?? ""}` */
export async function inventorySummary() {
  const rows = await prisma.inventoryItem.groupBy({ by: ["productId", "variantId", "status"], _count: { _all: true } });
  const map: Record<string, Record<InventoryStatus, number>> = {};
  for (const r of rows) {
    const key = `${r.productId}:${r.variantId ?? ""}`;
    map[key] ??= { AVAILABLE: 0, LOCKED: 0, SOLD: 0 };
    map[key][r.status] = r._count._all;
  }
  return map;
}
