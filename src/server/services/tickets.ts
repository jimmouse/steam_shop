import { TicketStatus, type TicketType } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { env } from "../lib/env";
import { sendMail } from "../lib/mail";
import { notifyAdmin } from "../lib/notify";
import { escapeHtml, isPublicUrl, notifyTelegramUser } from "../lib/telegram";
import { AppError, generateTicketNo } from "../lib/utils";
import { getUserEmail } from "./orders";
import { t } from "../bot/i18n";
import type { SupportedLocale } from "./auth";

const USER_CREATABLE: TicketType[] = ["PRESALE", "SUPPORT"];

/** 用户主动创建工单（售前咨询 / 售后）。代充、改区工单由订单支付后自动创建。 */
export async function createTicket(input: {
  userId: string;
  type: TicketType;
  subject: string;
  body: string;
  orderId?: string;
}) {
  if (!USER_CREATABLE.includes(input.type)) throw new AppError("该类型工单不能手动创建");
  const subject = input.subject.trim();
  const body = input.body.trim();
  if (!subject || !body) throw new AppError("请填写标题和内容");
  if (input.orderId) {
    const order = await prisma.order.findFirst({ where: { id: input.orderId, userId: input.userId } });
    if (!order) throw new AppError("订单不存在", 404);
  }

  const ticket = await prisma.ticket.create({
    data: {
      ticketNo: generateTicketNo(),
      userId: input.userId,
      orderId: input.orderId,
      type: input.type,
      subject,
      messages: { create: { authorId: input.userId, isStaff: false, body } },
    },
  });

  const email = await getUserEmail(input.userId);
  await notifyAdmin({
    title: `新工单 ${ticket.ticketNo}（${input.type}）：${subject}`,
    text: `用户：${email ?? input.userId}\n\n${body}`,
    path: `/admin/tickets/${ticket.id}`,
  });
  return ticket;
}

export async function listTicketsForUser(userId: string) {
  return prisma.ticket.findMany({
    where: { userId },
    include: { order: { select: { orderNo: true } } },
    orderBy: { updatedAt: "desc" },
  });
}

export async function getTicketForUser(userId: string, ticketId: string) {
  const t = await prisma.ticket.findFirst({
    where: { id: ticketId, userId },
    include: {
      order: { select: { id: true, orderNo: true, status: true } },
      messages: { orderBy: { createdAt: "asc" } },
    },
  });
  if (!t) throw new AppError("工单不存在", 404);
  return t;
}

/** 用户在工单中发消息：存库 + 邮件通知管理员。 */
export async function userReply(userId: string, ticketId: string, body: string): Promise<void> {
  const text = body.trim();
  if (!text) throw new AppError("内容不能为空");
  const ticket = await prisma.ticket.findFirst({ where: { id: ticketId, userId } });
  if (!ticket) throw new AppError("工单不存在", 404);
  if (ticket.status === TicketStatus.CLOSED) throw new AppError("工单已关闭");

  await prisma.$transaction([
    prisma.ticketMessage.create({ data: { ticketId, authorId: userId, isStaff: false, body: text } }),
    prisma.ticket.update({
      where: { id: ticketId },
      data: { status: ticket.status === TicketStatus.WAITING_USER ? TicketStatus.IN_PROGRESS : ticket.status },
    }),
  ]);

  const email = await getUserEmail(userId);
  await notifyAdmin({
    title: `工单回复 ${ticket.ticketNo}：${ticket.subject}`,
    text: `用户：${email ?? userId}\n\n${text}`,
    path: `/admin/tickets/${ticketId}`,
  });
}

// ─────────────────────────── 后台 ───────────────────────────

export async function listTicketsForAdmin(status?: TicketStatus) {
  return prisma.ticket.findMany({
    where: status ? { status } : { status: { notIn: [TicketStatus.CLOSED] } },
    include: {
      order: { select: { orderNo: true } },
      user: { select: { identities: { select: { provider: true, providerUid: true } } } },
    },
    orderBy: { updatedAt: "desc" },
    take: 100,
  });
}

export async function getTicketForAdmin(ticketId: string) {
  const t = await prisma.ticket.findUnique({
    where: { id: ticketId },
    include: {
      order: { include: { product: { select: { name: true } } } },
      user: { select: { id: true, identities: { select: { provider: true, providerUid: true, displayName: true } } } },
      messages: { orderBy: { createdAt: "asc" } },
    },
  });
  if (!t) throw new AppError("工单不存在", 404);
  return t;
}

/** 客服回复：存库 + 邮件通知用户，状态置为 WAITING_USER。 */
export async function staffReply(staffId: string, ticketId: string, body: string, status?: TicketStatus) {
  const text = body.trim();
  const ticket = await prisma.ticket.findUnique({ where: { id: ticketId } });
  if (!ticket) throw new AppError("工单不存在", 404);

  await prisma.$transaction([
    ...(text
      ? [prisma.ticketMessage.create({ data: { ticketId, authorId: staffId, isStaff: true, body: text } })]
      : []),
    prisma.ticket.update({
      where: { id: ticketId },
      data: { status: status ?? (text ? TicketStatus.WAITING_USER : ticket.status) },
    }),
  ]);

  if (text) {
    const email = await getUserEmail(ticket.userId);
    if (email) {
      await sendMail({
        to: email,
        subject: `工单 ${ticket.ticketNo} 有新回复`,
        text: `${text}\n\n查看工单：${env.appUrl}/tickets/${ticketId}`,
      });
    }
    const user = await prisma.user.findUnique({ where: { id: ticket.userId }, select: { locale: true } });
    const locale = (["zh", "en", "ru", "ar"].includes(user?.locale ?? "") ? user!.locale : "en") as SupportedLocale;
    const ticketUrl = `${env.appUrl}/tickets/${ticketId}`;
    await notifyTelegramUser(
      ticket.userId,
      t(locale, "notifyTicketReply", { ticketNo: escapeHtml(ticket.ticketNo), text: escapeHtml(text) }),
      isPublicUrl(ticketUrl) ? { replyMarkup: { inline_keyboard: [[{ text: t(locale, "viewOnWeb"), url: ticketUrl }]] } } : {},
    );
  }
}
