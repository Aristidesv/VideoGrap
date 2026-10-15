const mailgunApiKey = process.env.MAILGUN_API_KEY;
const mailgunDomain = process.env.MAILGUN_DOMAIN;
const mailgunApiBaseUrl = (process.env.MAILGUN_API_BASE_URL || "https://api.mailgun.net").replace(/\/+$/, "");

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

  if (!mailgunApiKey && !mailgunDomain && process.env.NODE_ENV !== "production") {
    console.info(`[development email] ${options.purpose} link for ${options.to}: ${link}`);
    return;
  }

  if (!mailgunApiKey || !mailgunDomain) {
    throw new Error("MAILGUN_API_KEY and MAILGUN_DOMAIN are required to send account emails.");
  }

  const body = new URLSearchParams({
    from: process.env.EMAIL_FROM || `VidGrab <no-reply@${mailgunDomain}>`,
    to: options.to,
    subject,
    text,
    html,
  });
  const response = await fetch(
    `${mailgunApiBaseUrl}/v3/${encodeURIComponent(mailgunDomain)}/messages`,
    {
      method: "POST",
      headers: {
        authorization: `Basic ${Buffer.from(`api:${mailgunApiKey}`).toString("base64")}`,
        "content-type": "application/x-www-form-urlencoded",
      },
      body,
      signal: AbortSignal.timeout(15_000),
    },
  );
  if (!response.ok) {
    const details = (await response.text()).slice(0, 500);
    throw new Error(`Mailgun email API returned ${response.status}: ${details || response.statusText}`);
  }
}

export async function sendPremiumPaymentNotification(options: {
  userName: string;
  userEmail: string;
  paymentMethod: string;
  transactionReference: string;
  notes: string;
}) {
  const to = process.env.PREMIUM_NOTIFICATION_EMAIL?.trim() ||
    process.env.ADMIN_EMAIL?.trim();
  if (!to) {
    throw new Error("ADMIN_EMAIL is required to notify the administrator of premium payment requests.");
  }

  if (!mailgunApiKey && !mailgunDomain && process.env.NODE_ENV !== "production") {
    console.info(
      `[development email] Premium payment request from ${options.userEmail} (${options.paymentMethod}, reference: ${options.transactionReference}) for ${to}`,
    );
    return false;
  }

  if (!mailgunApiKey || !mailgunDomain) {
    throw new Error("MAILGUN_API_KEY and MAILGUN_DOMAIN are required to send premium payment notifications.");
  }

  const subject = "New VidGrab Premium payment request";
  const text = [
    "A user submitted a Premium payment request.",
    `Name: ${options.userName}`,
    `Email: ${options.userEmail}`,
    `Payment method: ${options.paymentMethod}`,
    "Amount: 100 MT",
    `Transaction reference: ${options.transactionReference}`,
    `Notes: ${options.notes || "(none)"}`,
  ].join("\n");
  const body = new URLSearchParams({
    from: process.env.EMAIL_FROM || `VidGrab <no-reply@${mailgunDomain}>`,
    to,
    subject,
    text,
  });
  const response = await fetch(
    `${mailgunApiBaseUrl}/v3/${encodeURIComponent(mailgunDomain)}/messages`,
    {
      method: "POST",
      headers: {
        authorization: `Basic ${Buffer.from(`api:${mailgunApiKey}`).toString("base64")}`,
        "content-type": "application/x-www-form-urlencoded",
      },
      body,
      signal: AbortSignal.timeout(15_000),
    },
  );
  if (!response.ok) {
    const details = (await response.text()).slice(0, 500);
    throw new Error(`Mailgun email API returned ${response.status}: ${details || response.statusText}`);
  }
  return true;
}
