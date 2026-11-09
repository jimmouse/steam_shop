import type { ReactNode } from "react";
import { useTranslations } from "next-intl";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const LABELS: Record<string, string> = {
  // 订单
  PENDING: "待支付",
  PAID: "已支付",
  PROCESSING: "处理中",
  DELIVERED: "已完成",
  EXPIRED: "已过期",
  CANCELLED: "已取消",
  REFUNDED: "已退款",
  // 支付
  CONFIRMED: "已确认",
  FAILED: "失败",
  // 工单
  OPEN: "待处理",
  IN_PROGRESS: "处理中",
  WAITING_USER: "等待用户",
  RESOLVED: "已解决",
  CLOSED: "已关闭",
  // 类型
  ACCOUNT: "账号",
  TOPUP: "代充",
  REGION_CHANGE: "改区",
  PRESALE: "售前咨询",
  SUPPORT: "售后",
  MOCK: "模拟支付",
  BEPUSDT: "链上支付",
  EMAIL: "邮箱",
  TELEGRAM: "Telegram",
  DISCORD: "Discord",
  WEB: "网站",
  AUTO_INVENTORY: "自动发货",
  MANUAL_TICKET: "人工处理",
};

type Tone = "warning" | "info" | "success" | "muted" | "danger" | "purple";

const TONES: Record<string, Tone> = {
  PENDING: "warning",
  OPEN: "warning",
  PAID: "info",
  PROCESSING: "info",
  IN_PROGRESS: "info",
  WAITING_USER: "purple",
  DELIVERED: "success",
  CONFIRMED: "success",
  RESOLVED: "success",
  EXPIRED: "muted",
  CANCELLED: "muted",
  CLOSED: "muted",
  REFUNDED: "danger",
  FAILED: "danger",
};

const TONE_CLASS: Record<Tone, string> = {
  warning: "bg-warning/15 text-warning",
  info: "bg-info/15 text-info",
  success: "bg-success/15 text-success",
  muted: "bg-muted text-muted-foreground",
  danger: "bg-destructive/15 text-destructive",
  purple: "bg-purple/15 text-purple",
};

export function label(v: string): string {
  return LABELS[v] ?? v;
}

export function StatusBadge({ value, className }: { value: string; className?: string }) {
  const t = useTranslations("enum");
  const tone = TONES[value] ?? "muted";
  return (
    <Badge variant="secondary" className={cn("gap-1.5 border-0", TONE_CLASS[tone], className)}>
      <span className="size-1.5 rounded-full bg-current opacity-80" aria-hidden />
      {t.has(value) ? t(value) : value}
    </Badge>
  );
}

/** 小号信息胶囊：区域 / 类型 等 */
export function Pill({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <Badge variant="outline" className={cn("rounded-md bg-muted/40 font-mono text-[11px] tracking-wide text-muted-foreground", className)}>
      {children}
    </Badge>
  );
}

export function fmtDate(d: Date | string, opts: { time?: boolean } = { time: true }): string {
  const date = new Date(d);
  return date.toLocaleString("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    ...(opts.time ? { hour: "2-digit", minute: "2-digit", hour12: false } : {}),
  });
}

export function fmtMoney(amount: string | number | { toString(): string }, currency: string): string {
  return `${Number(amount.toString()).toFixed(2)} ${currency}`;
}

export function MoneyText({
  amount,
  currency,
  className,
  size = "md",
}: {
  amount: string | number | { toString(): string };
  currency: string;
  className?: string;
  size?: "sm" | "md" | "lg" | "xl";
}) {
  const sizes = { sm: "text-sm", md: "text-base", lg: "text-xl", xl: "text-3xl" };
  return (
    <span className={cn("font-semibold tabular-nums tracking-tight", sizes[size], className)}>
      {Number(amount.toString()).toFixed(2)}
      <span className="ms-1 text-[0.65em] font-medium text-muted-foreground">{currency}</span>
    </span>
  );
}

export function PageHeader({
  title,
  description,
  action,
  className,
}: {
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("mb-6 flex flex-wrap items-end justify-between gap-3", className)}>
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
      </div>
      {action}
    </div>
  );
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: {
  icon?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col items-center justify-center rounded-xl border border-dashed px-6 py-14 text-center", className)}>
      {icon && <div className="mb-3 flex size-12 items-center justify-center rounded-full bg-muted text-muted-foreground [&_svg]:size-6">{icon}</div>}
      <p className="font-medium">{title}</p>
      {description && <p className="mt-1 max-w-sm text-sm text-muted-foreground">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

/** 等宽代码块（发货内容、用户输入、地址） */
export function CodeBlock({ children, className, dir }: { children: ReactNode; className?: string; dir?: "ltr" | "rtl" }) {
  return (
    <pre dir={dir} className={cn("overflow-x-auto rounded-lg border bg-black/30 p-3 font-mono text-xs leading-relaxed whitespace-pre-wrap break-all", className)}>
      {children}
    </pre>
  );
}
