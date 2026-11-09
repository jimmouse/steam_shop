import { getCurrentUser } from "@/server/lib/session";
import { NavClient } from "./NavClient";

export async function Nav() {
  const user = await getCurrentUser();
  return <NavClient appName={process.env.APP_NAME ?? "Steam Store"} user={user ? { role: user.role } : null} />;
}
