import { spawn } from "node:child_process";
import { mkdir, readdir, rm } from "node:fs/promises";
import path from "node:path";

export interface VideoFormat {
  formatId: string;
  type: "video" | "audio";
  label: string;
  quality?: string;
  filesize?: number;
}

export interface VideoInfo {
  url: string;
  title: string;
  thumbnail: string;
  channel: string;
  duration: number;
  viewCount?: number;
  formats: VideoFormat[];
}

interface YtDlpFormat {
  format_id?: string;
  ext?: string;
  height?: number;
  resolution?: string;
  format_note?: string;
  filesize?: number;
  filesize_approx?: number;
  vcodec?: string;
  acodec?: string;
}

interface YtDlpInfo {
  id?: string;
  title?: string;
  webpage_url?: string;
  original_url?: string;
  thumbnail?: string;
  channel?: string;
  uploader?: string;
  duration?: number;
  view_count?: number;
  formats?: YtDlpFormat[];
}

export class DownloaderError extends Error {
  constructor(message: string, readonly statusCode = 503) {
    super(message);
    this.name = "DownloaderError";
  }
}

function ytDlpPath() {
  return process.env.YT_DLP_PATH || "yt-dlp";
}

function runCommand(
  args: string[],
  onOutput?: (stream: "stdout" | "stderr", chunk: string) => void,
  signal?: AbortSignal,
) {
  return new Promise<{ stdout: string; stderr: string }>((resolve, reject) => {
    const child = spawn(ytDlpPath(), args, { windowsHide: true });
    let stdout = "";
    let stderr = "";
    let settled = false;

    const finishWithError = (error: Error) => {
      if (settled) return;
      settled = true;
      reject(error);
    };
    if (signal?.aborted) {
      child.kill();
      finishWithError(new DownloaderError("Download cancelled.", 499));
    } else {
      signal?.addEventListener("abort", () => child.kill(), { once: true });
    }
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk: string) => {
      stdout = `${stdout}${chunk}`.slice(-8_000_000);
      onOutput?.("stdout", chunk);
    });
    child.stderr.on("data", (chunk: string) => {
      stderr = `${stderr}${chunk}`.slice(-64_000);
      onOutput?.("stderr", chunk);
    });
    child.once("error", (error: NodeJS.ErrnoException) => {
      if (error.code === "ENOENT") {
        finishWithError(new DownloaderError(
          "yt-dlp is not installed or could not be found. Install it and restart the API server.",
        ));
      } else {
        finishWithError(error);
      }
    });
    child.once("close", (code) => {
      if (settled) return;
      if (code === 0) {
        settled = true;
        resolve({ stdout, stderr });
      } else {
        finishWithError(new DownloaderError(
          stderr.trim().split(/\r?\n/).filter(Boolean).slice(-3).join(" ").slice(0, 500) ||
            `yt-dlp exited with code ${code}.`,
          signal?.aborted ? 499 : 422,
        ));
      }
    });
  });
}

function formatIdIsSafe(formatId: string) {
  return /^[a-zA-Z0-9_.+-]{1,200}$/.test(formatId);
}

