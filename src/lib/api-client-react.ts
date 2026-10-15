import {
  useMutation,
  useQuery,
  type QueryKey,
  type UseQueryOptions,
} from "@tanstack/react-query";

export interface ApiError extends Error {
  data?: { error?: string; code?: string };
}

export interface User {
  id: string;
  name: string;
  email: string;
  role: string;
  plan: string;
  downloadsToday: number;
  createdAt: string;
  emailVerified: boolean;
}

export interface VideoInfo {
  url: string;
  title: string;
  thumbnail: string;
  channel: string;
  duration: number;
  viewCount?: number;
  formats: Array<{
    formatId: string;
    type: "video" | "audio";
    label: string;
    quality?: string;
    filesize?: number;
  }>;
}

interface DownloadJob {
  id: string;
  status: "pending" | "processing" | "done" | "error";
  progress?: number;
  error?: string;
  videoTitle: string;
  fileAvailable?: boolean;
}

interface AnalysisRecord {
  id: string;
  videoTitle: string;
  thumbnail?: string;
  videoUrl: string;
  channel: string;
  duration: number;
  analyzedAt: string;
}

interface DownloadRecord {
  id: string;
  videoTitle?: string;
  mediaType: "video" | "audio";
  formatId: string;
  status: DownloadJob["status"];
  createdAt: string;
}

interface QueryOptions<T> {
  query?: Omit<UseQueryOptions<T, ApiError, T, QueryKey>, "queryFn">;
}

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    credentials: "same-origin",
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...init?.headers,
    },
  });

  if (!response.ok) {
    const body = await response.text();
    let message = body || response.statusText;
    let code: string | undefined;
    try {
      const parsed: unknown = JSON.parse(body);
      if (
        typeof parsed === "object" &&
        parsed !== null &&
        "error" in parsed &&
        typeof parsed.error === "string"
      ) {
        message = parsed.error;
      }
      if (
        typeof parsed === "object" &&
        parsed !== null &&
        "code" in parsed &&
        typeof parsed.code === "string"
      ) {
        code = parsed.code;
      }
    } catch {
      if (!body) {
        message = `Request failed (${response.status})`;
      }
    }

    const error: ApiError = Object.assign(new Error(message), {
      data: { error: message, ...(code ? { code } : {}) },
    });
    throw error;
  }

  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

function post<TInput, TOutput>(url: string) {
  return (input: TInput) =>
    request<TOutput>(url, {
      method: "POST",
      body: JSON.stringify({ data: input }),
    });
}

export const getGetMeQueryKey = () => ["/api/auth/me"] as const;
export const getGetDownloadStatusQueryKey = (id: string) =>
  ["/api/downloads", id] as const;
export const getGetAdminStatsQueryKey = () => ["/api/admin/stats"] as const;
export const getGetTopVideosQueryKey = () => ["/api/admin/top-videos"] as const;
export const getGetRecentDownloadsQueryKey = () =>
  ["/api/admin/recent-downloads"] as const;

export function useGetMe(options?: QueryOptions<User>) {
  return useQuery({
    ...options?.query,
    queryKey: options?.query?.queryKey ?? getGetMeQueryKey(),
    queryFn: () => request<User>("/api/auth/me"),
  });
}

export function useLogin() {
  return useMutation<
    User,
    ApiError,
    { data: { email: string; password: string } }
  >({
    mutationFn: ({ data }) => post<typeof data, User>("/api/auth/login")(data),
  });
}

export function useRegister() {
  return useMutation<
    { emailVerificationRequired: boolean; message: string },
    ApiError,
    { data: {
      name: string;
      email: string;
      password: string;
      acceptedTerms: true;
      termsVersion: string;
      privacyVersion: string;
    } }
  >({
    mutationFn: ({ data }) =>
      post<typeof data, { emailVerificationRequired: boolean; message: string }>(
        "/api/auth/register",
      )(data),
  });
}

export function useVerifyEmail() {
  return useMutation<{ message: string }, ApiError, { data: { token: string } }>({
    mutationFn: ({ data }) =>
      post<typeof data, { message: string }>("/api/auth/verify-email")(data),
  });
}

