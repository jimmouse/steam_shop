"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";

interface Props {
  /** 截止时间 ISO 字符串 */
  until: string;
  className?: string;
  /** 到期后显示 */
  expiredText?: string;
  onExpire?: () => void;
}

function fmt(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(s / 60);
  return `${String(m).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}

export function CountdownText({ until, className, expiredText, onExpire }: Props) {
  const t = useTranslations("payment");
  const target = new Date(until).getTime();
  // SSR 与首帧统一渲染占位，挂载后再计算，避免 hydration 不一致
  const [left, setLeft] = useState<number | null>(null);

  useEffect(() => {
    const tick = () => {
      const v = target - Date.now();
      setLeft(v);
      if (v <= 0) {
        clearInterval(t);
        onExpire?.();
      }
    };
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, [target, onExpire]);

  if (left === null) return <span className={cn("font-mono tabular-nums text-muted-foreground", className)}>--:--</span>;

  const urgent = left > 0 && left < 3 * 60 * 1000;
  return (
    <span className={cn("font-mono tabular-nums", urgent && "text-destructive", left <= 0 && "text-muted-foreground", className)}>
      {left <= 0 ? (expiredText ?? t("expired")) : fmt(left)}
    </span>
  );
}
