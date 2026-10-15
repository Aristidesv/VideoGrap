import { createHash, randomBytes, randomUUID, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import type { NextFunction, Request, Response } from "express";
import { pool } from "./db.js";

const scrypt = promisify(scryptCallback);
const SESSION_COOKIE = "vidgrab_session";
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;
export type AccountTokenPurpose = "verify_email" | "reset_password";

export interface PublicUser {
  id: string;
  name: string;
  email: string;
  role: "user" | "admin";
  plan: "free" | "premium";
  downloadsToday: number;
  createdAt: string;
  emailVerified: boolean;
}

declare global {
  namespace Express {
    interface Request {
      user?: PublicUser;
    }
  }
}

function cookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: SESSION_TTL_MS,
  };
}

function readSessionToken(req: Request) {
  const cookieHeader = req.headers.cookie;
  if (!cookieHeader) return undefined;

  for (const item of cookieHeader.split(";")) {
    const separator = item.indexOf("=");
    if (separator < 0) continue;
    if (item.slice(0, separator).trim() === SESSION_COOKIE) {
      return decodeURIComponent(item.slice(separator + 1).trim());
    }
  }

  return undefined;
}

function hashSessionToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export function hashAccountToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export async function hashPassword(password: string) {
  const salt = randomBytes(16);
  const derivedKey = (await scrypt(password, salt, 64)) as Buffer;
  return `scrypt$${salt.toString("base64url")}$${derivedKey.toString("base64url")}`;
}

export async function verifyPassword(password: string, passwordHash: string) {
  const [algorithm, saltValue, keyValue] = passwordHash.split("$");
  if (algorithm !== "scrypt" || !saltValue || !keyValue) return false;

  const salt = Buffer.from(saltValue, "base64url");
  const expected = Buffer.from(keyValue, "base64url");
  const actual = (await scrypt(password, salt, expected.length)) as Buffer;
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

export async function createSession(userId: string, res: Response) {
  const token = randomBytes(32).toString("base64url");
  const tokenHash = hashSessionToken(token);
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);

  await pool.query(
    "INSERT INTO sessions (token_hash, user_id, expires_at) VALUES ($1, $2, $3)",
    [tokenHash, userId, expiresAt],
  );
  res.cookie(SESSION_COOKIE, token, cookieOptions());
}

export function clearSessionCookie(res: Response) {
  res.clearCookie(SESSION_COOKIE, cookieOptions());
}

export async function removeSession(req: Request, res: Response) {
  const token = readSessionToken(req);
  if (token) {
    await pool.query("DELETE FROM sessions WHERE token_hash = $1", [
      hashSessionToken(token),
    ]);
  }
  clearSessionCookie(res);
}

export async function createAccountToken(
  userId: string,
  purpose: AccountTokenPurpose,
) {
  const token = randomBytes(32).toString("base64url");
  await pool.query(
    "DELETE FROM account_tokens WHERE user_id = $1 AND purpose = $2",
    [userId, purpose],
  );
  await pool.query(
    `INSERT INTO account_tokens (token_hash, user_id, purpose, expires_at)
     VALUES ($1, $2, $3, now() + interval '1 hour')`,
    [hashAccountToken(token), userId, purpose],
  );
  return token;
}

export async function loadPublicUser(userId: string): Promise<PublicUser | undefined> {
  const result = await pool.query<{
    id: string;
    name: string;
    email: string;
    role: "user" | "admin";
    plan: "free" | "premium";
    downloads_today: number;
    created_at: Date;
    email_verified_at: Date | null;
  }>(
    `SELECT u.id, u.name, u.email, u.role, u.plan, u.created_at,
       u.email_verified_at,
       COUNT(j.id) FILTER (
         WHERE j.created_at >=
           date_trunc('day', CURRENT_TIMESTAMP AT TIME ZONE 'UTC') AT TIME ZONE 'UTC'
       )::int AS downloads_today
     FROM users u
     LEFT JOIN download_jobs j ON j.user_id = u.id
     WHERE u.id = $1
     GROUP BY u.id`,
    [userId],
  );
  const row = result.rows[0];
  if (!row) return undefined;

  return {
    id: row.id,
    name: row.name,
    email: row.email,
    role: row.role,
    plan: row.plan,
    downloadsToday: row.downloads_today,
    createdAt: row.created_at.toISOString(),
    emailVerified: row.email_verified_at !== null,
  };
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const token = readSessionToken(req);
  if (!token) {
    res.status(401).json({ error: "Please sign in to continue." });
    return;
  }

  const tokenHash = hashSessionToken(token);
  void pool.query<{ user_id: string }>(
    "SELECT user_id FROM sessions WHERE token_hash = $1 AND expires_at > now()",
    [tokenHash],
  ).then(async ({ rows }) => {
    const session = rows[0];
    if (!session) {
      res.clearCookie(SESSION_COOKIE, cookieOptions());
      res.status(401).json({ error: "Your session has expired. Please sign in again." });
      return;
    }

    const user = await loadPublicUser(session.user_id);
    if (!user) {
      res.clearCookie(SESSION_COOKIE, cookieOptions());
      res.status(401).json({ error: "Your account is no longer available." });
      return;
    }

    if (!user.emailVerified) {
      clearSessionCookie(res);
      res.status(403).json({ error: "Verify your email address before using your account." });
      return;
    }

    req.user = user;
    next();
  }).catch(next);
}

export function optionalAuth(req: Request, res: Response, next: NextFunction) {
  const token = readSessionToken(req);
  if (!token) {
    next();
    return;
  }

  const tokenHash = hashSessionToken(token);
  void pool.query<{ user_id: string }>(
    "SELECT user_id FROM sessions WHERE token_hash = $1 AND expires_at > now()",
    [tokenHash],
  ).then(async ({ rows }) => {
    const session = rows[0];
    if (!session) {
      clearSessionCookie(res);
      next();
      return;
    }

    const user = await loadPublicUser(session.user_id);
    if (user?.emailVerified) req.user = user;
    else clearSessionCookie(res);
    next();
  }).catch(next);
}

export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  if (req.user?.role !== "admin") {
    res.status(403).json({ error: "Administrator access is required." });
    return;
  }
  next();
}

export async function seedAdminAccount() {
  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD;
  if (!email && !password) return;
  if (!email || !password || password.length < 12) {
    throw new Error("Set both ADMIN_EMAIL and ADMIN_PASSWORD (at least 12 characters) to seed an admin.");
  }

  const existing = await pool.query<{ id: string }>(
    "SELECT id FROM users WHERE lower(email) = $1",
    [email],
  );
  if (existing.rowCount) {
    await pool.query(    "UPDATE users SET role = 'admin', email_verified_at = COALESCE(email_verified_at, now()) WHERE id = $1", [
      existing.rows[0].id,
    ]);
    return;
  }

  await pool.query(
    `INSERT INTO users (id, name, email, password_hash, role, email_verified_at)
     VALUES ($1, $2, $3, $4, 'admin', now())`,
    [
      randomUUID(),
      process.env.ADMIN_NAME?.trim() || "Administrator",
      email,
      await hashPassword(password),
    ],
  );
}
