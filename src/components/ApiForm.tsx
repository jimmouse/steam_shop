"use client";

import { AlertCircle, CheckCircle2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState, type FormEvent, type ReactNode } from "react";

interface Props {
  action: string;
  method?: "POST" | "PATCH" | "DELETE";
  /** 成功后跳转；支持 `{id}` 等占位符，从响应 data 取值 */
  redirectTo?: string;
  /** 成功后提示文字（不跳转时显示） */
  successMessage?: string;
  /** 提交前确认 */
  confirmText?: string;
  /** 提交前转换表单数据 */
  transform?: (data: Record<string, string>) => unknown;
  /** 提交成功后是否清空表单 */
  resetOnSuccess?: boolean;
  onSuccess?: (data: unknown) => void;
  className?: string;
  children: ReactNode;
}

/**
 * 通用表单：把表单字段序列化成 JSON 提交到 API，处理错误提示与成功跳转。
 * 页面里的绝大多数表单都复用它，避免每个表单写一遍 fetch。
 */
export function ApiForm({
  action,
  method = "POST",
  redirectTo,
  successMessage,
  confirmText,
  transform,
  resetOnSuccess,
  onSuccess,
  className,
  children,
}: Props) {
  const router = useRouter();
  const tc = useTranslations("common");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (confirmText && !window.confirm(confirmText)) return;
    const form = e.currentTarget;
    const raw: Record<string, string> = {};
    for (const [k, v] of new FormData(form).entries()) raw[k] = typeof v === "string" ? v : "";

    setPending(true);
    setError(null);
    setSuccess(null);
    try {
      const res = await fetch(action, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(transform ? transform(raw) : raw),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || json.ok === false) {
        setError(json?.error?.message ?? tc("requestFailed", { status: res.status }));
        return;
      }
      onSuccess?.(json.data);
      if (redirectTo) {
        const target = redirectTo.replace(/\{(\w+)\}/g, (_, k) => String(json.data?.[k] ?? ""));
        router.push(target);
        router.refresh();
        return;
      }
      if (resetOnSuccess) form.reset();
      setSuccess(successMessage ?? tc("success"));
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : tc("networkError"));
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className={className}>
      <fieldset disabled={pending} className="contents">
        {children}
      </fieldset>
      {error && (
        <p role="alert" className="mt-3 flex items-start gap-1.5 text-sm text-destructive">
          <AlertCircle className="mt-0.5 size-3.5 shrink-0" />
          {error}
        </p>
      )}
      {success && (
        <p className="mt-3 flex items-start gap-1.5 text-sm text-success">
          <CheckCircle2 className="mt-0.5 size-3.5 shrink-0" />
          {success}
        </p>
      )}
    </form>
  );
}
