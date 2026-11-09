import { cookies } from "next/headers";
import { z } from "zod";
import { CURRENCIES, CURRENCY_COOKIE } from "@/lib/currency";
import { handler, ok, parseBody } from "@/server/lib/api";

const schema = z.object({ currency: z.enum(CURRENCIES) });

/** 切换展示货币（仅影响显示，结算始终为 USD） */
export const POST = handler(async (req) => {
  const { currency } = await parseBody(req, schema);
  const store = await cookies();
  store.set(CURRENCY_COOKIE, currency, { path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax" });
  return ok({ currency });
});
