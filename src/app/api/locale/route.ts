import { cookies } from "next/headers";
import { z } from "zod";
import { LOCALES, LOCALE_COOKIE } from "@/i18n/config";
import { handler, ok, parseBody } from "@/server/lib/api";
import { prisma } from "@/server/lib/prisma";
import { getCurrentUser } from "@/server/lib/session";

const schema = z.object({ locale: z.enum(LOCALES) });

/** 切换界面语言：写 cookie；已登录则同步到用户资料（邮件等通知按此语言发送）。 */
export const POST = handler(async (req) => {
  const { locale } = await parseBody(req, schema);
  const store = await cookies();
  store.set(LOCALE_COOKIE, locale, { path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax" });
  const user = await getCurrentUser();
  if (user && user.locale !== locale) {
    await prisma.user.update({ where: { id: user.id }, data: { locale } });
  }
  return ok({ locale });
});
