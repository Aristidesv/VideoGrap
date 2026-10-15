import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Link, useLocation } from "wouter";
import { Download, Mail, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useLogin } from "@/lib/api-client-react";
import { useResendVerification } from "@/lib/api-client-react";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";

const loginSchema = z.object({
  email: z.string().email("Enter a valid email"),
  password: z.string().min(1, "Password is required"),
});

export default function Login() {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const login = useLogin();
  const resendVerification = useResendVerification();
  const [verificationEmail, setVerificationEmail] = useState<string | null>(null);

  const form = useForm<z.infer<typeof loginSchema>>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });

  const onSubmit = (data: z.infer<typeof loginSchema>) => {
    login.mutate({ data }, {
      onSuccess: () => {
        setVerificationEmail(null);
        queryClient.invalidateQueries();
        setLocation("/");
      },
      onError: (err) => {
        if (err.data?.code === "EMAIL_NOT_VERIFIED") {
          setVerificationEmail(data.email);
        }
        toast({
          title: "Login failed",
          description: err.data?.error || "Invalid email or password.",
          variant: "destructive",
        });
      },
    });
  };

  const resendVerificationEmail = () => {
    if (!verificationEmail) return;
    resendVerification.mutate({ data: { email: verificationEmail } }, {
      onSuccess: (result) => toast({ title: "Check your email", description: result.message }),
      onError: (error) => toast({
        title: "Could not send email",
        description: error.data?.error || "Please try again later.",
        variant: "destructive",
      }),
    });
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] animate-in fade-in slide-in-from-bottom-4 duration-500">
      <Card className="w-full max-w-md border-border/50 bg-card/80 backdrop-blur shadow-2xl">
        <CardHeader className="text-center pb-2 pt-8 space-y-4">
          <div className="flex justify-center">
            <div className="bg-primary p-3 rounded-2xl">
              <Download className="h-8 w-8 text-white" strokeWidth={3} />
            </div>
          </div>
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight">Welcome back</h1>
            <p className="text-sm text-muted-foreground mt-1">Sign in to your VidGrab account</p>
          </div>
        </CardHeader>
        <CardContent className="px-8 pb-8 pt-4">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          data-testid="input-email"
                          type="email"
                          placeholder="you@example.com"
                          className="pl-10"
                          {...field}
                        />
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Password</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          data-testid="input-password"
                          type="password"
                          placeholder="Your password"
                          className="pl-10"
                          {...field}
                        />
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button
                data-testid="button-login"
                type="submit"
                className="w-full h-11 font-semibold"
                disabled={login.isPending}
              >
                {login.isPending ? "Signing in..." : "Sign In"}
              </Button>
            </form>
          </Form>
          <div className="mt-4 flex justify-end">
            <Link href="/reset-password" className="text-sm text-primary hover:underline">
              Forgot your password?
            </Link>
          </div>
          {verificationEmail && (
            <div className="mt-4 rounded-lg border border-border p-4 text-sm">
              <p className="text-muted-foreground">
                Verify your email before signing in.
              </p>
              <Button
                type="button"
                variant="link"
                className="mt-1 h-auto p-0"
                disabled={resendVerification.isPending}
                onClick={resendVerificationEmail}
              >
                {resendVerification.isPending ? "Sending..." : "Send a new verification link"}
              </Button>
            </div>
          )}
          <p className="text-center text-sm text-muted-foreground mt-6">
            No account?{" "}
            <Link href="/register" className="text-primary font-medium hover:underline">
              Create one free
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
