import "dotenv/config";
import { randomUUID } from "node:crypto";
import { existsSync, promises as fs } from "node:fs";
import path from "node:path";
import express, { type ErrorRequestHandler } from "express";
import { rateLimit } from "express-rate-limit";
import { z } from "zod";
import {
  clearSessionCookie,
  createAccountToken,
  createSession,
  hashAccountToken,
  hashPassword,
  loadPublicUser,
  optionalAuth,
  removeSession,
  requireAdmin,
  requireAuth,
  seedAdminAccount,
  verifyPassword,
} from "./auth.js";
import { initializeDatabase, pool as database } from "./db.js";
import { downloadVideo, DownloaderError, fetchVideoInfo } from "./downloader.js";
import { sendAccountLink } from "./mail.js";

const app = express();
const freeDailyLimit = 10;
const maxHistoryItems = 100;
const temporaryDownloadRetentionMs = 60 * 60 * 1000;
const currentTermsVersion = "2026-10-14";
const currentPrivacyVersion = "2026-10-14";

app.disable("x-powered-by");
app.use(express.json({ limit: "32kb" }));

function createRateLimit(limit: number, windowMs: number, message: string) {
  return rateLimit({
    limit,
    windowMs,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    handler: (_req, res) => {
      res.status(429).json({ error: message });
    },
  });
}

const loginLimit = createRateLimit(
  10,
  15 * 60 * 1000,
  "Too many login attempts. Try again in 15 minutes.",
);
const registerLimit = createRateLimit(
  5,
  60 * 60 * 1000,
  "Too many account creation attempts. Try again later.",
);
const emailRequestLimit = createRateLimit(
  3,
  60 * 60 * 1000,
  "Too many email requests. Try again in an hour.",
);
const accountTokenLimit = createRateLimit(
  10,
  60 * 60 * 1000,
  "Too many verification or password-reset attempts. Try again later.",
);
const videoAnalysisLimit = createRateLimit(
  20,
  15 * 60 * 1000,
  "Too many video analysis requests. Try again in 15 minutes.",
);
const downloadCreationLimit = createRateLimit(
  10,
  15 * 60 * 1000,
  "Too many download requests. Try again in 15 minutes.",
);
const activeDownloads = new Map<
  string,
  { controller: AbortController; done: Promise<void> }
>();

function getDownloadDirectory() {
  return path.resolve(process.env.DOWNLOAD_DIR || "server/downloads");
}

const registrationSchema = z.object({
  data: z.object({
    name: z.string().trim().min(2).max(120),
    email: z.string().trim().email().max(320),
    password: z.string().min(8).max(128),
    acceptedTerms: z.literal(true),
    termsVersion: z.literal(currentTermsVersion),
    privacyVersion: z.literal(currentPrivacyVersion),
  }),
});
const loginSchema = z.object({
  data: z.object({
    email: z.string().trim().email().max(320),
    password: z.string().min(1).max(128),
  }),
});
const emailSchema = z.object({
  data: z.object({
    email: z.string().trim().email().max(320),
  }),
});
const tokenSchema = z.object({
  data: z.object({
    token: z.string().min(32).max(200),
  }),
});
const resetPasswordSchema = z.object({
  data: z.object({
    token: z.string().min(32).max(200),
    password: z.string().min(8).max(128),
  }),
});
const deleteAccountSchema = z.object({
  data: z.object({
    password: z.string().min(1).max(128),
    confirmation: z.literal("ELIMINAR"),
  }),
});
const videoUrlSchema = z.object({
  data: z.object({
    url: z.string().url().max(2048).refine(isYouTubeUrl, "Only YouTube URLs are supported."),
  }),
});
const createDownloadSchema = z.object({
  data: z.object({
    url: z.string().url().max(2048).refine(isYouTubeUrl, "Only YouTube URLs are supported."),
    formatId: z.string().regex(/^[a-zA-Z0-9_.+-]{1,200}$/),
    mediaType: z.enum(["video", "audio"]),
  }),
});

