import Link from "next/link";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";

interface Props {
  basePath: string;
  param?: string;
  /** 当前选中的值；undefined 表示「全部」 */
  current?: string;
  allLabel?: string;
  options: { value: string; label: string }[];
}

/** 状态筛选胶囊行（服务端组件，靠 query string 切换） */
export function FilterChips({ basePath, param = "status", current, allLabel, options }: Props) {
  const tc = useTranslations("common");
  const all = allLabel ?? tc("all");
  const chip = (href: string, active: boolean, text: string) => (
    <Link
      key={href}
      href={href}
      className={cn(
        "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
        active ? "border-primary bg-primary text-primary-foreground" : "border-border text-muted-foreground hover:bg-accent hover:text-foreground",
      )}
    >
      {text}
    </Link>
  );
  return (
    <div className="mb-6 flex flex-wrap gap-1.5">
      {chip(basePath, !current, all)}
      {options.map((o) => chip(`${basePath}?${param}=${o.value}`, current === o.value, o.label))}
    </div>
  );
}
