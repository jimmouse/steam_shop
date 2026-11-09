import { handler, ok, parseBody } from "@/server/lib/api";
import { telegramWidgetSchema } from "@/server/lib/schemas";
import { createSession, requireUser } from "@/server/lib/session";
import { bindTelegram } from "@/server/services/auth";

export const POST = handler(async (req) => {
  const user = await requireUser();
  const data = await parseBody(req, telegramWidgetSchema);
  const resultId = await bindTelegram(user.id, data);
  if (resultId !== user.id) await createSession(resultId);
  return ok({ userId: resultId, merged: resultId !== user.id });
});