function isYouTubeUrl(value: string) {
  try {
    const url = new URL(value);
    const host = url.hostname.toLowerCase();
    return (
      url.protocol === "https:" &&
      (host === "youtube.com" ||
        host.endsWith(".youtube.com") ||
        host === "youtu.be")
    );
  } catch {
    return false;
  }
}

function invalidInput(res: express.Response, error: z.ZodError) {
  res.status(400).json({ error: error.issues[0]?.message || "Invalid request." });
}

function respondWithError(res: express.Response, error: unknown) {
  if (error instanceof DownloaderError) {
    res.status(error.statusCode).json({ error: error.message });
    return;
  }
  throw error;
}

app.get("/api/health", async (_req, res, next) => {
  try {
    await database.query("SELECT 1");
    res.json({ status: "ok", database: "connected" });
  } catch (error) {
    next(error);
  }
});

app.post("/api/auth/register", registerLimit, async (req, res, next) => {
  const parsed = registrationSchema.safeParse(req.body);
  if (!parsed.success) {
    invalidInput(res, parsed.error);
    return;
  }

  const {
    name,
    email,
    password,
    termsVersion,
    privacyVersion,
  } = parsed.data.data;
  const normalizedEmail = email.toLowerCase();
  try {
    const id = randomUUID();
    const result = await database.query(
      `INSERT INTO users (id, name, email, password_hash)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (lower(email)) DO NOTHING
       RETURNING id`,
      [id, name, normalizedEmail, await hashPassword(password)],
    );
    if (result.rowCount === 0) {
      res.status(409).json({ error: "An account with this email already exists." });
      return;
    }

    await database.query(
      `UPDATE users SET terms_accepted_at = now(), terms_version = $2,
         privacy_version = $3 WHERE id = $1`,
      [id, termsVersion, privacyVersion],
    );
    const token = await createAccountToken(id, "verify_email");
    await sendAccountLink({
      to: normalizedEmail,
      purpose: "verify_email",
      token,
    });
    res.status(201).json({
      emailVerificationRequired: true,
      message: "Check your email for a verification link before signing in.",
    });
  } catch (error) {
    next(error);
  }
});

app.post("/api/auth/login", loginLimit, async (req, res, next) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    invalidInput(res, parsed.error);
    return;
  }

  try {
    const result = await database.query<{
      id: string;
      password_hash: string;
    }>(
      "SELECT id, password_hash FROM users WHERE lower(email) = $1",
      [parsed.data.data.email.toLowerCase()],
    );
    const account = result.rows[0];
    if (!account || !(await verifyPassword(parsed.data.data.password, account.password_hash))) {
      res.status(401).json({ error: "Invalid email or password." });
      return;
    }

    const user = await loadPublicUser(account.id);
    if (!user?.emailVerified) {
      res.status(403).json({
        error: "Verify your email address before signing in.",
        code: "EMAIL_NOT_VERIFIED",
      });
      return;
    }

    await createSession(account.id, res);
    res.json(user);
  } catch (error) {
    next(error);
  }
});

app.post("/api/auth/verify-email", accountTokenLimit, async (req, res, next) => {
  const parsed = tokenSchema.safeParse(req.body);
  if (!parsed.success) {
    invalidInput(res, parsed.error);
    return;
  }

  const client = await database.connect();
  try {
    await client.query("BEGIN");
    const result = await client.query<{ user_id: string }>(
      `SELECT user_id FROM account_tokens
       WHERE token_hash = $1 AND purpose = 'verify_email' AND expires_at > now()
       FOR UPDATE`,
      [hashAccountToken(parsed.data.data.token)],
    );
    const token = result.rows[0];
    if (!token) {
      await client.query("ROLLBACK");
      res.status(400).json({ error: "This verification link is invalid or expired. Request a new one." });
      return;
    }

    await client.query("UPDATE users SET email_verified_at = now() WHERE id = $1", [
      token.user_id,
    ]);
    await client.query("DELETE FROM account_tokens WHERE token_hash = $1", [
      hashAccountToken(parsed.data.data.token),
    ]);
    await client.query("COMMIT");
    res.json({ message: "Your email is verified. You can now sign in." });
  } catch (error) {
    await client.query("ROLLBACK");
    next(error);
  } finally {
    client.release();
  }
});

