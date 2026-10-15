import nodemailer from "nodemailer";

const smtpUrl = process.env.SMTP_URL;
const smtpHost = process.env.SMTP_HOST;

const transporter = smtpUrl
  ? nodemailer.createTransport(smtpUrl)
  : smtpHost
    ? nodemailer.createTransport({
        host: smtpHost,
        port: Number(process.env.SMTP_PORT || 587),
        secure: process.env.SMTP_SECURE === "true",
        auth: process.env.SMTP_USER
          ? {
              user: process.env.SMTP_USER,
              pass: process.env.SMTP_PASSWORD,
            }
          : undefined,
      })
    : undefined;

function applicationUrl() {
  const base = process.env.PUBLIC_APP_URL || (
    process.env.NODE_ENV === "production"
      ? undefined
      : `http://localhost:${process.env.PORT || 3001}`
  );
  if (!base) {
    throw new Error("PUBLIC_APP_URL is required to send account emails in production.");
  }
  return base.replace(/\/+$/, "");
}

export async function sendAccountLink(options: {
  to: string;
  purpose: "verify_email" | "reset_password";
  token: string;
}) {
  const path = options.purpose === "verify_email" ? "/verify-email" : "/reset-password";
  const link = `${applicationUrl()}${path}?token=${encodeURIComponent(options.token)}`;
  const subject = options.purpose === "verify_email"
    ? "Verify your VidGrab email"
    : "Reset your VidGrab password";
  const action = options.purpose === "verify_email"
    ? "verify your email address"
    : "choose a new password";

  if (!transporter) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("Configure SMTP_URL or SMTP_HOST to send account emails in production.");
    }
    console.info(`[development email] ${options.purpose} link for ${options.to}: ${link}`);
    return;
  }

  await transporter.sendMail({
    from: process.env.EMAIL_FROM || "VidGrab <no-reply@localhost>",
    to: options.to,
    subject,
    text: `Use this link to ${action}. It expires in one hour:\n\n${link}\n\nIf you did not request this, you can ignore this email.`,
    html: `<p>Use the link below to ${action}. It expires in one hour.</p><p><a href="${link}">${subject}</a></p><p>If you did not request this, you can ignore this email.</p>`,
  });
}
