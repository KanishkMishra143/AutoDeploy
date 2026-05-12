"use client";
import { useState, useEffect } from "react";
import { X, Bell, Activity, CheckCircle2, XCircle, Clock, Trash2, Rocket, Box, Sparkles } from "lucide-react";
import { Job, Application } from "../useJobs";
import toast from "react-hot-toast";

interface NotificationPaneProps {
  isOpen: boolean;
  onClose: () => void;
  jobs: Job[];
  apps: Application[];
  onViewJob: (jobId: string) => void;
}

export default function NotificationPane({ isOpen, onClose, jobs, apps, onViewJob }: NotificationPaneProps) {
  const [dismissedIds, setDismissedIds] = useState<string[]>([]);

  // Load dismissed IDs on mount
  useEffect(() => {
    const saved = localStorage.getItem("dismissed_notifications");
    if (saved) {
      try {
        setDismissedIds(JSON.parse(saved));
      } catch (e) {
        console.error("Failed to parse dismissed notifications", e);
      }
    }
  }, []);

  // Filter jobs based on dismissed state
  const visibleJobs = jobs.filter(j => !dismissedIds.includes(j.id));

  const handleDismiss = (id: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    const newDismissed = [...dismissedIds, id];
    setDismissedIds(newDismissed);
    localStorage.setItem("dismissed_notifications", JSON.stringify(newDismissed));
  };

  const handleClearHistory = () => {
    const allIds = jobs.map(j => j.id);
    const newDismissed = Array.from(new Set([...dismissedIds, ...allIds]));
    setDismissedIds(newDismissed);
    localStorage.setItem("dismissed_notifications", JSON.stringify(newDismissed));
    toast.success("Activity feed cleared.");
  };

  // Close on ESC
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleEsc);
    return () => window.removeEventListener("keydown", handleEsc);
  }, [onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[1000] flex justify-end animate-in fade-in duration-300 pointer-events-none">
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black/60 backdrop-blur-sm pointer-events-auto cursor-pointer" 
        onClick={onClose} 
      />
      
      {/* Side Panel */}
      <div className="relative w-full max-w-md bg-card border-l border-card-border h-full shadow-[0_0_50px_rgba(0,0,0,0.5)] flex flex-col animate-in slide-in-from-right duration-500 ease-out pointer-events-auto">
        {/* Header */}
        <div className="p-8 border-b border-card-border flex justify-between items-center bg-background/80 backdrop-blur-md sticky top-0 z-10">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-accent/10 rounded-2xl flex items-center justify-center border border-accent/20">
              <Bell className="w-6 h-6 text-accent" />
            </div>
            <div>
              <h3 className="text-xl font-black text-white uppercase tracking-tighter">Activity Feed</h3>
              <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest flex items-center gap-1.5">
                 <Sparkles className="w-3 h-3 text-accent/50" />
                 Live System Events
              </p>
            </div>
          </div>
          <button 
            onClick={onClose} 
            className="p-2.5 hover:bg-white/5 rounded-xl text-gray-400 hover:text-white transition-all group"
          >
            <X className="w-6 h-6 group-hover:rotate-90 transition-transform duration-300" />
          </button>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4 custom-scrollbar bg-[#080808]/50">
          {visibleJobs.length === 0 ? (
             <div className="h-full flex flex-col items-center justify-center text-gray-600 opacity-30 py-20">
                <Activity className="w-16 h-16 mb-6" />
                <p className="text-xs font-black uppercase tracking-[0.3em]">No active events</p>
             </div>
          ) : (
            visibleJobs.map(job => {
              const app = apps.find(a => a.id === job.app_id);
              const statusConfig = {
                success: { icon: CheckCircle2, color: "text-green-500", bg: "bg-green-500/10", border: "border-green-500/20" },
                failed: { icon: XCircle, color: "text-red-500", bg: "bg-red-500/10", border: "border-red-500/20" },
                running: { icon: Activity, color: "text-blue-500", bg: "bg-blue-500/10", border: "border-blue-500/20", animate: "animate-pulse" },
                stopped: { icon: Trash2, color: "text-gray-500", bg: "bg-gray-500/10", border: "border-gray-500/20" }
              }[job.status] || { icon: Clock, color: "text-gray-400", bg: "bg-gray-400/10", border: "border-gray-400/20" };

              const Icon = statusConfig.icon;

              return (
                <div 
                  key={job.id}
                  onClick={() => {
                    onViewJob(job.id);
                    onClose();
                  }}
                  className={`group bg-card/40 border ${statusConfig.border} p-5 rounded-3xl hover:bg-card hover:border-accent/30 transition-all cursor-pointer relative overflow-hidden active:scale-[0.98] duration-200`}
                >
                  {/* Dismiss Button */}
                  <button 
                    onClick={(e) => handleDismiss(job.id, e)}
                    className="absolute top-4 right-4 p-1.5 bg-white/5 hover:bg-white/10 rounded-lg text-gray-600 hover:text-white transition-all z-10 opacity-0 group-hover:opacity-100"
                    title="Dismiss"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>

                  <div className={`absolute left-0 top-0 bottom-0 w-1.5 ${statusConfig.color.replace('text-', 'bg-')} opacity-50`} />
                  
                  <div className="flex items-start gap-5">
                    <div className={`mt-1 p-2.5 rounded-xl ${statusConfig.bg} ${statusConfig.color} border ${statusConfig.border}`}>
                       <Icon className={`w-5 h-5 ${statusConfig.animate || ''}`} />
                    </div>
                    
                    <div className="flex-1 min-w-0">
                       <div className="flex justify-between items-start mb-2">
                          <p className="text-sm font-black text-white uppercase tracking-tight truncate group-hover:text-accent transition-colors">
                            {job.type} {app ? `— ${app.name}` : 'System Task'}
                          </p>
                       </div>
                       
                       <p className="text-xs text-gray-500 mb-4 line-clamp-2 leading-relaxed">
                          {job.status === 'success' ? `Successfully completed ${job.type.toLowerCase()} sequence for the target cluster.` : 
                           job.status === 'failed' ? `Execution failed during ${job.type.toLowerCase()} phase. Check logs for details.` :
                           job.status === 'running' ? `Currently executing ${job.type.toLowerCase()} logic in the worker pool...` :
                           'Task in queue for cluster processing.'}
                       </p>

                       <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                             <div className="flex items-center gap-2 px-2.5 py-1 bg-white/5 rounded-lg text-[10px] font-black text-gray-400 uppercase tracking-widest border border-white/5">
                                <Rocket className="w-3.5 h-3.5" />
                                {job.id.split('-')[0]}
                             </div>
                             {app && (
                               <div className="flex items-center gap-2 px-2.5 py-1 bg-accent/10 rounded-lg text-[10px] font-black text-accent uppercase tracking-widest border border-accent/10">
                                  <Box className="w-3.5 h-3.5" />
                                  {app.name}
                               </div>
                             )}
                          </div>
                          
                          <span className="text-[10px] text-gray-500 font-bold tabular-nums">
                            {new Date(job.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                       </div>
                    </div>
                  </div>
                </div>
              )
            })
          )}
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-card-border bg-background/80 backdrop-blur-md text-center">
           <button 
             onClick={handleClearHistory}
             className="w-full py-4 bg-white/5 hover:bg-white/10 text-[10px] font-black text-gray-400 hover:text-white uppercase tracking-[0.3em] transition-all rounded-2xl border border-white/5"
           >
             Clear Activity History
           </button>
        </div>
      </div>
    </div>
  );
}