async function sendEmailVerification(emailValue: string) {
  const email = emailValue.toLowerCase();
  const result = await database.query<{ id: string }>(
    "SELECT id FROM users WHERE lower(email) = $1 AND email_verified_at IS NULL",
    [email],
  );
  const user = result.rows[0];
  if (!user) return;

  const token = await createAccountToken(user.id, "verify_email");
  await sendAccountLink({ to: email, purpose: "verify_email", token });
}

app.post("/api/auth/resend-verification", emailRequestLimit, async (req, res, next) => {
  const parsed = emailSchema.safeParse(req.body);
  if (!parsed.success) {
    invalidInput(res, parsed.error);
    return;
  }

  try {
    await sendEmailVerification(parsed.data.data.email);
    res.json({
      message: "If this address has an account that needs verification, a new link will be sent.",
    });
  } catch (error) {
    next(error);
  }
});

app.post("/api/auth/forgot-password", emailRequestLimit, async (req, res, next) => {
  const parsed = emailSchema.safeParse(req.body);
  if (!parsed.success) {
    invalidInput(res, parsed.error);
    return;
  }

  try {
    const email = parsed.data.data.email.toLowerCase();
    const result = await database.query<{ id: string }>(
      "SELECT id FROM users WHERE lower(email) = $1 AND email_verified_at IS NOT NULL",
      [email],
    );
    const user = result.rows[0];
    if (user) {
      const token = await createAccountToken(user.id, "reset_password");
      await sendAccountLink({ to: email, purpose: "reset_password", token });
    }
    res.json({
      message: "If an account exists for that address, password reset instructions will be sent.",
    });
  } catch (error) {
    next(error);
  }
});

app.post("/api/auth/reset-password", accountTokenLimit, async (req, res, next) => {
  const parsed = resetPasswordSchema.safeParse(req.body);
  if (!parsed.success) {
    invalidInput(res, parsed.error);
    return;
  }

  const tokenHash = hashAccountToken(parsed.data.data.token);
  const client = await database.connect();
  try {
    await client.query("BEGIN");
    const result = await client.query<{ user_id: string }>(
      `SELECT user_id FROM account_tokens
       WHERE token_hash = $1 AND purpose = 'reset_password' AND expires_at > now()
       FOR UPDATE`,
      [tokenHash],
    );
    const token = result.rows[0];
    if (!token) {
      await client.query("ROLLBACK");
      res.status(400).json({ error: "This password reset link is invalid or expired. Request a new one." });
      return;
    }

    await client.query(
      "UPDATE users SET password_hash = $2, updated_at = now() WHERE id = $1",
      [token.user_id, await hashPassword(parsed.data.data.password)],
    );
    await client.query("DELETE FROM sessions WHERE user_id = $1", [token.user_id]);
    await client.query("DELETE FROM account_tokens WHERE user_id = $1", [
      token.user_id,
    ]);
    await client.query("COMMIT");
    res.json({ message: "Password updated. Sign in with your new password." });
  } catch (error) {
    await client.query("ROLLBACK");
    next(error);
  } finally {
    client.release();
  }
});

app.post("/api/auth/logout", requireAuth, async (req, res, next) => {
  try {
    await removeSession(req, res);
    res.status(204).end();
  } catch (error) {
    next(error);
  }
});

app.get("/api/auth/me", requireAuth, (req, res) => {
  res.json(req.user);
});