export async function fetchVideoInfo(url: string): Promise<VideoInfo> {
  const { stdout } = await runCommand([
    "--no-warnings",
    "--no-playlist",
    "--dump-single-json",
    "--skip-download",
    "--",
    url,
  ]);

  let info: YtDlpInfo;
  try {
    info = JSON.parse(stdout) as YtDlpInfo;
  } catch {
    throw new DownloaderError("yt-dlp returned invalid video information.", 502);
  }

  const sourceFormats = info.formats ?? [];
  const bestAudio = sourceFormats.find(
    (format) => format.acodec && format.acodec !== "none" && (!format.vcodec || format.vcodec === "none"),
  );
  const formats: VideoFormat[] = [];
  const seen = new Set<string>();

  for (const format of sourceFormats) {
    if (!format.format_id || !formatIdIsSafe(format.format_id)) continue;
    const hasVideo = Boolean(format.vcodec && format.vcodec !== "none");
    const hasAudio = Boolean(format.acodec && format.acodec !== "none");
    const type = hasVideo ? "video" : hasAudio ? "audio" : undefined;
    if (!type) continue;

    let formatId = format.format_id;
    if (type === "video" && !hasAudio && bestAudio?.format_id) {
      if (!formatIdIsSafe(bestAudio.format_id)) continue;
      formatId = `${formatId}+${bestAudio.format_id}`;
    }
    if (seen.has(`${type}:${formatId}`)) continue;
    seen.add(`${type}:${formatId}`);

    const quality = format.height
      ? `${format.height}p`
      : format.resolution && format.resolution !== "audio only"
        ? format.resolution
        : undefined;
    const label = [
      quality ?? format.format_note,
      format.ext?.toUpperCase(),
      type === "audio" ? "Audio" : undefined,
    ].filter(Boolean).join(" ") || `${type} (${formatId})`;

    formats.push({
      formatId,
      type,
      label,
      ...(quality ? { quality } : {}),
      ...((format.filesize ?? format.filesize_approx)
        ? { filesize: format.filesize ?? format.filesize_approx }
        : {}),
    });
  }

  if (!info.title || formats.length === 0) {
    throw new DownloaderError("No downloadable formats were found for this video.", 422);
  }

  return {
    url: info.webpage_url || info.original_url || url,
    title: info.title,
    thumbnail: info.thumbnail || "",
    channel: info.channel || info.uploader || "",
    duration: Number.isFinite(info.duration) ? Math.max(0, Math.floor(info.duration!)) : 0,
    ...(Number.isFinite(info.view_count) ? { viewCount: info.view_count } : {}),
    formats,
  };
}

export async function downloadVideo(options: {
  id: string;
  url: string;
  formatId: string;
  mediaType: "video" | "audio";
  onProgress: (progress: number) => void;
  signal?: AbortSignal;
}) {
  const directory = path.resolve(process.env.DOWNLOAD_DIR || "server/downloads");
  await mkdir(directory, { recursive: true });

  const outputTemplate = path.join(directory, `${options.id}-%(title).80B.%(ext)s`);
  const args = [
    "--no-warnings",
    "--no-playlist",
    "--newline",
    "--progress",
    "--progress-template",
    "download:%(progress._percent_str)s",
    "--output",
    outputTemplate,
    "--print",
    "after_move:filepath",
  ];

  if (process.env.FFMPEG_LOCATION) {
    args.push("--ffmpeg-location", process.env.FFMPEG_LOCATION);
  }
  if (options.mediaType === "audio") {
    args.push("--extract-audio", "--audio-format", "mp3");
  } else {
    args.push("--merge-output-format", "mp4");
  }
  args.push("--format", options.formatId, "--", options.url);

  let progressText = "";
  let lastProgressUpdate = 0;
  const onOutput = (_stream: "stdout" | "stderr", chunk: string) => {
    progressText = `${progressText}${chunk}`.slice(-2_000);
    const matches = progressText.match(/(\d{1,3}(?:\.\d+)?)%/g);
    const latest = matches?.at(-1);
    if (!latest) return;

    const progress = Math.max(0, Math.min(99, Math.floor(Number.parseFloat(latest))));
    if (Date.now() - lastProgressUpdate < 750) return;
    lastProgressUpdate = Date.now();
    options.onProgress(progress);
  };

  try {
    const { stdout } = await runCommand(args, onOutput, options.signal);
    const filePath = stdout.trim().split(/\r?\n/).filter(Boolean).at(-1);
    if (!filePath || path.dirname(path.resolve(filePath)) !== directory) {
      throw new DownloaderError("yt-dlp completed without returning a safe output file path.", 500);
    }
    return filePath;
  } catch (error) {
    const files = await readdir(directory);
    const partialFiles = files.filter((file) => file.startsWith(`${options.id}-`));
    await Promise.all(partialFiles.map((file) =>
      rm(path.join(directory, file), { force: true })
    ));
    throw error;
  }
}