export function useResendVerification() {
  return useMutation<{ message: string }, ApiError, { data: { email: string } }>({
    mutationFn: ({ data }) =>
      post<typeof data, { message: string }>("/api/auth/resend-verification")(data),
  });
}

export function useForgotPassword() {
  return useMutation<{ message: string }, ApiError, { data: { email: string } }>({
    mutationFn: ({ data }) =>
      post<typeof data, { message: string }>("/api/auth/forgot-password")(data),
  });
}

export function useResetPassword() {
  return useMutation<
    { message: string },
    ApiError,
    { data: { token: string; password: string } }
  >({
    mutationFn: ({ data }) =>
      post<typeof data, { message: string }>("/api/auth/reset-password")(data),
  });
}

export function useLogout() {
  return useMutation<void, ApiError, void>({
    mutationFn: () => request<void>("/api/auth/logout", { method: "POST" }),
  });
}

export function useDeleteAccount() {
  return useMutation<
    void,
    ApiError,
    { data: { password: string; confirmation: "ELIMINAR" } }
  >({
    mutationFn: ({ data }) =>
      request<void>("/api/auth/account", {
        method: "DELETE",
        body: JSON.stringify({ data }),
      }),
  });
}

export function useFetchVideoInfo() {
  return useMutation<VideoInfo, ApiError, { data: { url: string } }>({
    mutationFn: ({ data }) =>
      post<typeof data, VideoInfo>("/api/videos/info")(data),
  });
}

export function useCreateDownload() {
  return useMutation<
    DownloadJob,
    ApiError,
    {
      data: {
        url: string;
        formatId: string;
        mediaType: "video" | "audio";
        videoTitle: string;
        thumbnail: string;
        channel: string;
      };
    }
  >({
    mutationFn: ({ data }) =>
      post<typeof data, DownloadJob>("/api/downloads")(data),
  });
}

export function useGetDownloadStatus(id: string, options?: QueryOptions<DownloadJob>) {
  return useQuery({
    ...options?.query,
    queryKey: options?.query?.queryKey ?? getGetDownloadStatusQueryKey(id),
    queryFn: () => request<DownloadJob>(`/api/downloads/${encodeURIComponent(id)}`),
  });
}

export function getDownloadFileUrl(id: string) {
  return `/api/downloads/${encodeURIComponent(id)}/file`;
}

export function useGetHistory(params: { limit?: number }) {
  const query = new URLSearchParams();
  if (params.limit !== undefined) query.set("limit", String(params.limit));
  const suffix = params.limit !== undefined ? `?${query.toString()}` : "";
  return useQuery({
    queryKey: ["/api/history", params],
    queryFn: () =>
      request<{ items: AnalysisRecord[] }>(`/api/history${suffix}`),
  });
}

interface AdminStats {
  totalUsers: number;
  totalDownloads: number;
  downloadsToday: number;
  activeJobs: number;
  freeUsers: number;
  premiumUsers: number;
}

interface TopVideo {
  videoTitle: string;
  thumbnail?: string;
  channel?: string;
  downloadCount: number;
}

export function useGetAdminStats(options?: QueryOptions<AdminStats>) {
  return useQuery({
    ...options?.query,
    queryKey: options?.query?.queryKey ?? getGetAdminStatsQueryKey(),
    queryFn: () => request<AdminStats>("/api/admin/stats"),
  });
}

export function useGetTopVideos(options?: QueryOptions<TopVideo[]>) {
  return useQuery({
    ...options?.query,
    queryKey: options?.query?.queryKey ?? getGetTopVideosQueryKey(),
    queryFn: () => request<TopVideo[]>("/api/admin/top-videos"),
  });
}

export function useGetRecentDownloads(
  _params?: undefined,
  options?: QueryOptions<DownloadRecord[]>,
) {
  return useQuery({
    ...options?.query,
    queryKey: options?.query?.queryKey ?? getGetRecentDownloadsQueryKey(),
    queryFn: () => request<DownloadRecord[]>("/api/admin/recent-downloads"),
  });
}
