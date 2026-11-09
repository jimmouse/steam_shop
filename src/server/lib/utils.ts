import { randomBytes, randomInt } from "node:crypto";

export function generateOrderNo(): string {
  const d = new Date();
  const ymd = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;
  return `SO${ymd}${randomBytes(4).toString("hex").toUpperCase()}`;
}

export function generateTicketNo(): string {
  return `TK${Date.now().toString(36).toUpperCase()}${randomBytes(2).toString("hex").toUpperCase()}`;
}

export function generateVerificationCode(): string {
  return String(randomInt(0, 1_000_000)).padStart(6, "0");
}

export class AppError extends Error {
  constructor(
    message: string,
    public readonly status = 400,
    public readonly code = "BAD_REQUEST",
  ) {
    super(message);
  }
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}
