import { z } from "zod";
import { handler, ok, parseBody } from "@/server/lib/api";
import { createSession, requireUser } from "@/server/lib/session";
import { bindEmail } from "@/server/services/auth";

const schema = z.object({
  email: z.email(),
  code: z.string().length(6),
  password: z.string().min(8).max(128).optional().or(z.literal("")),
});

export const POST = handler(async (req) => {
  const user = await requireUser();
  const { email, code, password } = await parseBody(req, schema);
  const resultId = await bindEmail(user.id, email, code, password || undefined);
  // 合并后可能切换到另一个 userId，刷新会话
  if (resultId !== user.id) await createSession(resultId);
  return ok({ userId: resultId, merged: resultId !== user.id });
});
