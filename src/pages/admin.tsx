import { useEffect } from "react";
import { useLocation } from "wouter";
import { Users, Download, Activity, Clock, Crown, Zap } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  useGetMe, getGetMeQueryKey,
  useGetAdminStats, getGetAdminStatsQueryKey,
  useGetTopVideos, getGetTopVideosQueryKey,
  useGetRecentDownloads, getGetRecentDownloadsQueryKey,
} from "@/lib/api-client-react";

function StatCard({ icon: Icon, label, value, color }: { icon: any; label: string; value: number | undefined; color: string }) {
  return (
    <Card className="border-border/50 bg-card/80 backdrop-blur">
      <CardContent className="p-6 flex items-center gap-4">
        <div className={`p-3 rounded-xl ${color}`}>
          <Icon className="h-6 w-6 text-white" />
        </div>
        <div>
          <p className="text-sm text-muted-foreground">{label}</p>
          {value !== undefined ? (
            <p className="text-3xl font-extrabold tracking-tight" data-testid={`stat-${label.replace(/\s+/g, '-').toLowerCase()}`}>{value.toLocaleString()}</p>
          ) : (
            <Skeleton className="h-8 w-16 mt-1" />
          )}
        </div>
      </CardContent>
    </Card>
  );
}

const STATUS_COLORS: Record<string, string> = {
  done: "bg-green-500/20 text-green-500",
  processing: "bg-blue-500/20 text-blue-500",
  pending: "bg-amber-500/20 text-amber-500",
  error: "bg-destructive/20 text-destructive",
};

export default function Admin() {
  const [, setLocation] = useLocation();
  const { data: user, isLoading: userLoading } = useGetMe({ query: { retry: false, queryKey: getGetMeQueryKey() } });
  const { data: stats } = useGetAdminStats({ query: { queryKey: getGetAdminStatsQueryKey() } });
  const { data: topVideos } = useGetTopVideos({ query: { queryKey: getGetTopVideosQueryKey() } });
  const { data: recentDownloads } = useGetRecentDownloads(undefined, { query: { queryKey: getGetRecentDownloadsQueryKey() } });

  useEffect(() => {
    if (!userLoading && (!user || user.role !== "admin")) {
      setLocation("/");
    }
  }, [user, userLoading, setLocation]);

  if (userLoading || !user) return null;

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div>
        <h1 className="text-3xl font-extrabold tracking-tight">Admin Dashboard</h1>
        <p className="text-muted-foreground mt-1">Platform overview and management</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <StatCard icon={Users} label="Total Users" value={stats?.totalUsers} color="bg-primary" />
        <StatCard icon={Download} label="Total Downloads" value={stats?.totalDownloads} color="bg-green-600" />
        <StatCard icon={Clock} label="Downloads Today" value={stats?.downloadsToday} color="bg-amber-500" />
        <StatCard icon={Activity} label="Active Jobs" value={stats?.activeJobs} color="bg-blue-600" />
        <StatCard icon={Users} label="Free Users" value={stats?.freeUsers} color="bg-slate-600" />
        <StatCard icon={Crown} label="Premium Users" value={stats?.premiumUsers} color="bg-amber-600" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="border-border/50 bg-card/80 backdrop-blur">
          <CardHeader className="pb-2">
            <h2 className="font-bold text-lg flex items-center gap-2">
              <Zap className="h-5 w-5 text-primary" />
              Most Downloaded Videos
            </h2>
          </CardHeader>
          <CardContent>
            {!topVideos ? (
              <div className="space-y-3">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12 w-full rounded-lg" />)}</div>
            ) : topVideos.length === 0 ? (
              <p className="text-muted-foreground text-sm py-4 text-center">No downloads yet</p>
            ) : (
              <div className="space-y-2">
                {topVideos.map((v, i) => (
                  <div key={i} className="flex items-center gap-3 p-3 rounded-lg bg-muted/40 hover:bg-muted/60 transition-colors">
                    <span className="text-xl font-black text-muted-foreground/50 w-6 shrink-0">#{i + 1}</span>
                    {v.thumbnail && <img src={v.thumbnail} alt="" className="h-10 w-16 rounded object-cover shrink-0" />}
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm leading-tight truncate" title={v.videoTitle}>{v.videoTitle}</p>
                      {v.channel && <p className="text-xs text-muted-foreground">{v.channel}</p>}
                    </div>
                    <Badge variant="secondary" className="shrink-0">{v.downloadCount}x</Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-border/50 bg-card/80 backdrop-blur">
          <CardHeader className="pb-2">
            <h2 className="font-bold text-lg flex items-center gap-2">
              <Clock className="h-5 w-5 text-primary" />
              Recent Downloads
            </h2>
          </CardHeader>
          <CardContent>
            {!recentDownloads ? (
              <div className="space-y-3">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-10 w-full rounded-lg" />)}</div>
            ) : recentDownloads.length === 0 ? (
              <p className="text-muted-foreground text-sm py-4 text-center">No downloads yet</p>
            ) : (
              <div className="space-y-2">
                {recentDownloads.map((d) => (
                  <div key={d.id} className="flex items-center gap-3 p-3 rounded-lg bg-muted/40">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{d.videoTitle || "Unknown"}</p>
                      <p className="text-xs text-muted-foreground">{d.mediaType.toUpperCase()} · {d.formatId}</p>
                    </div>
                    <Badge className={`shrink-0 text-xs border-0 ${STATUS_COLORS[d.status] ?? "bg-muted text-muted-foreground"}`}>
                      {d.status}
                    </Badge>
                    <span className="text-xs text-muted-foreground shrink-0">
                      {new Date(d.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