app.delete("/api/auth/account", requireAuth, async (req, res, next) => {
  const parsed = deleteAccountSchema.safeParse(req.body);
  if (!parsed.success) {
    invalidInput(res, parsed.error);
    return;
  }

  const userId = req.user!.id;
  const client = await database.connect();
  let transactionOpen = false;
  let files: { id: string; file_path: string | null }[] = [];
  try {
    await client.query("BEGIN");
    transactionOpen = true;
    await client.query("SELECT pg_advisory_xact_lock($1, $2)", [24680, 1]);
    const account = await client.query<{ password_hash: string; role: string }>(
      "SELECT password_hash, role FROM users WHERE id = $1 FOR UPDATE",
      [userId],
    );
    const current = account.rows[0];
    if (!current || !(await verifyPassword(parsed.data.data.password, current.password_hash))) {
      await client.query("ROLLBACK");
      transactionOpen = false;
      res.status(401).json({ error: "Password is incorrect." });
      return;
    }

    const jobs = await client.query<{ id: string }>(
      "SELECT id FROM download_jobs WHERE user_id = $1",
      [userId],
    );
    const jobIds = jobs.rows.map((job) => job.id);
    const activeJobs = jobIds
      .map((id) => activeDownloads.get(id))
      .filter((job): job is NonNullable<typeof job> => Boolean(job));
    for (const job of activeJobs) job.controller.abort();
    await Promise.all(activeJobs.map((job) => job.done));

    const downloadFiles = await client.query<{ id: string; file_path: string | null }>(
      "SELECT id, file_path FROM download_jobs WHERE user_id = $1",
      [userId],
    );
    files = downloadFiles.rows;
    if (current.role === "admin") {
      const admins = await client.query<{ count: number }>(
        "SELECT count(*)::int AS count FROM users WHERE role = 'admin'",
      );
      if (admins.rows[0].count <= 1) {
        await client.query("ROLLBACK");
        transactionOpen = false;
        res.status(409).json({
          error: "This is the only administrator account. Promote another administrator before deleting it.",
        });
        return;
      }
    }

    await client.query("DELETE FROM users WHERE id = $1", [userId]);
    await client.query("COMMIT");
    transactionOpen = false;
  } catch (error) {
    if (transactionOpen) {
      await client.query("ROLLBACK");
    }
    next(error);
    return;
  } finally {
    client.release();
  }

  clearSessionCookie(res);
  try {
    const downloadDirectory = path.resolve(process.env.DOWNLOAD_DIR || "server/downloads");
    const filePaths = files.flatMap((row) => [
      ...(row.file_path ? [row.file_path] : []),
      path.join(downloadDirectory, `${row.id}-`),
    ]);
    const cleanup = await Promise.allSettled(filePaths.map(async (filePath) => {
      const resolvedPath = path.resolve(filePath);
      if (!resolvedPath.startsWith(`${downloadDirectory}${path.sep}`)) return;
      if (resolvedPath.endsWith("-")) {
        const names = await fs.readdir(downloadDirectory).catch((error: NodeJS.ErrnoException) => {
          if (error.code === "ENOENT") return [];
          throw error;
        });
        const prefix = path.basename(resolvedPath);
        await Promise.all(names
          .filter((name) => name.startsWith(prefix))
          .map((name) => fs.rm(path.join(downloadDirectory, name), { force: true })));
        return;
      }
      await fs.rm(resolvedPath, { force: true });
    }));
    for (const result of cleanup) {
      if (result.status === "rejected") {
        console.error("Could not remove every file for a deleted account:", result.reason);
      }
    }
  } catch (error) {
    console.error("Could not remove every file for a deleted account:", error);
  }
  res.status(204).end();
});

