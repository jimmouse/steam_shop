"use client";

import { Loader2, Send } from "lucide-react";
import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";

interface Props {
  /** 同一表单中邮箱输入框的 name，点击时从中读取邮箱 */
  emailField?: string;
  purpose: "REGISTER" | "BIND_EMAIL" | "RESET_PASSWORD";
}

export function SendCodeButton({ emailField = "email", purpose }: Props) {
  const t = useTranslations("auth");
  const [cooldown, setCooldown] = useState(0);
  const [sending, setSending] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  async function send(e: React.MouseEvent<HTMLButtonElement>) {
    const form = e.currentTarget.closest("form");
    const email = (form?.elements.namedItem(emailField) as HTMLInputElement | null)?.value?.trim();
    if (!email) {
      setMsg({ ok: false, text: t("fillEmailFirst") });
      return;
    }
    setSending(true);
    setMsg(null);
    const res = await fetch("/api/auth/send-code", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, purpose }),
    });
    const json = await res.json().catch(() => ({}));
    setSending(false);
    if (!res.ok) {
      setMsg({ ok: false, text: json?.error?.message ?? t("sendFailed") });
      return;
    }
    setMsg({ ok: true, text: t("codeSent") });
    setCooldown(60);
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <Button type="button" variant="outline" size="default" disabled={cooldown > 0 || sending} onClick={send} className="shrink-0 whitespace-nowrap">
        {sending ? <Loader2 className="animate-spin" /> : <Send />}
        {cooldown > 0 ? `${cooldown}s` : t("sendCode")}
      </Button>
      {msg && <span className={`text-[11px] ${msg.ok ? "text-success" : "text-destructive"}`}>{msg.text}</span>}
    </div>
  );
}
