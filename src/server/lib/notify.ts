import { env } from "./env";
import { sendMail } from "./mail";
import { escapeHtml, isPublicUrl, sendTelegramMessage } from "./telegram";

export interface AdminNotice {
  /** 一句话标题，如「新工单 TK…」 */
  title: string;
  /** 正文（纯文本，多行用 \n） */
  text: string;
  /** 后台处理链接（相对路径，如 /admin/tickets/xxx） */
  path?: string;
  /** 按钮文字，默认「去处理」 */
  action?: string;
}

/**
 * 管理员通知：邮件与 Telegram 两个渠道各自独立开关。
 * - ADMIN_NOTIFY_EMAIL 非空 → 发邮件
 * - ADMIN_TELEGRAM_CHAT_IDS 非空且配置了 Bot → 推 Telegram（多个 chat id 逗号分隔）
 * 两者都为空则静默。任何一路失败不影响主流程。
 */
export async function notifyAdmin(notice: AdminNotice): Promise<void> {
  const url = notice.path ? `${env.appUrl}${notice.path}` : null;
  const tasks: Promise<unknown>[] = [];

  if (env.adminNotifyEmail) {
    tasks.push(
      sendMail({
        to: env.adminNotifyEmail,
        subject: `[${env.appName}] ${notice.title}`,
        text: url ? `${notice.text}\n\n${url}` : notice.text,
      }),
    );
  }

  if (env.adminTelegramChatIds.length > 0 && env.telegramBotToken) {
    const html = `🔔 <b>${escapeHtml(notice.title)}</b>\n\n${escapeHtml(notice.text)}${url && !isPublicUrl(url) ? `\n\n${escapeHtml(url)}` : ""}`;
    const replyMarkup = url && isPublicUrl(url) ? { inline_keyboard: [[{ text: notice.action ?? "去处理 →", url }]] } : undefined;
    for (const chatId of env.adminTelegramChatIds) tasks.push(sendTelegramMessage(chatId, html, { replyMarkup }));
  }

  await Promise.allSettled(tasks);
}
