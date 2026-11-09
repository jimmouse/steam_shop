import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import bcrypt from "bcryptjs";
import { IdentityProvider, type CodePurpose, type Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { env } from "../lib/env";
import { sendMail } from "../lib/mail";
import { AppError, generateVerificationCode, normalizeEmail } from "../lib/utils";

const CODE_TTL_MS = 10 * 60 * 1000;
const CODE_RESEND_INTERVAL_MS = 60 * 1000;

// ─────────────────────────── 验证码 ───────────────────────────

export async function sendVerificationCode(rawEmail: string, purpose: CodePurpose): Promise<void> {
  const email = normalizeEmail(rawEmail);

  const existing = await findUserIdByIdentity(IdentityProvider.EMAIL, email);
  if (purpose === "REGISTER" && existing) throw new AppError("该邮箱已注册，请直接登录");
  if (purpose === "RESET_PASSWORD" && !existing) throw new AppError("该邮箱未注册");

  const recent = await prisma.verificationCode.findFirst({
    where: { email, purpose, createdAt: { gt: new Date(Date.now() - CODE_RESEND_INTERVAL_MS) } },
  });
  if (recent) throw new AppError("发送过于频繁，请稍后再试", 429, "RATE_LIMITED");

  const code = generateVerificationCode();
  await prisma.verificationCode.create({
    data: { email, code, purpose, expiresAt: new Date(Date.now() + CODE_TTL_MS) },
  });

  await sendMail({
    to: email,
    subject: `${env.appName} 验证码：${code}`,
    text: `您的验证码是 ${code}，10 分钟内有效。如非本人操作请忽略。`,
  });
}

async function consumeCode(email: string, purpose: CodePurpose, code: string): Promise<void> {
  const rec = await prisma.verificationCode.findFirst({
    where: { email, purpose, code, usedAt: null, expiresAt: { gt: new Date() } },
    orderBy: { createdAt: "desc" },
  });
  if (!rec) throw new AppError("验证码错误或已过期");
  await prisma.verificationCode.update({ where: { id: rec.id }, data: { usedAt: new Date() } });
}

// ─────────────────────────── 身份查询 ───────────────────────────

async function findUserIdByIdentity(provider: IdentityProvider, uid: string): Promise<string | null> {
  const identity = await prisma.identity.findUnique({
    where: { provider_providerUid: { provider, providerUid: uid } },
    select: { userId: true, user: { select: { mergedIntoId: true } } },
  });
  if (!identity) return null;
  return identity.user.mergedIntoId ?? identity.userId;
}

// ─────────────────────────── 邮箱注册 / 登录 ───────────────────────────

export async function registerWithEmail(rawEmail: string, code: string, password: string): Promise<string> {
  const email = normalizeEmail(rawEmail);
  if (password.length < 8) throw new AppError("密码至少 8 位");
  if (await findUserIdByIdentity(IdentityProvider.EMAIL, email)) throw new AppError("该邮箱已注册");

  await consumeCode(email, "REGISTER", code);

  const passwordHash = await bcrypt.hash(password, 10);
  const user = await prisma.user.create({
    data: {
      role: env.adminEmails.includes(email) ? "ADMIN" : "USER",
      identities: {
        create: { provider: IdentityProvider.EMAIL, providerUid: email, passwordHash, verifiedAt: new Date() },
      },
    },
  });
  return user.id;
}

export async function loginWithPassword(rawEmail: string, password: string): Promise<string> {
  const email = normalizeEmail(rawEmail);
  const identity = await prisma.identity.findUnique({
    where: { provider_providerUid: { provider: IdentityProvider.EMAIL, providerUid: email } },
    include: { user: { select: { mergedIntoId: true } } },
  });
  if (!identity?.passwordHash) throw new AppError("邮箱或密码错误", 401, "INVALID_CREDENTIALS");
  const ok = await bcrypt.compare(password, identity.passwordHash);
  if (!ok) throw new AppError("邮箱或密码错误", 401, "INVALID_CREDENTIALS");
  return identity.user.mergedIntoId ?? identity.userId;
}

export async function resetPassword(rawEmail: string, code: string, password: string): Promise<void> {
  const email = normalizeEmail(rawEmail);
  if (password.length < 8) throw new AppError("密码至少 8 位");
  await consumeCode(email, "RESET_PASSWORD", code);
  await prisma.identity.update({
    where: { provider_providerUid: { provider: IdentityProvider.EMAIL, providerUid: email } },
    data: { passwordHash: await bcrypt.hash(password, 10) },
  });
}

// ─────────────────────────── Telegram Login Widget ───────────────────────────

export interface TelegramWidgetData {
  id: number | string;
  first_name?: string;
  last_name?: string;
  username?: string;
  photo_url?: string;
  auth_date: number | string;
  hash: string;
}

/** 校验 Telegram Login Widget 回传数据的签名。 */
export function verifyTelegramWidget(data: TelegramWidgetData): void {
  if (!env.telegramBotToken) throw new AppError("未配置 Telegram 登录", 500, "NOT_CONFIGURED");
  const { hash, ...rest } = data;
  const checkString = Object.entries(rest)
    .filter(([, v]) => v !== undefined && v !== null)
    .map(([k, v]) => `${k}=${v}`)
    .sort()
    .join("\n");
  const secretKey = createHash("sha256").update(env.telegramBotToken).digest();
  const expected = createHmac("sha256", secretKey).update(checkString).digest("hex");
  const a = Buffer.from(expected, "hex");
  const b = Buffer.from(hash, "hex");
  if (a.length !== b.length || !timingSafeEqual(a, b)) throw new AppError("Telegram 签名校验失败", 401);
  if (Date.now() / 1000 - Number(data.auth_date) > 86400) throw new AppError("Telegram 登录数据已过期", 401);
}

function telegramDisplayName(d: Pick<TelegramWidgetData, "username" | "first_name" | "last_name">): string {
  return d.username ? `@${d.username}` : [d.first_name, d.last_name].filter(Boolean).join(" ");
}

export async function loginWithTelegram(data: TelegramWidgetData): Promise<string> {
  verifyTelegramWidget(data);
  const uid = String(data.id);
  const existing = await findUserIdByIdentity(IdentityProvider.TELEGRAM, uid);
  if (existing) return existing;

  const user = await prisma.user.create({
    data: {
      identities: {
        create: {
          provider: IdentityProvider.TELEGRAM,
          providerUid: uid,
          displayName: telegramDisplayName(data),
          verifiedAt: new Date(),
        },
      },
    },
  });
  return user.id;
}

// ─────────────────────────── Telegram Bot ───────────────────────────

export const SUPPORTED_LOCALES = ["zh", "en", "ru", "ar"] as const;
export type SupportedLocale = (typeof SUPPORTED_LOCALES)[number];

/** Telegram language_code（如 zh-hans / ru / ar / en-US）→ 站点语言 */
export function localeFromTelegram(code?: string | null): SupportedLocale {
  const c = (code ?? "").toLowerCase();
  if (c.startsWith("zh")) return "zh";
  if (c.startsWith("ru")) return "ru";
  if (c.startsWith("ar")) return "ar";
  return "en";
}

export interface TelegramBotUser {
  id: number | string;
  first_name?: string;
  last_name?: string;
  username?: string;
  language_code?: string;
}

/**
 * Bot 私聊里的用户已由 Telegram 服务器鉴权（update.from），无需 Widget 签名。
 * 不存在则创建；存在则顺带刷新 displayName。返回生效的 userId 与语言。
 */
export async function ensureTelegramUser(from: TelegramBotUser): Promise<{ userId: string; locale: SupportedLocale; created: boolean }> {
  const uid = String(from.id);
  const displayName = telegramDisplayName(from);
  const existing = await findUserIdByIdentity(IdentityProvider.TELEGRAM, uid);
  if (existing) {
    const [user] = await Promise.all([
      prisma.user.findUniqueOrThrow({ where: { id: existing }, select: { locale: true } }),
      prisma.identity.updateMany({
        where: { provider: IdentityProvider.TELEGRAM, providerUid: uid, NOT: { displayName } },
        data: { displayName },
      }),
    ]);
    const locale = (SUPPORTED_LOCALES as readonly string[]).includes(user.locale) ? (user.locale as SupportedLocale) : "en";
    return { userId: existing, locale, created: false };
  }
  const locale = localeFromTelegram(from.language_code);
  const user = await prisma.user.create({
    data: {
      locale,
      identities: {
        create: { provider: IdentityProvider.TELEGRAM, providerUid: uid, displayName, verifiedAt: new Date() },
      },
    },
  });
  return { userId: user.id, locale, created: true };
}

export async function setUserLocale(userId: string, locale: SupportedLocale): Promise<void> {
  await prisma.user.update({ where: { id: userId }, data: { locale } });
}

// ─────────────────────────── 绑定身份 / 合并账号 ───────────────────────────

/**
 * 把一个已验证的身份挂到当前用户上。
 * - 身份未被占用：直接新增
 * - 身份属于自己：无操作
 * - 身份属于另一个用户：若两人没有同 provider 的冲突身份，则合并；否则拒绝
 * 返回合并后应当使用的 userId（可能与传入的不同）。
 */
async function linkIdentity(
  currentUserId: string,
  provider: IdentityProvider,
  uid: string,
  extra: Partial<Pick<Prisma.IdentityUncheckedCreateInput, "passwordHash" | "displayName">> = {},
): Promise<string> {
  const ownerId = await findUserIdByIdentity(provider, uid);

  if (!ownerId) {
    await prisma.identity.create({
      data: { userId: currentUserId, provider, providerUid: uid, verifiedAt: new Date(), ...extra },
    });
    return currentUserId;
  }
  if (ownerId === currentUserId) return currentUserId;

  const [mine, theirs] = await Promise.all([
    prisma.identity.findMany({ where: { userId: currentUserId }, select: { provider: true } }),
    prisma.identity.findMany({ where: { userId: ownerId }, select: { provider: true } }),
  ]);
  const theirProviders = new Set(theirs.map((i) => i.provider));
  const conflict = mine.find((i) => theirProviders.has(i.provider));
  if (conflict) {
    throw new AppError(`该${providerLabel(provider)}已绑定到另一个账号，且那个账号已有${providerLabel(conflict.provider)}，无法合并`, 409, "IDENTITY_CONFLICT");
  }

  // 保留创建更早的账号
  const [a, b] = await Promise.all([
    prisma.user.findUniqueOrThrow({ where: { id: currentUserId }, select: { id: true, createdAt: true } }),
    prisma.user.findUniqueOrThrow({ where: { id: ownerId }, select: { id: true, createdAt: true } }),
  ]);
  const [keep, drop] = a.createdAt <= b.createdAt ? [a.id, b.id] : [b.id, a.id];
  await mergeUsers(keep, drop);
  return keep;
}

async function mergeUsers(keepId: string, dropId: string): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const dropped = await tx.user.findUniqueOrThrow({ where: { id: dropId } });
    await tx.identity.updateMany({ where: { userId: dropId }, data: { userId: keepId } });
    await tx.order.updateMany({ where: { userId: dropId }, data: { userId: keepId } });
    await tx.ticket.updateMany({ where: { userId: dropId }, data: { userId: keepId } });
    await tx.ticketMessage.updateMany({ where: { authorId: dropId }, data: { authorId: keepId } });
    await tx.user.update({
      where: { id: keepId },
      data: {
        balance: { increment: dropped.balance },
        ...(dropped.role === "ADMIN" ? { role: "ADMIN" } : {}),
      },
    });
    await tx.user.update({ where: { id: dropId }, data: { mergedIntoId: keepId, balance: 0 } });
  });
}

