import type { ReactNode } from "react";
import Link from "next/link";
import { Store } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

/** 登录 / 注册 / 找回密码 的居中卡片外壳 */
export function AuthCard({
  title,
  description,
  children,
  footer,
}: {
  title: string;
  description?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <div className="mx-auto w-full max-w-sm pt-4 md:pt-10">
      <Link href="/" className="mb-6 flex items-center justify-center gap-2 text-sm text-muted-foreground hover:text-foreground">
        <span className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
          <Store className="size-4" />
        </span>
        {process.env.APP_NAME ?? "Steam Store"}
      </Link>
      <Card>
        <CardHeader className="text-center">
          <CardTitle className="text-xl">{title}</CardTitle>
          {description && <CardDescription>{description}</CardDescription>}
        </CardHeader>
        <CardContent>{children}</CardContent>
      </Card>
      {footer && <div className="mt-4 text-center text-xs text-muted-foreground">{footer}</div>}
    </div>
  );
}
