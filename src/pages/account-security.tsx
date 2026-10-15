import { useEffect, useState } from "react";
import { Link, useLocation } from "wouter";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { ArrowLeft, KeyRound, Mail, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { useForgotPassword, useResetPassword, useVerifyEmail } from "@/lib/api-client-react";

const emailSchema = z.object({
  email: z.string().email("Enter a valid email address."),
});

const passwordSchema = z.object({
  password: z.string().min(8, "Password must have at least 8 characters."),
  confirmPassword: z.string(),
}).refine((values) => values.password === values.confirmPassword, {
  path: ["confirmPassword"],
  message: "Passwords do not match.",
});

function VerificationPage() {
  const [token] = useState(() =>
    new URLSearchParams(window.location.search).get("token") || ""
  );
  const [email] = useState(() =>
    new URLSearchParams(window.location.search).get("email")
  );
  const verify = useVerifyEmail();

  useEffect(() => {
    if (token) {
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, [token]);

  return (
    <Card className="mx-auto w-full max-w-md border-border/50 bg-card/80 shadow-2xl backdrop-blur">
      <CardHeader className="space-y-3 text-center">
        <div className="mx-auto rounded-2xl bg-primary p-3">
          <ShieldCheck className="h-8 w-8 text-white" />
        </div>
        <h1 className="text-2xl font-extrabold">Verify your email</h1>
        <p className="text-sm text-muted-foreground">
          {email ? `A verification link was sent to ${email}.` : "Use the link sent to your email address."}
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {verify.isSuccess ? (
          <>
            <p className="text-center text-sm text-green-500">{verify.data.message}</p>
            <Link href="/login">
              <Button className="w-full">Go to sign in</Button>
            </Link>
          </>
        ) : (
          <>
            {!token && (
              <p className="text-center text-sm text-muted-foreground">
                This link does not contain a verification token. Open the complete link from your email.
              </p>
            )}
            {verify.isError && (
              <p role="alert" className="text-sm text-destructive">
                {verify.error.data?.error || "This verification link could not be used."}
              </p>
            )}
            <Button
              className="w-full"
              disabled={!token || verify.isPending}
              onClick={() => verify.mutate({ data: { token } })}
            >
              {verify.isPending ? "Verifying..." : "Verify email"}
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );
}

export function AccountSecurityPage() {
  const isVerification = window.location.pathname.endsWith("verify-email");
  const [resetToken] = useState(() =>
    new URLSearchParams(window.location.search).get("token")
  );
  const [sent] = useState(() =>
    new URLSearchParams(window.location.search).has("sent")
  );

  useEffect(() => {
    if (resetToken || sent) {
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, [resetToken, sent]);

  if (isVerification) return <VerificationPage />;
  if (resetToken) return <ResetPasswordPage token={resetToken} />;
  return <ForgotPasswordPage sent={sent} />;
}

function ForgotPasswordPage({ sent }: { sent: boolean }) {
  const [, setLocation] = useLocation();
  const requestReset = useForgotPassword();
  const form = useForm<z.infer<typeof emailSchema>>({
    resolver: zodResolver(emailSchema),
    defaultValues: { email: "" },
  });

  const onSubmit = (data: z.infer<typeof emailSchema>) => {
    requestReset.mutate({ data }, {
      onSuccess: () => setLocation("/reset-password?sent=1"),
    });
  };

  return (
    <Card className="mx-auto w-full max-w-md border-border/50 bg-card/80 shadow-2xl backdrop-blur">
      <CardHeader className="space-y-3 text-center">
        <div className="mx-auto rounded-2xl bg-primary p-3">
          <Mail className="h-8 w-8 text-white" />
        </div>
        <h1 className="text-2xl font-extrabold">Reset your password</h1>
        <p className="text-sm text-muted-foreground">
          Enter your account email. If an account exists, we will send a secure reset link.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {sent ? (
          <p role="status" className="rounded-lg border border-border p-4 text-sm text-muted-foreground">
            If an account exists for that address, password reset instructions will be sent.
          </p>
        ) : (
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <Input type="email" autoComplete="email" required {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              {requestReset.isError && (
                <p role="alert" className="text-sm text-destructive">
                  {requestReset.error.data?.error || "Could not send reset instructions. Please try again."}
                </p>
              )}
              <Button className="w-full" type="submit" disabled={requestReset.isPending}>
                {requestReset.isPending ? "Sending..." : "Send reset link"}
              </Button>
            </form>
          </Form>
        )}
        <Link href="/login" className="flex items-center justify-center gap-2 text-sm text-primary hover:underline">
          <ArrowLeft className="h-4 w-4" />
          Return to sign in
        </Link>
      </CardContent>
    </Card>
  );
}

function ResetPasswordPage({ token }: { token: string }) {
  const [, setLocation] = useLocation();
  const resetPassword = useResetPassword();
  const form = useForm<z.infer<typeof passwordSchema>>({
    resolver: zodResolver(passwordSchema),
    defaultValues: { password: "", confirmPassword: "" },
  });

  const onSubmit = (values: z.infer<typeof passwordSchema>) => {
    resetPassword.mutate({ data: { token, password: values.password } }, {
      onSuccess: () => setLocation("/login?password-reset=1"),
    });
  };

  return (
    <Card className="mx-auto w-full max-w-md border-border/50 bg-card/80 shadow-2xl backdrop-blur">
      <CardHeader className="space-y-3 text-center">
        <div className="mx-auto rounded-2xl bg-primary p-3">
          <KeyRound className="h-8 w-8 text-white" />
        </div>
        <h1 className="text-2xl font-extrabold">Choose a new password</h1>
        <p className="text-sm text-muted-foreground">Use at least 8 characters.</p>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="password"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>New password</FormLabel>
                  <FormControl>
                    <Input type="password" autoComplete="new-password" required {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="confirmPassword"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Confirm new password</FormLabel>
                  <FormControl>
                    <Input type="password" autoComplete="new-password" required {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            {resetPassword.isError && (
              <p role="alert" className="text-sm text-destructive">
                {resetPassword.error.data?.error || "Could not reset password. Request a new link."}
              </p>
            )}
            <Button className="w-full" type="submit" disabled={resetPassword.isPending}>
              {resetPassword.isPending ? "Updating..." : "Update password"}
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