function providerLabel(p: IdentityProvider): string {
  return { EMAIL: "邮箱", TELEGRAM: "Telegram", DISCORD: "Discord" }[p];
}

/** TG/Discord 用户绑定邮箱（可顺便设置密码）。返回绑定后生效的 userId。 */
export async function bindEmail(userId: string, rawEmail: string, code: string, password?: string): Promise<string> {
  const email = normalizeEmail(rawEmail);
  if (password !== undefined && password.length < 8) throw new AppError("密码至少 8 位");
  await consumeCode(email, "BIND_EMAIL", code);
  const passwordHash = password ? await bcrypt.hash(password, 10) : undefined;
  const resultId = await linkIdentity(userId, IdentityProvider.EMAIL, email, { passwordHash });
  if (env.adminEmails.includes(email)) {
    await prisma.user.update({ where: { id: resultId }, data: { role: "ADMIN" } });
  }
  return resultId;
}

/** 邮箱用户绑定 Telegram。返回绑定后生效的 userId。 */
export async function bindTelegram(userId: string, data: TelegramWidgetData): Promise<string> {
  verifyTelegramWidget(data);
  return linkIdentity(userId, IdentityProvider.TELEGRAM, String(data.id), {
    displayName: telegramDisplayName(data),
  });
}

export async function listIdentities(userId: string) {
  return prisma.identity.findMany({
    where: { userId },
    select: { id: true, provider: true, providerUid: true, displayName: true, verifiedAt: true, createdAt: true },
    orderBy: { createdAt: "asc" },
  });
}
