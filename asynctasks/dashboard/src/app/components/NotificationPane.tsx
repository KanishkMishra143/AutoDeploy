"use client";
import { useState, useEffect } from "react";
import { X, Bell, Activity, CheckCircle2, XCircle, Clock, Trash2, Rocket, Box } from "lucide-react";
import { Job, Application } from "../useJobs";

interface NotificationPaneProps {
  isOpen: boolean;
  onClose: () => void;
  jobs: Job[];
  apps: Application[];
  onViewJob: (jobId: string) => void;
}

export default function NotificationPane({ isOpen, onClose, jobs, apps, onViewJob }: NotificationPaneProps) {
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
      <div className="fixed inset-0 bg-black/40 backdrop-blur-sm pointer-events-auto" onClick={onClose} />
      
      <div className="relative w-full max-w-md bg-card border-l border-card-border h-full shadow-2xl flex flex-col animate-in slide-in-from-right duration-500 ease-out pointer-events-auto">
        {/* Header */}
        <div className="p-6 border-b border-card-border flex justify-between items-center bg-background/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-accent/10 rounded-xl flex items-center justify-center">
              <Bell className="w-5 h-5 text-accent" />
            </div>
            <div>
              <h3 className="text-lg font-black text-white uppercase tracking-tighter">Activity Feed</h3>
              <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">System Events & Notifications</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-white/5 rounded-lg text-gray-400 hover:text-white transition-all">
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
          {jobs.length === 0 ? (
             <div className="h-64 flex flex-col items-center justify-center text-gray-600">
                <Activity className="w-12 h-12 mb-4 opacity-10" />
                <p className="text-xs font-black uppercase tracking-[0.2em]">Silence in the cluster</p>
             </div>
          ) : (
            jobs.map(job => {
              const app = apps.find(a => a.id === job.app_id);
              const statusConfig = {
                success: { icon: CheckCircle2, color: "text-green-500", bg: "bg-green-500/10" },
                failed: { icon: XCircle, color: "text-red-500", bg: "bg-red-500/10" },
                running: { icon: Activity, color: "text-blue-500", bg: "bg-blue-500/10", animate: "animate-pulse" },
                stopped: { icon: Trash2, color: "text-gray-500", bg: "bg-gray-500/10" }
              }[job.status] || { icon: Clock, color: "text-gray-400", bg: "bg-gray-400/10" };

              const Icon = statusConfig.icon;

              return (
                <div 
                  key={job.id}
                  onClick={() => {
                    onViewJob(job.id);
                    onClose();
                  }}
                  className="group bg-background/30 border border-card-border p-4 rounded-2xl hover:bg-card hover:border-accent/30 transition-all cursor-pointer relative overflow-hidden"
                >
                  <div className={`absolute left-0 top-0 bottom-0 w-1 ${statusConfig.color.replace('text-', 'bg-')}`} />
                  
                  <div className="flex items-start gap-4">
                    <div className={`mt-1 p-2 rounded-lg ${statusConfig.bg} ${statusConfig.color}`}>
                       <Icon className={`w-4 h-4 ${statusConfig.animate || ''}`} />
                    </div>
                    
                    <div className="flex-1 min-w-0">
                       <div className="flex justify-between items-start mb-1">
                          <p className="text-xs font-black text-white uppercase tracking-tight truncate">
                            {job.type} {app ? `— ${app.name}` : 'System Task'}
                          </p>
                          <span className="text-[9px] text-gray-600 font-medium whitespace-nowrap ml-2">
                            {new Date(job.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                       </div>
                       
                       <p className="text-[10px] text-gray-500 mb-3 line-clamp-2">
                          {job.status === 'success' ? `Successfully completed ${job.type.toLowerCase()} sequence.` : 
                           job.status === 'failed' ? `Execution failed during ${job.type.toLowerCase()} phase.` :
                           job.status === 'running' ? `Currently executing ${job.type.toLowerCase()} logic...` :
                           'Task in queue for cluster processing.'}
                       </p>

                       <div className="flex items-center gap-3">
                          <div className="flex items-center gap-1.5 px-2 py-0.5 bg-white/5 rounded text-[9px] font-black text-gray-400 uppercase tracking-widest border border-white/5">
                             <Rocket className="w-3 h-3" />
                             {job.id.split('-')[0]}
                          </div>
                          {app && (
                            <div className="flex items-center gap-1.5 px-2 py-0.5 bg-accent/10 rounded text-[9px] font-black text-accent uppercase tracking-widest border border-accent/10">
                               <Box className="w-3 h-3" />
                               {app.name}
                            </div>
                          )}
                       </div>
                    </div>
                  </div>
                </div>
              )
            })
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-card-border bg-background/50 text-center">
           <button className="text-[10px] font-black text-gray-500 hover:text-white uppercase tracking-[0.2em] transition-all">
             Clear History
           </button>
        </div>
      </div>
    </div>
  );
}
