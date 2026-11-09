import { handler, ok } from "@/server/lib/api";
import { destroySession } from "@/server/lib/session";

export const POST = handler(async () => {
  await destroySession();
  return ok({ loggedOut: true });
});
