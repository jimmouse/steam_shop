/**
 * 创建 / 重置验收用测试账号（幂等，可重复执行）。
 * 用法：npx tsx scripts/test-accounts.ts
 * 管理员身份由 .env 的 ADMIN_EMAILS 决定（默认 admin@example.com）。
 */
import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const adminEmails = (process.env.ADMIN_EMAILS ?? "")
  .split(",")
  .map((s) => s.trim().toLowerCase())
  .filter(Boolean);

const accounts = [
  { email: adminEmails[0] ?? "admin@example.com", password: "Admin123456", locale: "zh", note: "管理员（后台 /admin）" },
  { email: "buyer1@test.local", password: "Buyer123456", locale: "zh", note: "普通买家 · 中文" },
  { email: "buyer2@test.local", password: "Buyer123456", locale: "en", note: "普通买家 · English" },
  { email: "buyer3@test.local", password: "Buyer123456", locale: "ru", note: "普通买家 · Русский" },
];

async function main() {
  for (const a of accounts) {
    const email = a.email.toLowerCase();
    const passwordHash = await bcrypt.hash(a.password, 10);
    const role = adminEmails.includes(email) ? "ADMIN" : "USER";
    const existing = await prisma.identity.findUnique({ where: { provider_providerUid: { provider: "EMAIL", providerUid: email } } });
    if (existing) {
      await prisma.identity.update({ where: { id: existing.id }, data: { passwordHash, verifiedAt: new Date() } });
      await prisma.user.update({ where: { id: existing.userId }, data: { role, locale: a.locale } });
    } else {
      await prisma.user.create({
        data: {
          role,
          locale: a.locale,
          identities: { create: { provider: "EMAIL", providerUid: email, passwordHash, verifiedAt: new Date() } },
        },
      });
    }
    console.log(`${role.padEnd(5)} ${email.padEnd(24)} ${a.password.padEnd(14)} ${a.note}`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
