"use client";

import { Send } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";

interface Props {
  /** 登录用 /api/auth/telegram，绑定用 /api/me/bind-telegram */
  endpoint: string;
  redirectTo?: string;
  /** 由服务端 telegramLoginAvailability() 决定；"hint" 只在开发环境出现 */
  mode: "ready" | "hint";
}

declare global {
  interface Window {
    onTelegramAuth?: (user: Record<string, unknown>) => void;
  }
}

/** Telegram Login Widget：https://core.telegram.org/widgets/login */
export function TelegramLoginButton({ endpoint, redirectTo = "/account", mode }: Props) {
  const t = useTranslations("auth.telegram");
  const ref = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const botUsername = process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME;
  const ready = mode === "ready" && !!botUsername;

  useEffect(() => {
    if (!ready || !ref.current) return;
    window.onTelegramAuth = async (user) => {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(user),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(json?.error?.message ?? t("failed"));
        return;
      }
      router.push(redirectTo);
      router.refresh();
    };
    const script = document.createElement("script");
    script.src = "https://telegram.org/js/telegram-widget.js?22";
    script.async = true;
    script.setAttribute("data-telegram-login", botUsername!);
    script.setAttribute("data-size", "large");
    script.setAttribute("data-radius", "10");
    script.setAttribute("data-onauth", "onTelegramAuth(user)");
    script.setAttribute("data-request-access", "write");
    const container = ref.current;
    container.innerHTML = "";
    container.appendChild(script);
    return () => {
      container.innerHTML = "";
      delete window.onTelegramAuth;
    };
  }, [ready, botUsername, endpoint, redirectTo, router, t]);

  if (!ready) {
    return (
      <div className="flex w-full items-center justify-center gap-2 rounded-lg border border-dashed px-4 py-2.5 text-center text-sm text-muted-foreground">
        <Send className="size-4 shrink-0 text-[#2AABEE]" />
        {!botUsername ? t("notConfigured") : t("needDomain")}
      </div>
    );
  }
  return (
    <div className="flex flex-col items-center gap-2">
      <div ref={ref} />
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}
