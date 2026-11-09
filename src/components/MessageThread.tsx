import { Bot, Headset, UserRound } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import { cn } from "@/lib/utils";

interface Message {
  id: string;
  isStaff: boolean;
  authorId: string | null;
  body: string;
  createdAt: Date | string;
}

interface Props {
  messages: Message[];
  /** 普通用户视角显示「我」，后台视角显示「用户」 */
  perspective: "user" | "staff";
}

export function MessageThread({ messages, perspective }: Props) {
  const t = useTranslations("tickets.who");
  const f = useFormatter();
  const fmtDate = (d: Date | string) => f.dateTime(new Date(d), "full");
  return (
    <ol className="space-y-3">
      {messages.map((m) => {
        const system = !m.authorId;
        const mine = perspective === "user" ? !m.isStaff && !system : m.isStaff;
        const who = system ? t("system") : m.isStaff ? t("staff") : perspective === "user" ? t("me") : t("user");
        const Icon = system ? Bot : m.isStaff ? Headset : UserRound;

        if (system) {
          return (
            <li key={m.id} className="flex justify-center">
              <div className="max-w-[90%] rounded-lg border border-dashed bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
                <p className="mb-1 flex items-center gap-1 text-[11px]">
                  <Icon className="size-3" />
                  {who} · {fmtDate(m.createdAt)}
                </p>
                <p className="whitespace-pre-wrap">{m.body}</p>
              </div>
            </li>
          );
        }
        return (
          <li key={m.id} className={cn("flex gap-2.5", mine ? "flex-row-reverse" : "flex-row")}>
            <span
              className={cn(
                "mt-1 flex size-7 shrink-0 items-center justify-center rounded-full",
                m.isStaff ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground",
              )}
            >
              <Icon className="size-3.5" />
            </span>
            <div className={cn("max-w-[80%] space-y-1", mine ? "items-end text-end" : "items-start")}>
              <p className="text-[11px] text-muted-foreground">
                {who} · {fmtDate(m.createdAt)}
              </p>
              <div
                className={cn(
                  "inline-block rounded-2xl px-3.5 py-2.5 text-start text-sm whitespace-pre-wrap",
                  m.isStaff ? "rounded-ss-md bg-primary/12 text-foreground" : "rounded-se-md bg-card border",
                  mine && m.isStaff && "rounded-ss-2xl rounded-se-md",
                  mine && !m.isStaff && "rounded-se-md",
                )}
              >
                {m.body}
              </div>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
