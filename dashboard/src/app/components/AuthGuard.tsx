"use client";
import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { supabase } from "../../lib/supabase";
import { Loader2, Rocket } from "lucide-react";

export default function AuthGuard({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const pathname = usePathname();
  const router = useRouter();
  const isPublicRoute = pathname === "/";

  useEffect(() => {
    // Check active sessions
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setLoading(false);
    });

    // Listen for changes on auth state
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!loading && user && isPublicRoute) {
      router.replace("/dashboard");
    }
  }, [isPublicRoute, loading, router, user]);

  useEffect(() => {
    if (!loading && !user && !isPublicRoute) {
      router.replace("/");
    }
  }, [isPublicRoute, loading, router, user]);

  if (loading && !isPublicRoute) {
    return (
      <div className="fixed inset-0 bg-background flex flex-col items-center justify-center gap-4">
        <Loader2 className="w-8 h-8 text-accent animate-spin" />
        <p className="text-[10px] font-black uppercase tracking-[0.3em] text-gray-500">Syncing Identity...</p>
      </div>
    );
  }

  if (isPublicRoute) {
    return <>{children}</>;
  }

  if (!user) {
    return (
      <div className="fixed inset-0 bg-background flex flex-col items-center justify-center gap-4">
        <Rocket className="w-8 h-8 text-accent" />
        <p className="text-[10px] font-black uppercase tracking-[0.3em] text-gray-500">Redirecting To Landing Page...</p>
      </div>
    );
  }

  return <>{children}</>;
}