app.post("/api/videos/info", videoAnalysisLimit, optionalAuth, async (req, res, next) => {
  const parsed = videoUrlSchema.safeParse(req.body);
  if (!parsed.success) {
    invalidInput(res, parsed.error);
    return;
  }
  try {
    const info = await fetchVideoInfo(parsed.data.data.url);
    if (req.user) {
      await database.query(
        `INSERT INTO analysis_history
          (id, user_id, video_url, video_title, thumbnail, channel, duration)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          randomUUID(),
          req.user.id,
          info.url,
          info.title,
          info.thumbnail || null,
          info.channel,
          info.duration,
        ],
      );
      await database.query(
        `DELETE FROM analysis_history
         WHERE id IN (
           SELECT id FROM analysis_history
           WHERE user_id = $1
           ORDER BY analyzed_at DESC, id DESC
           OFFSET $2
         )`,
        [req.user.id, maxHistoryItems],
      );
    }
    res.json(info);
  } catch (error) {
    try {
      respondWithError(res, error);
    } catch (unexpected) {
      next(unexpected);
    }
  }
});

app.post("/api/downloads", downloadCreationLimit, requireAuth, async (req, res, next) => {
  const parsed = createDownloadSchema.safeParse(req.body);
  if (!parsed.success) {
    invalidInput(res, parsed.error);
    return;
  }

  const { url, formatId, mediaType } = parsed.data.data;
  try {
    const info = await fetchVideoInfo(url);
    if (!info.formats.some((format) =>
      format.formatId === formatId && format.type === mediaType
    )) {
      res.status(400).json({ error: "The selected format is not available for this video." });
      return;
    }

    const client = await database.connect();
    const id = randomUUID();
    try {
      await client.query("BEGIN");
      const account = await client.query<{ plan: "free" | "premium" }>(
        "SELECT plan FROM users WHERE id = $1 FOR UPDATE",
        [req.user!.id],
      );
      if (!account.rowCount) {
        await client.query("ROLLBACK");
        res.status(401).json({ error: "Your account is no longer available." });
        return;
      }

      if (account.rows[0].plan === "free") {
        const count = await client.query<{ downloads_today: number }>(
          `SELECT count(*)::int AS downloads_today
           FROM download_jobs
           WHERE user_id = $1
             AND created_at >=
               date_trunc('day', CURRENT_TIMESTAMP AT TIME ZONE 'UTC') AT TIME ZONE 'UTC'`,
          [req.user!.id],
        );
        if (count.rows[0].downloads_today >= freeDailyLimit) {
          await client.query("ROLLBACK");
          res.status(429).json({ error: `The free plan allows ${freeDailyLimit} downloads per day.` });
          return;
        }
      }

      await client.query(
        `INSERT INTO download_jobs
          (id, user_id, video_url, video_title, thumbnail, channel, format_id, media_type)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [
          id,
          req.user!.id,
          info.url,
          info.title,
          info.thumbnail || null,
          info.channel,
          formatId,
          mediaType,
        ],
      );
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }

    res.status(202).json({ id, status: "pending", videoTitle: info.title });
    const controller = new AbortController();
    let resolveDone!: () => void;
    const done = new Promise<void>((resolve) => {
      resolveDone = resolve;
    });
    activeDownloads.set(id, { controller, done });
    setImmediate(() => {
      void processDownload(id, info.url, formatId, mediaType, controller.signal)
        .finally(() => {
          activeDownloads.delete(id);
          resolveDone();
        });
    });
  } catch (error) {
    if (error instanceof DownloaderError) {
      res.status(error.statusCode).json({ error: error.message });
      return;
    }
    next(error);
  }
});

async function processDownload(
  id: string,
  url: string,
  formatId: string,
  mediaType: "video" | "audio",
  signal: AbortSignal,
) {
  try {
    await database.query(
      "UPDATE download_jobs SET status = 'processing', updated_at = now() WHERE id = $1",
      [id],
    );
    const filePath = await downloadVideo({
      id,
      url,
      formatId,
      mediaType,
      signal,
      onProgress: (progress) => {
        void database.query(
          "UPDATE download_jobs SET progress = $2, updated_at = now() WHERE id = $1",
          [id, progress],
        ).catch((error: unknown) => {
          console.error(`Unable to update progress for download ${id}:`, error);
        });
      },
    });
    await database.query(
      `UPDATE download_jobs
       SET status = 'done', progress = 100, file_path = $2,
           file_expires_at = now() + interval '1 hour',
           error = NULL, updated_at = now(), finished_at = now()
       WHERE id = $1`,
      [id, filePath],
    );
  } catch (error) {
    if (signal.aborted) return;
    const message = error instanceof Error
      ? error.message.slice(0, 1000)
      : "The download failed.";
    console.error(`Download ${id} failed:`, message);
    await database.query(
      `UPDATE download_jobs
       SET status = 'error', error = $2, updated_at = now(), finished_at = now()
       WHERE id = $1`,
      [id, message],
    );
  }
}

