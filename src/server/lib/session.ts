import { cookies } from "next/headers";
import { SignJWT, jwtVerify } from "jose";
import { env } from "./env";
import { prisma } from "./prisma";
import { AppError } from "./utils";
import type { Role, User } from "@prisma/client";

const COOKIE = "session";
const MAX_AGE_SEC = 60 * 60 * 24 * 30;
const secret = new TextEncoder().encode(env.sessionSecret);

export async function createSession(userId: string): Promise<void> {
  const token = await new SignJWT({ sub: userId })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${MAX_AGE_SEC}s`)
    .sign(secret);
  const store = await cookies();
  store.set(COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: MAX_AGE_SEC,
  });
}

export async function destroySession(): Promise<void> {
  const store = await cookies();
  store.delete(COOKIE);
}

async function readSessionUserId(): Promise<string | null> {
  const store = await cookies();
  const token = store.get(COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret);
    return typeof payload.sub === "string" ? payload.sub : null;
  } catch {
    return null;
  }
}

export type SessionUser = Pick<User, "id" | "role" | "balance" | "locale">;

/**
 * 读取当前登录用户。若该用户已被合并到另一个账号，自动跟随到目标账号。
 */
export async function getCurrentUser(): Promise<SessionUser | null> {
  const id = await readSessionUserId();
  if (!id) return null;
  let user = await prisma.user.findUnique({
    where: { id },
    select: { id: true, role: true, balance: true, locale: true, mergedIntoId: true },
  });
  // 最多跟随两层合并，避免异常数据导致死循环
  for (let i = 0; user?.mergedIntoId && i < 2; i++) {
    user = await prisma.user.findUnique({
      where: { id: user.mergedIntoId },
      select: { id: true, role: true, balance: true, locale: true, mergedIntoId: true },
    });
  }
  return user;
}

export async function requireUser(): Promise<SessionUser> {
  const u = await getCurrentUser();
  if (!u) throw new AppError("请先登录", 401, "UNAUTHORIZED");
  return u;
}

export async function requireRole(role: Role): Promise<SessionUser> {
  const u = await requireUser();
  if (u.role !== role) throw new AppError("无权限", 403, "FORBIDDEN");
  return u;
}
