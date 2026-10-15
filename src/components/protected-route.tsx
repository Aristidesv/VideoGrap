import { useEffect } from "react";
import { useLocation } from "wouter";
import { useGetMe, getGetMeQueryKey } from "@/lib/api-client-react";

export function ProtectedRoute({ children, requireAdmin = false }: { children: React.ReactNode, requireAdmin?: boolean }) {
  const { data: user, isLoading, isError } = useGetMe({ query: { retry: false, queryKey: getGetMeQueryKey() } });
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (!isLoading && isError) {
      setLocation("/login");
    } else if (!isLoading && user && requireAdmin && user.role !== 'admin') {
      setLocation("/");
    }
  }, [isLoading, isError, user, requireAdmin, setLocation]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (isError || (requireAdmin && user?.role !== 'admin')) {
    return null; // Will redirect via useEffect
  }

  return <>{children}</>;
}
