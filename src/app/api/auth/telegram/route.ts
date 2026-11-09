import { handler, ok, parseBody } from "@/server/lib/api";
import { telegramWidgetSchema } from "@/server/lib/schemas";
import { createSession } from "@/server/lib/session";
import { loginWithTelegram } from "@/server/services/auth";

export const POST = handler(async (req) => {
  const data = await parseBody(req, telegramWidgetSchema);
  const userId = await loginWithTelegram(data);
  await createSession(userId);
  return ok({ userId });
});
