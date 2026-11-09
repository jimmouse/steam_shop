import { ArrowLeftRight, Coins, Globe, UserRound } from "lucide-react";
import "flag-icons/css/flag-icons.min.css";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";

interface Props {
  imageUrl?: string | null;
  region: string;
  type: "ACCOUNT" | "TOPUP" | "REGION_CHANGE";
  name: string;
  className?: string;
  /** 大图（详情页）还是卡片 */
  size?: "card" | "hero";
}

const TYPE_STYLE = {
  ACCOUNT: { icon: UserRound, from: "from-sky-500/25", to: "to-indigo-600/10" },
  TOPUP: { icon: Coins, from: "from-emerald-500/25", to: "to-teal-600/10" },
  REGION_CHANGE: { icon: ArrowLeftRight, from: "from-violet-500/25", to: "to-fuchsia-600/10" },
} as const;

/** 国旗（flag-icons SVG，4:3）；非两位国家码回退为地球图标 */
export function RegionFlag({ region, height = 48, className }: { region: string; height?: number; className?: string }) {
  const code = region.trim().toLowerCase();
  if (!/^[a-z]{2}$/.test(code)) return <Globe className={cn("text-white/70", className)} style={{ width: height, height }} />;
  return (
    <span
      className={cn("fi inline-block rounded-md shadow-lg shadow-black/40 ring-1 ring-white/10", `fi-${code}`, className)}
      style={{ width: (height * 4) / 3, height, lineHeight: 0 }}
      aria-hidden
    />
  );
}

export function ProductCover({ imageUrl, region, type, name, className, size = "card" }: Props) {
  const t = useTranslations("cover");
  const hero = size === "hero";
  const ratio = hero ? "aspect-[21/9]" : "aspect-[2/1]";
  if (imageUrl) {
    return (
      <div className={cn("relative overflow-hidden bg-muted", ratio, className)}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={imageUrl} alt={name} className="size-full object-cover" loading="lazy" />
      </div>
    );
  }

  const s = TYPE_STYLE[type];
  return (
    <div className={cn("relative flex items-center justify-center overflow-hidden bg-gradient-to-br", s.from, s.to, ratio, className)} aria-hidden>
      <div className="pointer-events-none absolute inset-0 opacity-[0.07] [background-image:radial-gradient(circle_at_1px_1px,white_1px,transparent_0)] [background-size:18px_18px]" />
      <div className="pointer-events-none absolute -end-6 -top-6 size-32 rounded-full bg-white/5 blur-2xl" />
      <RegionFlag region={region} height={hero ? 84 : 52} />
      <span className="absolute start-3 top-3 rounded-md bg-black/35 px-2 py-0.5 font-mono text-[11px] font-semibold tracking-wider text-white/90 backdrop-blur">
        {region.toUpperCase()}
      </span>
      <span className="absolute end-3 bottom-3 flex items-center gap-1 rounded-md bg-black/35 px-2 py-0.5 text-[11px] text-white/85 backdrop-blur">
        <s.icon className="size-3" />
        {t(type)}
      </span>
    </div>
  );
}
