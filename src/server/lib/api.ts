import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { ZodError, type ZodType } from "zod";
import { AppError } from "./utils";

export function ok<T>(data: T, init?: ResponseInit) {
  return NextResponse.json({ ok: true, data }, init);
}

export function fail(message: string, status = 400, code = "BAD_REQUEST") {
  return NextResponse.json({ ok: false, error: { code, message } }, { status });
}

export async function parseBody<T>(req: Request, schema: ZodType<T>): Promise<T> {
  let json: unknown;
  try {
    json = await req.json();
  } catch {
    throw new AppError("请求体必须是 JSON");
  }
  return schema.parse(json);
}

type Handler<Ctx> = (req: Request, ctx: Ctx) => Promise<Response>;

/** 统一错误处理：AppError → 对应状态码；Zod → 400；其他 → 500。 */
export function handler<Ctx = unknown>(fn: Handler<Ctx>): Handler<Ctx> {
  return async (req, ctx) => {
    try {
      return await fn(req, ctx);
    } catch (err) {
      if (err instanceof AppError) return fail(err.message, err.status, err.code);
      if (err instanceof ZodError) {
        const first = err.issues[0];
        return fail(first ? `${first.path.join(".") || "参数"}: ${first.message}` : "参数错误", 400, "VALIDATION");
      }
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
        return fail("数据已存在（唯一约束冲突）", 409, "CONFLICT");
      }
      console.error(err);
      return fail("服务器内部错误", 500, "INTERNAL");
    }
  };
}

export type RouteCtx<P extends Record<string, string> = Record<string, string>> = { params: Promise<P> };

/** 把 Prisma Decimal / Date 之类序列化成普通 JSON。 */
export function serialize<T>(v: T): T {
  return JSON.parse(
    JSON.stringify(v, (_k, val) => {
      if (val instanceof Prisma.Decimal) return val.toString();
      return val;
    }),
  );
}
