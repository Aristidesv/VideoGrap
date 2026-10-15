import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { Users, Download, Activity, Clock, Crown, Zap, Save, Check, X } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import {
  useGetMe, getGetMeQueryKey,
  useGetAdminStats, getGetAdminStatsQueryKey,
  useGetTopVideos, getGetTopVideosQueryKey,
  useGetRecentDownloads, getGetRecentDownloadsQueryKey,
  useGetAdminPremiumPaymentSettings,
  getGetAdminPremiumPaymentSettingsQueryKey,
  useUpdateAdminPremiumPaymentSettings,
  useGetAdminPremiumPaymentRequests,
  getGetAdminPremiumPaymentRequestsQueryKey,
  useReviewAdminPremiumPaymentRequest,
  type PremiumPaymentSettings,
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
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { data: user, isLoading: userLoading } = useGetMe({ query: { retry: false, queryKey: getGetMeQueryKey() } });
  const { data: stats } = useGetAdminStats({ query: { queryKey: getGetAdminStatsQueryKey() } });
  const { data: topVideos } = useGetTopVideos({ query: { queryKey: getGetTopVideosQueryKey() } });
  const { data: recentDownloads } = useGetRecentDownloads(undefined, { query: { queryKey: getGetRecentDownloadsQueryKey() } });
  const paymentSettingsQuery = useGetAdminPremiumPaymentSettings();
  const paymentRequestsQuery = useGetAdminPremiumPaymentRequests();
  const updatePaymentSettings = useUpdateAdminPremiumPaymentSettings();
  const reviewPaymentRequest = useReviewAdminPremiumPaymentRequest();
  const [paymentSettings, setPaymentSettings] = useState<PremiumPaymentSettings>({
    mobileMoneyDetails: "",
    bankDetails: "",
    paypalDetails: "",
  });

  useEffect(() => {
    if (paymentSettingsQuery.data) setPaymentSettings(paymentSettingsQuery.data);
  }, [paymentSettingsQuery.data]);

  useEffect(() => {
    if (!userLoading && (!user || user.role !== "admin")) {
      setLocation("/");
    }
  }, [user, userLoading, setLocation]);

  if (userLoading || !user) return null;

  const savePaymentSettings = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    updatePaymentSettings.mutate({ data: paymentSettings }, {
      onSuccess: (result) => {
        queryClient.invalidateQueries({ queryKey: getGetAdminPremiumPaymentSettingsQueryKey() });
        queryClient.invalidateQueries({ queryKey: ["/api/premium/payment-settings"] });
        toast({ title: "Payment details saved", description: result.message });
      },
      onError: (error) => {
        toast({
          title: "Could not save payment details",
          description: error.data?.error || "Please try again.",
          variant: "destructive",
        });
      },
    });
  };

  const handlePaymentReview = (id: string, status: "approved" | "rejected") => {
    reviewPaymentRequest.mutate({ id, data: { status } }, {
      onSuccess: (result) => {
        queryClient.invalidateQueries({ queryKey: getGetAdminPremiumPaymentRequestsQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetAdminStatsQueryKey() });
        toast({ title: "Payment request reviewed", description: result.message });
      },
      onError: (error) => {
        toast({
          title: "Could not review payment request",
          description: error.data?.error || "Please try again.",
          variant: "destructive",
        });
      },
    });
  };

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
            <h2 className="font-bold text-lg">Premium payment details</h2>
            <p className="text-sm text-muted-foreground">
              Add the payment instructions users should see. The plan price is fixed at 100 MT.
            </p>
          </CardHeader>
          <CardContent>
            {paymentSettingsQuery.isLoading ? (
              <div className="space-y-3">
                <Skeleton className="h-20 w-full rounded-lg" />
                <Skeleton className="h-20 w-full rounded-lg" />
                <Skeleton className="h-20 w-full rounded-lg" />
              </div>
            ) : paymentSettingsQuery.isError ? (
              <p role="alert" className="text-sm text-destructive">
                Payment settings could not be loaded.
              </p>
            ) : (
              <form onSubmit={savePaymentSettings} className="space-y-4">
                <div className="space-y-2">
                  <label htmlFor="admin-mobile-money-details" className="text-sm font-medium">
                    e-Mola / mobile money account details
                  </label>
                  <Textarea
                    id="admin-mobile-money-details"
                    maxLength={1000}
                    value={paymentSettings.mobileMoneyDetails}
                    onChange={(event) => setPaymentSettings((current) => ({
                      ...current,
                      mobileMoneyDetails: event.target.value,
                    }))}
                    placeholder="Account number and account holder name"
                  />
                </div>
                <div className="space-y-2">
                  <label htmlFor="admin-bank-details" className="text-sm font-medium">
                    Bank account details
                  </label>
                  <Textarea
                    id="admin-bank-details"
                    maxLength={1000}
                    value={paymentSettings.bankDetails}
                    onChange={(event) => setPaymentSettings((current) => ({
                      ...current,
                      bankDetails: event.target.value,
                    }))}
                    placeholder="Bank, account name, account number, and any required reference"
                  />
                </div>
                <div className="space-y-2">
                  <label htmlFor="admin-paypal-details" className="text-sm font-medium">
                    PayPal account details
                  </label>
                  <Textarea
                    id="admin-paypal-details"
                    maxLength={1000}
                    value={paymentSettings.paypalDetails}
                    onChange={(event) => setPaymentSettings((current) => ({
                      ...current,
                      paypalDetails: event.target.value,
                    }))}
                    placeholder="PayPal email or payment instructions"
                  />
                </div>
                <Button type="submit" disabled={updatePaymentSettings.isPending}>
                  <Save className="mr-2 h-4 w-4" />
                  {updatePaymentSettings.isPending ? "Saving..." : "Save payment details"}
                </Button>
              </form>
            )}
          </CardContent>
        </Card>

        <Card className="border-border/50 bg-card/80 backdrop-blur">
          <CardHeader className="pb-2">
            <h2 className="font-bold text-lg">Premium payment confirmations</h2>
            <p className="text-sm text-muted-foreground">
              Approving a request immediately grants Premium access to that user.
            </p>
          </CardHeader>
          <CardContent>
            {paymentRequestsQuery.isLoading ? (
              <div className="space-y-3">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-24 w-full rounded-lg" />)}</div>
            ) : paymentRequestsQuery.isError ? (
              <p role="alert" className="text-sm text-destructive">
                Payment confirmations could not be loaded.
              </p>
            ) : !paymentRequestsQuery.data?.length ? (
              <p className="py-4 text-center text-sm text-muted-foreground">No payment confirmations yet.</p>
            ) : (
              <div className="space-y-3">
                {paymentRequestsQuery.data.map((request) => (
                  <div key={request.id} className="space-y-3 rounded-lg bg-muted/40 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="break-words font-semibold">{request.userName} · {request.amountMzn} MT</p>
                        <p className="break-words text-sm text-muted-foreground">{request.userEmail}</p>
                      </div>
                      <Badge variant={
                        request.status === "approved"
                          ? "default"
                          : request.status === "rejected"
                            ? "destructive"
                            : "secondary"
                      }>
                        {request.status}
                      </Badge>
                    </div>
                    <div className="space-y-1 text-sm">
                      <p><span className="text-muted-foreground">Method:</span> {request.paymentMethod.replace("_", " ")}</p>
                      <p className="break-all"><span className="text-muted-foreground">Reference:</span> {request.transactionReference}</p>
                      {request.notes && <p className="whitespace-pre-wrap break-words"><span className="text-muted-foreground">Notes:</span> {request.notes}</p>}
                      <p className="text-xs text-muted-foreground">{new Date(request.createdAt).toLocaleString()}</p>
                    </div>
                    {request.status === "pending" && (
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          onClick={() => handlePaymentReview(request.id, "approved")}
                          disabled={reviewPaymentRequest.isPending}
                        >
                          <Check className="mr-2 h-4 w-4" />Approve and activate
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => handlePaymentReview(request.id, "rejected")}
                          disabled={reviewPaymentRequest.isPending}
                        >
                          <X className="mr-2 h-4 w-4" />Reject
                        </Button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
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
