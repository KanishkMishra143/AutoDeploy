"use client";
import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";
import { Github, Loader2, Rocket } from "lucide-react";

export default function AuthGuard({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);

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

  const handleLogin = async () => {
    await supabase.auth.signInWithOAuth({
      provider: "github",
      options: {
        redirectTo: window.location.origin,
      },
    });
  };

  if (loading) {
    return (
      <div className="fixed inset-0 bg-background flex flex-col items-center justify-center gap-4">
        <Loader2 className="w-8 h-8 text-accent animate-spin" />
        <p className="text-[10px] font-black uppercase tracking-[0.3em] text-gray-500">Syncing Identity...</p>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="fixed inset-0 bg-[#050505] flex items-center justify-center p-6 overflow-hidden">
        {/* Background Glow */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-accent/10 rounded-full blur-[120px] pointer-events-none" />
        
        <div className="w-full max-w-md relative z-10 flex flex-col items-center text-center">
            <div className="w-20 h-20 bg-accent/10 border border-accent/20 rounded-[24px] flex items-center justify-center mb-8 shadow-2xl shadow-accent/5 animate-in fade-in zoom-in duration-500">
                <Rocket className="w-10 h-10 text-accent" />
            </div>

            <h1 className="text-4xl font-black text-white uppercase tracking-tighter mb-2 animate-in slide-in-from-bottom-2 duration-500">
                AutoDeploy
            </h1>
            <p className="text-xs font-bold text-gray-500 uppercase tracking-[0.3em] mb-12 animate-in slide-in-from-bottom-4 duration-700">
                Enterprise Orchestration Plane
            </p>

            <button 
                onClick={handleLogin}
                className="group relative w-full py-4 bg-white text-black font-black uppercase tracking-widest text-xs rounded-2xl flex items-center justify-center gap-3 hover:bg-accent hover:text-white transition-all duration-300 shadow-xl shadow-white/5 active:scale-95"
            >
                <Github className="w-4 h-4 transition-transform group-hover:rotate-12" />
                Sign in with GitHub
                <div className="absolute inset-0 bg-accent rounded-2xl opacity-0 group-hover:opacity-10 transition-opacity" />
            </button>

            <p className="mt-8 text-[10px] font-bold text-gray-700 uppercase tracking-widest">
                Protected by Supabase Identity
            </p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
