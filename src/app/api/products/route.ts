import { handler, ok } from "@/server/lib/api";
import { listProducts } from "@/server/services/products";

export const GET = handler(async () => ok(await listProducts()));
