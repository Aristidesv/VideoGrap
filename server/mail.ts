import nodemailer from "nodemailer";

const emailProvider = process.env.EMAIL_PROVIDER || (
  process.env.BREVO_API_KEY ? "brevo" : "smtp"
);
const brevoApiKey = process.env.BREVO_API_KEY;
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

function emailSender() {
  const configuredSender = process.env.EMAIL_FROM || "VidGrab <no-reply@localhost>";
  const match = configuredSender.match(/^\s*(.*?)\s*<([^<>]+)>\s*$/);
  if (match) {
    return { name: match[1].replace(/^["']|["']$/g, ""), email: match[2].trim() };
  }
  return { name: "VidGrab", email: configuredSender.trim() };
}

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
  const text = `Use this link to ${action}. It expires in one hour:\n\n${link}\n\nIf you did not request this, you can ignore this email.`;
  const html = `<p>Use the link below to ${action}. It expires in one hour.</p><p><a href="${link}">${subject}</a></p><p>If you did not request this, you can ignore this email.</p>`;

  if (emailProvider === "brevo") {
    if (!brevoApiKey) {
      throw new Error("BREVO_API_KEY is required when EMAIL_PROVIDER=brevo.");
    }

    const response = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: {
        accept: "application/json",
        "api-key": brevoApiKey,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        sender: emailSender(),
        to: [{ email: options.to }],
        subject,
        textContent: text,
        htmlContent: html,
      }),
      signal: AbortSignal.timeout(15_000),
    });
    if (!response.ok) {
      const details = (await response.text()).slice(0, 500);
      throw new Error(`Brevo email API returned ${response.status}: ${details || response.statusText}`);
    }
    return;
  }

  if (emailProvider !== "smtp") {
    throw new Error(`Unsupported EMAIL_PROVIDER "${emailProvider}". Use "smtp" or "brevo".`);
  }

  if (!transporter) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("Configure SMTP_URL, SMTP_HOST, or EMAIL_PROVIDER=brevo with BREVO_API_KEY to send account emails in production.");
    }
    console.info(`[development email] ${options.purpose} link for ${options.to}: ${link}`);
    return;
  }

  await transporter.sendMail({
    from: process.env.EMAIL_FROM || "VidGrab <no-reply@localhost>",
    to: options.to,
    subject,
    text,
    html,
  });
}
