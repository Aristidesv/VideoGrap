import { useLocation } from "wouter";
import { useEffect, useState } from "react";
import { User, Mail, Crown, Download, Calendar, Shield, Trash2 } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  useDeleteAccount,
  useGetMe,
  getGetMeQueryKey,
  useGetPremiumPaymentSettings,
  useGetPremiumPaymentRequests,
  useSubmitPremiumPaymentRequest,
  getGetPremiumPaymentRequestsQueryKey,
  type PremiumPaymentMethod,
} from "@/lib/api-client-react";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";

const FREE_DAILY_LIMIT = 10;

export default function Profile() {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const deleteAccount = useDeleteAccount();
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<PremiumPaymentMethod>("mobile_money");
  const [transactionReference, setTransactionReference] = useState("");
  const [paymentNotes, setPaymentNotes] = useState("");
  const { data: user, isLoading } = useGetMe({ query: { retry: false, queryKey: getGetMeQueryKey() } });
  const paymentSettings = useGetPremiumPaymentSettings();
  const paymentRequests = useGetPremiumPaymentRequests();
  const submitPaymentRequest = useSubmitPremiumPaymentRequest();

  useEffect(() => {
    if (!isLoading && !user) setLocation("/login");
  }, [user, isLoading, setLocation]);

  if (isLoading) {
    return (
      <div className="max-w-xl mx-auto space-y-6 animate-in fade-in duration-500">
        <Skeleton className="h-48 w-full rounded-xl" />
        <Skeleton className="h-32 w-full rounded-xl" />
      </div>
    );
  }

  if (!user) return null;

  const isPremium = user.plan === "premium";
  const downloadsLeft = Math.max(0, FREE_DAILY_LIMIT - user.downloadsToday);
  const pendingPayment = paymentRequests.data?.find((request) => request.status === "pending");
  const paymentDetails = paymentMethod === "mobile_money"
    ? paymentSettings.data?.mobileMoneyDetails
    : paymentMethod === "bank"
      ? paymentSettings.data?.bankDetails
      : paymentSettings.data?.paypalDetails;
  const submitPaymentConfirmation = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    submitPaymentRequest.mutate({
      data: {
        paymentMethod,
        transactionReference,
        notes: paymentNotes,
      },
    }, {
      onSuccess: (result) => {
        queryClient.invalidateQueries({ queryKey: getGetPremiumPaymentRequestsQueryKey() });
        setTransactionReference("");
        setPaymentNotes("");
        toast({
          title: "Payment confirmation submitted",
          description: result.emailNotificationSent
            ? "Your request is awaiting review. The administrator was notified by email."
            : "Your request is saved and awaiting review. The administrator email notification could not be sent.",
        });
      },
      onError: (error) => {
        toast({
          title: "Could not submit payment confirmation",
          description: error.data?.error || "Please try again.",
          variant: "destructive",
        });
      },
    });
  };

  const confirmDeleteAccount = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    deleteAccount.mutate({
      data: { password, confirmation: "ELIMINAR" },
    }, {
      onSuccess: () => {
        queryClient.clear();
        toast({ title: "Account deleted", description: "Your VidGrab account has been deleted." });
        setLocation("/");
      },
      onError: (error) => {
        toast({
          title: "Could not delete account",
          description: error.data?.error || "Please try again.",
          variant: "destructive",
        });
      },
    });
  };

  return (
    <div className="max-w-xl mx-auto space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <Card className="border-border/50 bg-card/80 backdrop-blur shadow-xl overflow-hidden">
        <div className="h-24 bg-gradient-to-br from-primary/80 to-primary/40" />
        <CardContent className="pt-0 pb-8 px-8">
          <div className="-mt-10 mb-4">
            <div className="h-20 w-20 rounded-2xl bg-primary/20 border-4 border-background flex items-center justify-center">
              <User className="h-10 w-10 text-primary" />
            </div>
          </div>
          <div className="space-y-1">
            <div className="flex items-center gap-3">
              <h2 className="text-2xl font-extrabold tracking-tight">{user.name}</h2>
              <Badge
                variant={isPremium ? "default" : "secondary"}
                className={isPremium ? "bg-amber-500 text-white hover:bg-amber-500" : ""}
                data-testid="badge-plan"
              >
                {isPremium ? "Premium" : "Free"}
              </Badge>
              {user.role === "admin" && (
                <Badge variant="outline" className="border-primary text-primary">
                  <Shield className="h-3 w-3 mr-1" />Admin
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-2 text-muted-foreground text-sm">
              <Mail className="h-4 w-4" />
              {user.email}
            </div>
            <div className="flex items-center gap-2 text-muted-foreground text-sm">
              <Calendar className="h-4 w-4" />
              Member since {new Date(user.createdAt).toLocaleDateString("en-US", { month: "long", year: "numeric" })}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="border-border/50 bg-card/80 backdrop-blur">
        <CardHeader className="pb-2">
          <h3 className="font-bold text-lg">Usage Today</h3>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between p-4 rounded-xl bg-muted/50">
            <div className="flex items-center gap-3">
              <Download className="h-5 w-5 text-primary" />
              <span className="font-medium">Downloads today</span>
            </div>
            <span className="font-bold text-xl" data-testid="text-downloads-today">{user.downloadsToday}</span>
          </div>
          {!isPremium && (
            <div className="flex items-center justify-between p-4 rounded-xl bg-muted/50">
              <span className="text-sm text-muted-foreground">Daily limit remaining</span>
              <span className={`font-bold text-lg ${downloadsLeft === 0 ? "text-destructive" : "text-green-500"}`}>
                {downloadsLeft} / {FREE_DAILY_LIMIT}
              </span>
            </div>
          )}
        </CardContent>
      </Card>

      {!isPremium && (
        <>
          <Card className="border-primary/40 bg-gradient-to-br from-primary/10 to-primary/5 backdrop-blur shadow-lg">
            <CardContent className="p-8 space-y-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-amber-500/20 rounded-xl">
                  <Crown className="h-6 w-6 text-amber-500" />
                </div>
                <div>
                  <h3 className="font-bold text-lg">Upgrade to Premium — 100 MT</h3>
                  <p className="text-sm text-muted-foreground">Pay outside VidGrab, then submit your transaction reference for approval.</p>
                </div>
              </div>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li className="flex items-center gap-2"><span className="text-green-500 font-bold">+</span> Unlimited daily downloads</li>
                <li className="flex items-center gap-2"><span className="text-green-500 font-bold">+</span> No advertisements</li>
                <li className="flex items-center gap-2"><span className="text-green-500 font-bold">+</span> Priority processing speed</li>
              </ul>
            </CardContent>
          </Card>

          <Card className="border-border/50 bg-card/80 backdrop-blur">
            <CardHeader className="pb-2">
              <h3 className="font-bold text-lg">Payment details</h3>
              <p className="text-sm text-muted-foreground">
                Send 100 MT using one of the available methods, then enter the payment transaction reference below.
              </p>
            </CardHeader>
            <CardContent className="space-y-5">
              {paymentSettings.isLoading ? (
                <Skeleton className="h-20 w-full rounded-lg" />
              ) : paymentSettings.isError ? (
                <p role="alert" className="text-sm text-destructive">
                  Payment details could not be loaded. Please refresh and try again.
                </p>
              ) : (
                <>
                  <div className="space-y-2">
                    <label className="text-sm font-medium" htmlFor="premium-payment-method">Payment method</label>
                    <Select
                      value={paymentMethod}
                      onValueChange={(value) => {
                        if (value === "mobile_money" || value === "bank" || value === "paypal") {
                          setPaymentMethod(value);
                        }
                      }}
                    >
                      <SelectTrigger id="premium-payment-method">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="mobile_money">e-Mola / mobile money</SelectItem>
                        <SelectItem value="bank">Bank transfer</SelectItem>
                        <SelectItem value="paypal">PayPal</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="rounded-lg bg-muted/50 p-4">
                    <p className="mb-2 text-sm font-semibold">Where to pay</p>
                    {paymentDetails?.trim() ? (
                      <p className="whitespace-pre-wrap break-words text-sm text-muted-foreground">{paymentDetails}</p>
                    ) : (
                      <p className="text-sm text-muted-foreground">
                        These payment details have not been configured yet. Please check back later.
                      </p>
                    )}
                  </div>
                  {!pendingPayment && (
                    <form onSubmit={submitPaymentConfirmation} className="space-y-4">
                      <div className="space-y-2">
                        <label className="text-sm font-medium" htmlFor="premium-transaction-reference">
                          Transaction reference / payment ID
                        </label>
                        <Input
                          id="premium-transaction-reference"
                          required
                          minLength={2}
                          maxLength={200}
                          value={transactionReference}
                          onChange={(event) => setTransactionReference(event.target.value)}
                          placeholder="Enter the reference shown by your payment provider"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-medium" htmlFor="premium-payment-notes">
                          Additional details (optional)
                        </label>
                        <Textarea
                          id="premium-payment-notes"
                          maxLength={1000}
                          value={paymentNotes}
                          onChange={(event) => setPaymentNotes(event.target.value)}
                          placeholder="Name or phone number used for the payment"
                        />
                      </div>
                      <Button
                        type="submit"
                        className="w-full h-11 bg-amber-500 hover:bg-amber-600 text-white font-semibold"
                        disabled={submitPaymentRequest.isPending || !paymentDetails?.trim()}
                        data-testid="button-upgrade"
                      >
                        <Crown className="h-4 w-4 mr-2" />
                        {submitPaymentRequest.isPending ? "Submitting..." : "Submit payment confirmation"}
                      </Button>
                    </form>
                  )}
                </>
              )}
              {paymentRequests.isError && (
                <p role="alert" className="text-sm text-destructive">
                  Your payment request status could not be loaded.
                </p>
              )}
              {paymentRequests.data && paymentRequests.data.length > 0 && (
                <div className="space-y-2 border-t border-border pt-4">
                  <p className="text-sm font-semibold">Payment request history</p>
                  {paymentRequests.data.map((request) => (
                    <div key={request.id} className="flex items-center justify-between gap-3 text-sm">
                      <span className="text-muted-foreground">
                        {request.transactionReference} · {new Date(request.createdAt).toLocaleDateString()}
                      </span>
                      <Badge variant={
                        request.status === "approved"
                          ? "default"
                          : request.status === "rejected"
                            ? "destructive"
                            : "secondary"
                      }>
                        {request.status === "pending" ? "awaiting review" : request.status}
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}

      <Card className="border-destructive/40 bg-card/80">
        <CardHeader className="pb-2">
          <h3 className="font-bold text-lg text-destructive">Delete account</h3>
          <p className="text-sm text-muted-foreground">
            Permanently delete your account, download history and associated files.
            This action cannot be undone.
          </p>
        </CardHeader>
        <CardContent>
          <Button
            variant="destructive"
            onClick={() => setDeleteOpen(true)}
            data-testid="button-delete-account"
          >
            <Trash2 className="mr-2 h-4 w-4" />
            Delete my account
          </Button>
        </CardContent>
      </Card>

      <AlertDialog open={deleteOpen} onOpenChange={(open) => {
        setDeleteOpen(open);
        if (!open) {
          setPassword("");
          setConfirmation("");
          deleteAccount.reset();
        }
      }}>
        <AlertDialogContent>
          <form onSubmit={confirmDeleteAccount} className="space-y-5">
            <AlertDialogHeader>
              <AlertDialogTitle>Delete your account permanently?</AlertDialogTitle>
              <AlertDialogDescription>
                Your profile, download history and downloaded files will be removed.
                Enter your password and type ELIMINAR to confirm.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <div className="space-y-3">
              <label htmlFor="delete-account-password" className="text-sm font-medium">
                Current password
              </label>
              <Input
                id="delete-account-password"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(event) => setPassword(event.target.value)}
              />
              <label htmlFor="delete-account-confirmation" className="text-sm font-medium">
                Type ELIMINAR to confirm
              </label>
              <Input
                id="delete-account-confirmation"
                autoComplete="off"
                required
                value={confirmation}
                onChange={(event) => setConfirmation(event.target.value)}
              />
            </div>
            {deleteAccount.isError && (
              <p role="alert" className="text-sm text-destructive">
                {deleteAccount.error.data?.error || "Could not delete account."}
              </p>
            )}
            <AlertDialogFooter>
              <Button type="button" variant="outline" onClick={() => setDeleteOpen(false)}>
                Cancel
              </Button>
              <Button
                type="submit"
                variant="destructive"
                disabled={
                  deleteAccount.isPending ||
                  !password ||
                  confirmation !== "ELIMINAR"
                }
              >
                {deleteAccount.isPending ? "Deleting..." : "Delete account permanently"}
              </Button>
            </AlertDialogFooter>
          </form>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
