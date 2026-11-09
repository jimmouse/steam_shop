"use client";

import { Check, Copy } from "lucide-react";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

interface Props {
  value: string;
  label?: string;
  size?: "icon-xs" | "icon-sm" | "icon" | "xs" | "sm" | "default";
  variant?: "ghost" | "outline" | "secondary";
  className?: string;
}

export function CopyButton({ value, label, size = "icon-sm", variant = "ghost", className }: Props) {
  const [copied, setCopied] = useState(false);
  const t = useTranslations("common");

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
    } catch {
      const ta = document.createElement("textarea");
      ta.value = value;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      ta.remove();
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  const Icon = copied ? Check : Copy;
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button type="button" variant={variant} size={size} onClick={copy} className={cn(copied && "text-success", className)} aria-label={label ?? t("copy")}>
            <Icon />
            {label && size !== "icon" && size !== "icon-sm" && size !== "icon-xs" && <span>{copied ? t("copied") : label}</span>}
          </Button>
        }
      />
      <TooltipContent>{copied ? t("copied") : (label ?? t("copy"))}</TooltipContent>
    </Tooltip>
  );
}
