import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { AdminShell } from "@/components/AdminShell";
import { getCurrentUser } from "@/server/lib/session";

export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/admin");
  if (user.role !== "ADMIN") redirect("/");
  return <AdminShell appName={process.env.APP_NAME ?? "Steam Store"}>{children}</AdminShell>;
}
