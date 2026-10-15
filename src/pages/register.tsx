import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Link, useLocation } from "wouter";
import { Download, Mail, Lock, User as UserIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useRegister } from "@/lib/api-client-react";
import { useToast } from "@/hooks/use-toast";
import { TERMS_VERSION, PRIVACY_VERSION } from "@/lib/legal";

const registerSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  email: z.string().email("Enter a valid email"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  acceptedTerms: z.boolean().refine((accepted) => accepted, {
    message: "You must accept the Terms of Use and Privacy Policy.",
  }),
  termsVersion: z.string(),
  privacyVersion: z.string(),
});

export default function Register() {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const register = useRegister();

  const form = useForm<z.infer<typeof registerSchema>>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      name: "",
      email: "",
      password: "",
      acceptedTerms: false,
      termsVersion: TERMS_VERSION,
      privacyVersion: PRIVACY_VERSION,
    },
  });

  const onSubmit = (data: z.infer<typeof registerSchema>) => {
    register.mutate({ data: { ...data, acceptedTerms: true } }, {
      onSuccess: (result) => {
        toast({
          title: "Check your email",
          description: result.message,
        });
        setLocation(`/verify-email?email=${encodeURIComponent(data.email)}`);
      },
      onError: (err) => {
        toast({
          title: "Registration failed",
          description: err.data?.error || "Could not create account.",
          variant: "destructive",
        });
      },
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
            <h1 className="text-2xl font-extrabold tracking-tight">Create your account</h1>
            <p className="text-sm text-muted-foreground mt-1">Start downloading for free — no credit card needed</p>
          </div>
        </CardHeader>
        <CardContent className="px-8 pb-8 pt-4">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Full Name</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <UserIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          data-testid="input-name"
                          placeholder="Your name"
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
                          placeholder="At least 8 characters"
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
                name="acceptedTerms"
                render={({ field }) => (
                  <FormItem>
                    <div className="flex items-start gap-3">
                      <FormControl>
                        <Checkbox
                          checked={field.value}
                          onCheckedChange={(checked) => field.onChange(checked === true)}
                          aria-label="Accept Terms of Use and Privacy Policy"
                        />
                      </FormControl>
                      <FormLabel className="text-sm font-normal leading-relaxed">
                        I agree to the{" "}
                        <Link href="/terms" className="text-primary underline">
                          Terms of Use
                        </Link>{" "}
                        and{" "}
                        <Link href="/privacy" className="text-primary underline">
                          Privacy Policy
                        </Link>
                        .
                      </FormLabel>
                    </div>
                    <FormMessage />
                    <input type="hidden" {...form.register("termsVersion")} />
                    <input type="hidden" {...form.register("privacyVersion")} />
                  </FormItem>
                )}
              />
              <Button
                data-testid="button-register"
                type="submit"
                className="w-full h-11 font-semibold"
                disabled={register.isPending}
              >
                {register.isPending ? "Creating account..." : "Create Free Account"}
              </Button>
            </form>
          </Form>
          <p className="text-center text-sm text-muted-foreground mt-6">
            Already have an account?{" "}
            <Link href="/login" className="text-primary font-medium hover:underline">
              Sign in
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