app.get("/api/downloads/:id", requireAuth, async (req, res, next) => {
  try {
    const result = await database.query<{
      id: string;
      status: string;
      progress: number;
      error: string | null;
      video_title: string;
      file_available: boolean;
    }>(
      `SELECT id, status, progress, error, video_title,
          (file_path IS NOT NULL AND file_expires_at > now()) AS file_available
       FROM download_jobs WHERE id = $1 AND user_id = $2`,
      [req.params.id, req.user!.id],
    );
    const job = result.rows[0];
    if (!job) {
      res.status(404).json({ error: "Download job not found." });
      return;
    }
    res.json({
      id: job.id,
      status: job.status,
      progress: job.progress,
      error: job.error,
      videoTitle: job.video_title,
      fileAvailable: job.file_available,
    });
  } catch (error) {
    next(error);
  }
});

app.get("/api/downloads/:id/file", requireAuth, async (req, res, next) => {
  try {
    const result = await database.query<{
      file_path: string;
      video_title: string;
    }>(
      `SELECT file_path, video_title
       FROM download_jobs
       WHERE id = $1 AND user_id = $2 AND status = 'done'
         AND file_path IS NOT NULL AND file_expires_at > now()
       `,
      [req.params.id, req.user!.id],
    );
    const job = result.rows[0];
    if (!job) {
      res.status(404).json({ error: "Completed download file not found." });
      return;
    }

    const downloadDir = getDownloadDirectory();
    const filePath = path.resolve(job.file_path);
    if (!filePath.startsWith(`${downloadDir}${path.sep}`) || !existsSync(filePath)) {
      res.status(404).json({ error: "Completed download file not found." });
      return;
    }

    const safeName = job.video_title.replace(/[<>:"/\\|?*\u0000-\u001f]/g, "_").slice(0, 120);
    res.setHeader("Cache-Control", "no-store");
    res.download(filePath, `${safeName}${path.extname(filePath)}`, (error) => {
      if (error) {
        console.error(`Could not deliver download ${req.params.id}:`, error);
        if (!res.headersSent) next(error);
        return;
      }

      void database.query(
        `UPDATE download_jobs
         SET file_path = NULL, file_expires_at = NULL
         WHERE id = $1 AND user_id = $2 AND file_path = $3`,
        [req.params.id, req.user!.id, job.file_path],
      ).then(() => fs.rm(filePath, { force: true })).catch((cleanupError: unknown) => {
        console.error(`Could not finalize delivered download ${req.params.id}:`, cleanupError);
      });
    });
  } catch (error) {
    next(error);
  }
});

app.get("/api/history", requireAuth, async (req, res, next) => {
  const limitValue = Number(req.query.limit ?? 50);
  if (!Number.isInteger(limitValue) || limitValue < 1 || limitValue > maxHistoryItems) {
    res.status(400).json({ error: `limit must be an integer between 1 and ${maxHistoryItems}.` });
    return;
  }

  try {
    const result = await database.query(
      `SELECT id, video_title AS "videoTitle", thumbnail,
          video_url AS "videoUrl", channel, duration,
          analyzed_at AS "analyzedAt"
       FROM analysis_history
       WHERE user_id = $1
       ORDER BY analyzed_at DESC, id DESC
       LIMIT $2`,
      [req.user!.id, limitValue],
    );
    res.json({ items: result.rows });
  } catch (error) {
    next(error);
  }
});

async function cleanupExpiredDownloadFiles() {
  const downloadDir = getDownloadDirectory();
  let entries;
  try {
    entries = await fs.readdir(downloadDir, { withFileTypes: true });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return;
    throw error;
  }

  const cutoff = Date.now() - temporaryDownloadRetentionMs;
  for (const entry of entries) {
    if (!entry.isFile()) continue;
    const filePath = path.resolve(downloadDir, entry.name);
    try {
      const stats = await fs.stat(filePath);
      if (stats.mtimeMs > cutoff) continue;
      await database.query(
        `UPDATE download_jobs
         SET file_path = NULL, file_expires_at = NULL
         WHERE file_path = $1`,
        [filePath],
      );
      await fs.rm(filePath, { force: true });
    } catch (error) {
      console.error(`Could not clean expired download ${filePath}:`, error);
    }
  }
}

app.get("/api/admin/stats", requireAuth, requireAdmin, async (_req, res, next) => {
  try {
    const result = await database.query<{
      total_users: number;
      total_downloads: number;
      downloads_today: number;
      active_jobs: number;
      free_users: number;
      premium_users: number;
    }>(
      `SELECT
         (SELECT count(*)::int FROM users) AS total_users,
         (SELECT count(*)::int FROM download_jobs) AS total_downloads,
         (SELECT count(*)::int FROM download_jobs
          WHERE created_at >=
            date_trunc('day', CURRENT_TIMESTAMP AT TIME ZONE 'UTC') AT TIME ZONE 'UTC') AS downloads_today,
         (SELECT count(*)::int FROM download_jobs
          WHERE status IN ('pending', 'processing')) AS active_jobs,
         (SELECT count(*)::int FROM users WHERE plan = 'free') AS free_users,
         (SELECT count(*)::int FROM users WHERE plan = 'premium') AS premium_users`,
    );
    const stats = result.rows[0];
    res.json({
      totalUsers: stats.total_users,
      totalDownloads: stats.total_downloads,
      downloadsToday: stats.downloads_today,
      activeJobs: stats.active_jobs,
      freeUsers: stats.free_users,
      premiumUsers: stats.premium_users,
    });
  } catch (error) {
    next(error);
  }
});

app.get("/api/admin/top-videos", requireAuth, requireAdmin, async (_req, res, next) => {
  try {
    const result = await database.query(
      `SELECT video_title AS "videoTitle", thumbnail, channel,
          count(*)::int AS "downloadCount"
       FROM download_jobs
       WHERE status = 'done'
       GROUP BY video_title, thumbnail, channel
       ORDER BY count(*) DESC, max(created_at) DESC
       LIMIT 10`,
    );
    res.json(result.rows);
  } catch (error) {
    next(error);
  }
});

app.get("/api/admin/recent-downloads", requireAuth, requireAdmin, async (_req, res, next) => {
  try {
    const result = await database.query(
      `SELECT id, video_title AS "videoTitle", media_type AS "mediaType",
          format_id AS "formatId", status, created_at AS "createdAt"
       FROM download_jobs
       ORDER BY created_at DESC
       LIMIT 20`,
    );
    res.json(result.rows);
  } catch (error) {
    next(error);
  }
});

app.use("/api", (_req, res) => {
  res.status(404).json({ error: "API endpoint not found." });
});

if (process.env.NODE_ENV === "production") {
  const publicDirectory = path.resolve(process.cwd(), "dist", "public");
  app.use(express.static(publicDirectory));
  app.get(/.*/, (_req, res, next) => {
    res.sendFile(path.join(publicDirectory, "index.html"), (error) => {
      if (error) next(error);
    });
  });
}

const errorHandler: ErrorRequestHandler = (error, _req, res, _next) => {
  console.error("API request failed:", error);
  if (res.headersSent) return;
  res.status(500).json({ error: "An internal server error occurred." });
};
app.use(errorHandler);

async function start() {
  await initializeDatabase();
  await cleanupExpiredDownloadFiles();
  const cleanupTimer = setInterval(() => {
    void cleanupExpiredDownloadFiles().catch((error: unknown) => {
      console.error("Unable to clean expired download files:", error);
    });
  }, 5 * 60 * 1000);
  cleanupTimer.unref();
  await database.query("DELETE FROM sessions WHERE expires_at <= now()");
  await database.query(
    `UPDATE download_jobs
     SET status = 'error', error = 'The server restarted before this download completed.',
         finished_at = now(), updated_at = now()
     WHERE status IN ('pending', 'processing')`,
  );
  await seedAdminAccount();

  const port = Number(
    process.env.NODE_ENV === "production"
      ? process.env.PORT || process.env.API_PORT || 3101
      : process.env.API_PORT || 3101,
  );
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error(`Invalid API server port value: "${port}"`);
  }

  const server = app.listen(port, "0.0.0.0", () => {
    console.log(`VidGrab API listening on http://localhost:${port}`);
  });

  for (const signal of ["SIGINT", "SIGTERM"] as const) {
    process.once(signal, () => {
      server.close(() => {
        void database.end().finally(() => process.exit(0));
      });
    });
  }
}

start().catch((error: unknown) => {
  console.error("Unable to start the VidGrab API:", error);
  process.exitCode = 1;
  void database.end();
});
