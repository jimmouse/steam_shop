import { z } from "zod";
import { handler, ok, parseBody } from "@/server/lib/api";
import { sendVerificationCode } from "@/server/services/auth";

const schema = z.object({
  email: z.email(),
  purpose: z.enum(["REGISTER", "BIND_EMAIL", "RESET_PASSWORD"]),
});

export const POST = handler(async (req) => {
  const { email, purpose } = await parseBody(req, schema);
  await sendVerificationCode(email, purpose);
  return ok({ sent: true });
});
