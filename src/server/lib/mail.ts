import nodemailer, { type Transporter } from "nodemailer";
import { env } from "./env";

let transporter: Transporter | null | undefined;

function getTransporter(): Transporter | null {
  if (transporter !== undefined) return transporter;
  if (!env.smtp.host) {
    transporter = null;
    return null;
  }
  transporter = nodemailer.createTransport({
    host: env.smtp.host,
    port: env.smtp.port,
    secure: env.smtp.secure,
    auth: env.smtp.user ? { user: env.smtp.user, pass: env.smtp.pass } : undefined,
  });
  return transporter;
}

export interface MailMessage {
  to: string;
  subject: string;
  text: string;
  html?: string;
}

/** 未配置 SMTP 时只打印到控制台，便于本地开发。 */
export async function sendMail(msg: MailMessage): Promise<void> {
  const t = getTransporter();
  if (!t) {
    console.log(`\n[mail → ${msg.to}] ${msg.subject}\n${msg.text}\n`);
    return;
  }
  try {
    await t.sendMail({ from: env.smtp.from, ...msg });
  } catch (err) {
    console.error("[mail] send failed:", err);
  }
}
