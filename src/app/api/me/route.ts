import { handler, ok, serialize } from "@/server/lib/api";
import { requireUser } from "@/server/lib/session";
import { listIdentities } from "@/server/services/auth";

export const GET = handler(async () => {
  const user = await requireUser();
  const identities = await listIdentities(user.id);
  return ok(serialize({ ...user, identities }));
});
