"use client";
import { useState, useEffect } from "react";
import { X, Clock, RotateCcw, AlertCircle, Box, ExternalLink, Globe, Activity, History as HistoryIcon, Layers } from "lucide-react";
import { Job, Application } from "../useJobs";
import TopologyMap from "./TopologyMap";

interface AppDetailModalProps {
  app: Application;
  onClose: () => void;
  onViewLogs: (jobId: string) => void;
  allJobs: Job[];
  allApps: Application[];
}

export default function AppDetailModal({ app, onClose, onViewLogs, allJobs, allApps }: AppDetailModalProps) {
  const [historyJobs, setHistoryJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"topology" | "history">("topology");

  const fetchHistory = async () => {
    try {
      const res = await fetch(`http://localhost:8000/jobs?app_id=${app.id}&limit=20`);
      if (res.ok) {
        const data = await res.json();
        setHistoryJobs(data.jobs || []);
      }
    } catch (err) {
      console.error("Failed to fetch history:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHistory();
    const interval = setInterval(fetchHistory, 5000);
    return () => clearInterval(interval);
  }, [app.id]);

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleEsc);
    return () => window.removeEventListener("keydown", handleEsc);
  }, [onClose]);

  const handleRollback = async (jobId: string) => {
    if (!confirm("Are you sure you want to rollback to this version?")) return;
    try {
      const res = await fetch(`http://localhost:8000/jobs/${jobId}/rerun`, { method: "POST" });
      if (res.ok) {
        const data = await res.json();
        onViewLogs(data.id);
        onClose();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const latestJob = historyJobs[0];

  return (
    <div 
      onClick={(e) => e.target === e.currentTarget && onClose()}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/95 backdrop-blur-md p-4"
    >
      <div className="w-full max-w-4xl bg-card border border-card-border rounded-[32px] shadow-2xl overflow-hidden flex flex-col h-[90vh]">
        
        {/* Header */}
        <div className="p-8 border-b border-card-border flex justify-between items-center bg-background/50">
          <div className="flex items-center gap-4">
             <div className="p-3 bg-accent/10 rounded-2xl border border-accent/20">
                <Box className="w-8 h-8 text-accent" />
             </div>
             <div>
                <h2 className="text-2xl font-black text-white">{app.name}</h2>
                <div className="flex items-center gap-3">
                    <p className="text-xs text-gray-500 font-mono flex items-center gap-1.5">
                        <Globe className="w-3.5 h-3.5" /> {app.repo_url}
                    </p>
                    {latestJob?.status === 'success' && latestJob.result?.url && (
                        <a 
                            href={latestJob.result.url} 
                            target="_blank" 
                            className="text-[10px] font-bold text-accent hover:underline flex items-center gap-1"
                        >
                            LIVE URL <ExternalLink className="w-2.5 h-2.5" />
                        </a>
                    )}
                </div>
             </div>
          </div>
          <button onClick={onClose} className="p-2 bg-white/5 hover:bg-white/10 rounded-full text-gray-400 hover:text-white transition-all">
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex px-8 border-b border-card-border bg-background/30">
           <button 
             onClick={() => setActiveTab("topology")}
             className={`px-6 py-4 text-xs font-black uppercase tracking-widest flex items-center gap-2 border-b-2 transition-all ${activeTab === 'topology' ? 'border-accent text-white' : 'border-transparent text-gray-500 hover:text-gray-300'}`}
           >
             <Layers className="w-4 h-4" />
             Topology
           </button>
           <button 
             onClick={() => setActiveTab("history")}
             className={`px-6 py-4 text-xs font-black uppercase tracking-widest flex items-center gap-2 border-b-2 transition-all ${activeTab === 'history' ? 'border-accent text-white' : 'border-transparent text-gray-500 hover:text-gray-300'}`}
           >
             <HistoryIcon className="w-4 h-4" />
             Deployment History
           </button>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-hidden flex flex-col bg-[#0a0a0a]">
          
          {activeTab === "topology" && (
            <div className="flex-1 p-8">
               <TopologyMap 
                  apps={allApps} 
                  jobs={allJobs} 
                  focusedAppId={app.id} 
               />
            </div>
          )}

          {activeTab === "history" && (
            <div className="flex-1 overflow-y-auto p-8 space-y-4 custom-scrollbar">
                {loading && historyJobs.length === 0 ? (
                   <div className="h-40 flex items-center justify-center">
                      <div className="w-6 h-6 border-2 border-accent border-t-transparent rounded-full animate-spin" />
                   </div>
                ) : historyJobs.length === 0 ? (
                   <div className="h-40 flex flex-col items-center justify-center text-gray-600 rounded-2xl border border-dashed border-card-border">
                      <AlertCircle className="w-8 h-8 mb-2 opacity-20" />
                      <p className="text-sm">No deployment history found.</p>
                   </div>
                ) : (
                  historyJobs.map((job, index) => {
                    const isLatest = index === 0;
                    const triggerIcon = job.trigger_reason === 'Webhook' ? '🔔' : job.trigger_reason === 'Rollback' ? '🔄' : '👤';
                    
                    return (
                      <div 
                        key={job.id}
                        className={`group border rounded-2xl p-5 transition-all flex items-center justify-between ${isLatest ? 'bg-accent/5 border-accent/30 shadow-lg shadow-accent/5' : 'bg-background/30 border-card-border hover:border-accent/20'}`}
                      >
                        <div className="flex items-center gap-5">
                          <div className={`w-3 h-3 rounded-full ${job.status === 'success' ? 'bg-green-500' : job.status === 'running' ? 'bg-blue-500 animate-pulse' : 'bg-red-500'}`} />
                          <div>
                            <div className="flex items-center gap-2">
                               <span className="text-base font-bold text-white">Version {historyJobs.length - index}</span>
                               {isLatest && <span className="px-2 py-0.5 bg-accent text-[9px] font-black text-white rounded-lg uppercase tracking-tighter">Current</span>}
                               <span className="text-[10px] px-2 py-0.5 bg-white/5 rounded text-gray-400 font-bold uppercase tracking-tight flex items-center gap-1.5">
                                 {triggerIcon} {job.trigger_reason}
                               </span>
                            </div>
                            <div className="flex items-center gap-2 mt-1">
                                <p className="text-[10px] text-gray-500 font-mono">Job: {job.id.split('-')[0]}</p>
                                {job.trigger_metadata?.commit_id && (
                                    <span className="text-[10px] text-accent/70 font-mono font-bold italic">@{job.trigger_metadata.commit_id}</span>
                                )}
                                {job.trigger_reason === 'Rollback' && job.trigger_metadata?.from_version && (
                                    <span className="text-[10px] text-yellow-500/70 font-bold italic">Restored from Version {job.trigger_metadata.from_version}</span>
                                )}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-6">
                          <div className="text-right">
                            <p className="text-[11px] text-white font-medium">{new Date(job.created_at).toLocaleDateString()}</p>
                            <p className="text-[10px] text-gray-500">{new Date(job.created_at).toLocaleTimeString()}</p>
                          </div>
                          
                          <div className="flex gap-2">
                            <button 
                              onClick={() => onViewLogs(job.id)}
                              className="p-2.5 bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white rounded-xl transition-all"
                              title="Terminal Logs"
                            >
                              <RotateCcw className="w-4 h-4 rotate-180" />
                            </button>
                            {job.status === 'success' && !isLatest && (
                               <button 
                                 onClick={() => handleRollback(job.id)}
                                 className="px-4 py-2 bg-accent/10 hover:bg-accent text-accent hover:text-white text-[10px] font-black rounded-xl transition-all uppercase tracking-widest border border-accent/20"
                               >
                                 Restore
                               </button>
                            )}
                          </div>
                        </div>
                      </div>
                    )
                  })
                )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 bg-background/50 border-t border-card-border flex justify-center">
            <p className="text-[10px] text-gray-600 uppercase tracking-widest font-bold">App-Specific Control Plane</p>
        </div>
      </div>
    </div>
  );
}
