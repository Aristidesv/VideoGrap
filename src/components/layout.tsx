import { Link, useLocation } from "wouter";
import { useGetMe, getGetMeQueryKey, useLogout } from "@/lib/api-client-react";
import { Button } from "@/components/ui/button";
import { Download, History, LogOut, ShieldAlert, User as UserIcon } from "lucide-react";
import { AdBanner, AdSidebar } from "./ads";
import { Skeleton } from "./ui/skeleton";

export function Layout({ children }: { children: React.ReactNode }) {
  const { data: user, isLoading } = useGetMe({ query: { retry: false, queryKey: getGetMeQueryKey() } });
  const logout = useLogout();
  const [, setLocation] = useLocation();

  const handleLogout = () => {
    logout.mutate(undefined, {
      onSuccess: () => {
        window.location.href = "/";
      }
    });
  };

  return (
    <div className="min-h-[100dvh] flex flex-col dark bg-background text-foreground font-sans selection:bg-primary/30">
      <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto h-16 flex items-center justify-between px-4 lg:px-8">
          <Link href="/" className="flex items-center gap-2 transition-opacity hover:opacity-80">
            <div className="bg-primary p-1.5 rounded-lg">
              <Download className="h-5 w-5 text-white" strokeWidth={3} />
            </div>
            <span className="font-bold text-xl tracking-tight">VidGrab</span>
          </Link>

          <nav className="flex items-center gap-4">
            {isLoading ? (
              <Skeleton className="h-9 w-24" />
            ) : user ? (
              <>
                <Link href="/history">
                  <Button variant="ghost" size="sm" className="hidden sm:flex items-center gap-2">
                    <History className="h-4 w-4" />
                    History
                  </Button>
                </Link>
                {user.role === 'admin' && (
                  <Link href="/admin">
                    <Button variant="ghost" size="sm" className="hidden sm:flex items-center gap-2">
                      <ShieldAlert className="h-4 w-4" />
                      Admin
                    </Button>
                  </Link>
                )}
                <Link href="/profile">
                  <Button variant="ghost" size="sm" className="flex items-center gap-2">
                    <UserIcon className="h-4 w-4" />
                    <span className="hidden sm:inline">{user.name}</span>
                  </Button>
                </Link>
                <Button variant="ghost" size="icon" onClick={handleLogout} title="Logout">
                  <LogOut className="h-4 w-4" />
                </Button>
              </>
            ) : (
              <>
                <Link href="/login">
                  <Button variant="ghost" size="sm">Login</Button>
                </Link>
                <Link href="/register">
                  <Button size="sm" className="bg-primary text-primary-foreground hover:bg-primary/90">
                    Sign Up
                  </Button>
                </Link>
              </>
            )}
          </nav>
        </div>
      </header>

      <div className="container mx-auto px-4 lg:px-8 py-8 flex-1 flex flex-col lg:flex-row gap-8">
        <main className="flex-1 flex flex-col gap-8 max-w-4xl mx-auto w-full">
          <AdBanner className="hidden sm:flex" />
          {children}
        </main>
        
        <aside className="hidden lg:block w-80 shrink-0">
          <div className="sticky top-24 space-y-6">
            <AdSidebar />
            <AdSidebar />
          </div>
        </aside>
      </div>

      <footer className="border-t border-border/40 py-8 text-center text-muted-foreground text-sm">
        <div className="container mx-auto px-4">
          <p>&copy; {new Date().getFullYear()} VidGrab. Built for speed.</p>
          <nav aria-label="Legal information" className="mt-3 flex justify-center gap-5">
            <Link href="/services" className="hover:text-foreground">Serviços</Link>
            <Link href="/terms" className="hover:text-foreground">Terms of Use</Link>
            <Link href="/privacy" className="hover:text-foreground">Privacy Policy</Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}
