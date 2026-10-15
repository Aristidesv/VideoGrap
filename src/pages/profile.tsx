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
} from "@/lib/api-client-react";
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
  const { data: user, isLoading } = useGetMe({ query: { retry: false, queryKey: getGetMeQueryKey() } });

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
        <Card className="border-primary/40 bg-gradient-to-br from-primary/10 to-primary/5 backdrop-blur shadow-lg">
          <CardContent className="p-8 space-y-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-amber-500/20 rounded-xl">
                <Crown className="h-6 w-6 text-amber-500" />
              </div>
              <div>
                <h3 className="font-bold text-lg">Upgrade to Premium</h3>
                <p className="text-sm text-muted-foreground">No ads, no limits, maximum speed</p>
              </div>
            </div>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li className="flex items-center gap-2"><span className="text-green-500 font-bold">+</span> Unlimited daily downloads</li>
              <li className="flex items-center gap-2"><span className="text-green-500 font-bold">+</span> No advertisements</li>
              <li className="flex items-center gap-2"><span className="text-green-500 font-bold">+</span> Priority processing speed</li>
            </ul>
            <Button className="w-full h-11 bg-amber-500 hover:bg-amber-600 text-white font-semibold" data-testid="button-upgrade">
              <Crown className="h-4 w-4 mr-2" />
              Upgrade to Premium
            </Button>
          </CardContent>
        </Card>
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
