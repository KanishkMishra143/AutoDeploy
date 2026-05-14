"use client";
import { useState, useEffect } from "react";
import { X, Clock, RotateCcw, AlertCircle, Box, ExternalLink, Globe, Activity, History as HistoryIcon, Layers, Terminal, Trash2, Settings, Plus, Save } from "lucide-react";
import toast from "react-hot-toast";
import { Job, Application } from "../useJobs";
import TopologyMap from "./TopologyMap";
import ConfirmationModal from "./ConfirmationModal";
import { supabase } from "../../lib/supabase";

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
  const [activeTab, setActiveTab] = useState<"topology" | "history" | "settings" | "pipeline">("topology");
  const [isDeleting, setIsDeleting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  
  // Local Settings for editing
  const [localEnv, setLocalEnv] = useState<{key: string, value: string}[]>([]);
  const [localPreSteps, setLocalPreSteps] = useState<string[]>([]);
  const [localPostSteps, setLocalPostSteps] = useState<string[]>([]);

  // Confirmation Modal State
  const [confirmConfig, setConfirmConfig] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    confirmLabel: string;
    confirmVariant: "danger" | "accent";
    onConfirm: () => void;
  }>({
    isOpen: false,
    title: "",
    message: "",
    confirmLabel: "",
    confirmVariant: "accent",
    onConfirm: () => {}
  });

  const fetchHistory = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(`http://localhost:8000/jobs?app_id=${app.id}&limit=20`, {
        headers: {
          "Authorization": `Bearer ${session?.access_token}`,
        }
      });
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
    // Initialize settings from app data
    if (app.env_vars) {
      const vars = Object.entries(app.env_vars).map(([key, value]) => ({ 
        key, 
        value: String(value) 
      }));
      setLocalEnv(vars.length > 0 ? vars : [{key: "", value: ""}]);
    } else {
      setLocalEnv([{key: "", value: ""}]);
    }

    setLocalPreSteps(app.pre_build_steps || []);
    setLocalPostSteps(app.post_build_steps || []);
  }, [app]);

  const handleDeleteApp = () => {
    setConfirmConfig({
      isOpen: true,
      title: "Delete Application",
      message: `Are you sure you want to delete "${app.name}"? This will permanently remove all deployment history and stop the running container. This action cannot be undone.`,
      confirmLabel: "Delete permanently",
      confirmVariant: "danger",
      onConfirm: async () => {
        setIsDeleting(true);
        const tId = toast.loading(`Deleting ${app.name}...`);
        try {
          const { data: { session } } = await supabase.auth.getSession();
          const res = await fetch(`http://localhost:8000/apps/${app.id}`, { 
            method: "DELETE",
            headers: {
              "Authorization": `Bearer ${session?.access_token}`,
            }
          });
          if (res.ok) {
            toast.success("Application successfully purged", { id: tId });
            onClose();
          } else {
            toast.error("Deletion failed", { id: tId });
          }
        } catch (err) {
          console.error(err);
          toast.error("Network error during deletion", { id: tId });
        } finally {
          setIsDeleting(false);
          setConfirmConfig(prev => ({ ...prev, isOpen: false }));
        }
      }
    });
  };

  const handleSaveSettings = async () => {
    setIsSaving(true);
    const tId = toast.loading("Saving configuration...");
    const envObj = localEnv.reduce((acc, curr) => {
      if (curr.key) acc[curr.key] = curr.value;
      return acc;
    }, {} as Record<string, string>);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(`http://localhost:8000/apps/${app.id}`, {
        method: "PATCH",
        headers: { 
          "Content-Type": "application/json",
          "Authorization": `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({ 
          env_vars: envObj,
          pre_build_steps: localPreSteps.filter(s => s.trim()),
          post_build_steps: localPostSteps.filter(s => s.trim())
        })
      });
      if (res.ok) {
         toast.success("Settings saved. Redeploy to apply changes.", { id: tId });
      } else {
         toast.error("Failed to save settings", { id: tId });
      }
    } catch (err) {
      console.error(err);
      toast.error("Connection error", { id: tId });
    } finally {
      setIsSaving(false);
    }
  };

  const handleRollback = (jobId: string) => {
    setConfirmConfig({
      isOpen: true,
      title: "Confirm Rollback",
      message: "Are you sure you want to rollback to this version? This will trigger a new deployment using the image from this job.",
      confirmLabel: "Rollback Now",
      confirmVariant: "accent",
      onConfirm: async () => {
        const tId = toast.loading("Initiating rollback...");
        try {
          const { data: { session } } = await supabase.auth.getSession();
          const res = await fetch(`http://localhost:8000/jobs/${jobId}/rerun`, { 
            method: "POST",
            headers: {
              "Authorization": `Bearer ${session?.access_token}`,
            }
          });
          if (res.ok) {
            const data = await res.json();
            toast.success("Rollback in progress", { id: tId });
            onViewLogs(data.id);
            onClose();
          } else {
            toast.error("Rollback failed", { id: tId });
          }
        } catch (err) {
          console.error(err);
          toast.error("Network error during rollback", { id: tId });
        } finally {
          setConfirmConfig(prev => ({ ...prev, isOpen: false }));
        }
      }
    });
  };

  useEffect(() => {
    fetchHistory();
    const interval = setInterval(fetchHistory, 5000);
    return () => clearInterval(interval);
  }, [app.id]);

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        // Find the top-most element with a high z-index
        const allModals = Array.from(document.querySelectorAll('.fixed.inset-0'));
        const topModal = allModals.reduce((prev, curr) => {
          const prevZ = parseInt(window.getComputedStyle(prev).zIndex) || 0;
          const currZ = parseInt(window.getComputedStyle(curr).zIndex) || 0;
          return currZ > prevZ ? curr : prev;
        }, allModals[0]);

        // Only close if THIS modal is the top one
        const myWrapper = document.getElementById('history-modal-wrapper');
        if (topModal === myWrapper) {
          e.stopImmediatePropagation();
          onClose();
        }
      }
    };
    window.addEventListener("keydown", handleEsc, true);
    return () => window.removeEventListener("keydown", handleEsc, true);
  }, [onClose]);

  const latestJob = historyJobs[0];

  return (
    <div 
      id="history-modal-wrapper"
      onClick={(e) => e.target === e.currentTarget && onClose()}
      className="fixed inset-0 z-[500] flex items-center justify-center bg-black/95 backdrop-blur-md p-4 animate-in fade-in duration-300"
    >
      <div className="w-full max-w-4xl bg-card border border-card-border rounded-[32px] shadow-2xl overflow-hidden flex flex-col h-[90vh] animate-in zoom-in-95 duration-300">
        
        <ConfirmationModal 
          isOpen={confirmConfig.isOpen}
          title={confirmConfig.title}
          message={confirmConfig.message}
          confirmLabel={confirmConfig.confirmLabel}
          confirmVariant={confirmConfig.confirmVariant}
          onConfirm={confirmConfig.onConfirm}
          onCancel={() => setConfirmConfig(prev => ({ ...prev, isOpen: false }))}
        />

        {/* Header */}
        <div className="p-8 border-b border-card-border flex justify-between items-center bg-background/50">
          <div className="flex items-center gap-4">
             <div className="p-3 bg-accent/10 rounded-2xl border border-accent/20">
                <Box className="w-8 h-8 text-accent" />
             </div>
             <div>
                <h2 className="text-2xl font-black text-white uppercase tracking-tighter">{app.name}</h2>
                <div className="flex items-center gap-3">
                    <p className="text-xs text-gray-500 font-mono flex items-center gap-1.5">
                        <Globe className="w-3.5 h-3.5" /> {app.repo_url}
                    </p>
                    {latestJob?.status === 'success' && latestJob.result?.url && (
                        <a 
                            href={latestJob.result.url} 
                            target="_blank" 
                            className="text-[10px] font-black text-accent hover:underline flex items-center gap-1 uppercase tracking-widest"
                        >
                            Live App <ExternalLink className="w-2.5 h-2.5" />
                        </a>
                    )}
                </div>
             </div>
          </div>
          <div className="flex items-center gap-2">
            <button 
                onClick={handleDeleteApp}
                disabled={isDeleting}
                className="flex items-center gap-2 px-4 py-2 bg-red-500/10 hover:bg-red-500 text-red-500 hover:text-white text-[10px] font-black rounded-xl transition-all uppercase tracking-widest border border-red-500/20 disabled:opacity-50"
            >
                <Trash2 className="w-3.5 h-3.5" />
                {isDeleting ? "Deleting..." : "Delete App"}
            </button>
            <button onClick={onClose} className="p-2 bg-white/5 hover:bg-white/10 rounded-full text-gray-400 hover:text-white transition-all">
                <X className="w-6 h-6" />
            </button>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex px-8 border-b border-card-border bg-background/30">
           {[
             { id: 'topology', label: 'Topology', icon: Layers },
             { id: 'history', label: 'History', icon: HistoryIcon },
             { id: 'pipeline', label: 'Pipeline DAG', icon: Terminal },
             { id: 'settings', label: 'Settings', icon: Settings }
           ].map(tab => (
             <button 
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`px-6 py-4 text-[10px] font-black uppercase tracking-[0.2em] flex items-center gap-2 border-b-2 transition-all ${activeTab === tab.id ? 'border-accent text-white' : 'border-transparent text-gray-500 hover:text-gray-300'}`}
             >
                <tab.icon className="w-4 h-4" />
                {tab.label}
             </button>
           ))}
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
                        className={`group border rounded-2xl p-5 transition-all flex flex-col gap-4 ${isLatest ? 'bg-accent/5 border-accent/30 shadow-lg shadow-accent/5' : 'bg-background/30 border-card-border hover:border-accent/20'}`}
                      >
                        <div className="flex items-center justify-between w-full">
                          <div className="flex items-center gap-5">
                            <div className={`w-3 h-3 rounded-full ${job.status === 'success' ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.4)]' : job.status === 'running' ? 'bg-blue-500 animate-pulse' : 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.4)]'}`} />
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="text-base font-bold text-white uppercase tracking-tight">Build #{historyJobs.length - index}</span>
                                {isLatest && <span className="px-2 py-0.5 bg-accent text-[9px] font-black text-white rounded-lg uppercase tracking-tighter">Live</span>}
                                <span className="text-[9px] px-2 py-0.5 bg-white/5 rounded text-gray-500 font-black uppercase tracking-widest flex items-center gap-1.5 border border-white/5">
                                  {triggerIcon} {job.trigger_reason}
                                </span>
                              </div>
                              <div className="flex items-center gap-2 mt-1">
                                  <p className="text-[10px] text-gray-600 font-mono">Job: {job.id.split('-')[0]}</p>
                                  {job.trigger_metadata?.commit_id && (
                                      <span className="text-[10px] text-accent/50 font-mono font-bold italic">@{job.trigger_metadata.commit_id}</span>
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
                                <Terminal className="w-4 h-4" />
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

                        {/* Smart Diagnosis Section */}
                        {job.result?.diagnosis && (
                          <div className="p-4 bg-accent/5 border border-accent/10 rounded-xl animate-in fade-in slide-in-from-top-2 duration-300">
                             <div className="flex items-center gap-2 mb-2">
                                <AlertCircle className="w-4 h-4 text-accent" />
                                <span className="text-[10px] font-black text-accent uppercase tracking-widest">Auto-Diagnosis: {job.result.diagnosis.title}</span>
                             </div>
                             <p className="text-xs text-gray-400 leading-relaxed font-medium">
                                {job.result.diagnosis.suggestion}
                             </p>
                          </div>
                        )}
                      </div>
                    )
                  })
                )}
            </div>
          )}

          {activeTab === "pipeline" && (
            <div className="flex-1 overflow-y-auto p-8 max-w-2xl mx-auto w-full space-y-8 custom-scrollbar">
                <div className="mb-4">
                  <h3 className="text-lg font-bold text-white mb-2 uppercase tracking-tight">Deployment DAG Configuration</h3>
                  <p className="text-sm text-gray-500">Define manual steps to execute during the deployment lifecycle.</p>
                </div>

                {/* Pre-Build Section */}
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <div>
                       <h4 className="text-xs font-black text-gray-400 uppercase tracking-widest">Pre-Build Steps</h4>
                       <p className="text-[10px] text-gray-600 font-bold uppercase tracking-widest">Before Docker build</p>
                    </div>
                    <button onClick={() => setLocalPreSteps([...localPreSteps, ""])} className="p-2 bg-accent/10 hover:bg-accent text-accent hover:text-white rounded-xl transition-all">
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="space-y-2">
                    {localPreSteps.map((step, i) => (
                      <div key={i} className="flex gap-2">
                        <div className="flex-1 bg-background/50 border border-card-border rounded-xl px-4 py-3 flex items-center group focus-within:border-accent transition-all">
                           <Terminal className="w-3.5 h-3.5 text-gray-600 mr-3" />
                           <input 
                             placeholder="e.g. npm install"
                             className="w-full bg-transparent text-xs font-mono outline-none text-white placeholder:text-gray-800"
                             value={step}
                             onChange={(e) => {
                               const updated = [...localPreSteps];
                               updated[i] = e.target.value;
                               setLocalPreSteps(updated);
                             }}
                           />
                        </div>
                        <button onClick={() => setLocalPreSteps(localPreSteps.filter((_, idx) => idx !== i))} className="p-3 text-gray-600 hover:text-red-500 transition-all">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="h-px bg-card-border" />

                {/* Post-Build Section */}
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <div>
                       <h4 className="text-xs font-black text-gray-400 uppercase tracking-widest">Post-Build Steps</h4>
                       <p className="text-[10px] text-gray-600 font-bold uppercase tracking-widest">After image build, before deploy</p>
                    </div>
                    <button onClick={() => setLocalPostSteps([...localPostSteps, ""])} className="p-2 bg-accent/10 hover:bg-accent text-accent hover:text-white rounded-xl transition-all">
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="space-y-2">
                    {localPostSteps.map((step, i) => (
                      <div key={i} className="flex gap-2">
                        <div className="flex-1 bg-background/50 border border-card-border rounded-xl px-4 py-3 flex items-center group focus-within:border-accent transition-all">
                           <Terminal className="w-3.5 h-3.5 text-gray-600 mr-3" />
                           <input 
                             placeholder="e.g. python migrate.py"
                             className="w-full bg-transparent text-xs font-mono outline-none text-white placeholder:text-gray-800"
                             value={step}
                             onChange={(e) => {
                               const updated = [...localPostSteps];
                               updated[i] = e.target.value;
                               setLocalPostSteps(updated);
                             }}
                           />
                        </div>
                        <button onClick={() => setLocalPostSteps(localPostSteps.filter((_, idx) => idx !== i))} className="p-3 text-gray-600 hover:text-red-500 transition-all">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="pt-4 flex justify-end">
                   <button 
                     onClick={handleSaveSettings}
                     disabled={isSaving}
                     className="px-8 py-3 bg-accent hover:bg-accent/90 text-white text-xs font-black rounded-xl transition-all shadow-lg shadow-accent/20 flex items-center gap-2 uppercase tracking-widest"
                   >
                     {isSaving ? <RotateCcw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                     Save DAG Configuration
                   </button>
                </div>
            </div>
          )}

          {activeTab === "settings" && (
            <div className="flex-1 overflow-y-auto p-8 max-w-2xl mx-auto w-full">
               <div className="mb-8">
                  <h3 className="text-lg font-bold text-white mb-2">Environment Variables</h3>
                  <p className="text-sm text-gray-500">Variables defined here will be injected into your container at runtime. Changes require a new deployment to take effect.</p>
               </div>

               <div className="space-y-3 mb-8">
                  {localEnv.map((ev, i) => (
                    <div key={i} className="flex gap-3 animate-in slide-in-from-left-2" style={{animationDelay: `${i * 50}ms`}}>
                       <input 
                         placeholder="VARIABLE_NAME"
                         className="flex-1 bg-background border border-card-border rounded-xl px-4 py-3 text-xs font-mono outline-none focus:border-accent text-white transition-all uppercase placeholder:text-gray-700"
                         value={ev.key}
                         onChange={(e) => {
                            const updated = [...localEnv];
                            updated[i].key = e.target.value.toUpperCase().replace(/[^A-Z0-9_]/g, '_');
                            setLocalEnv(updated);
                         }}
                       />
                       <input 
                         placeholder="Value"
                         className="flex-1 bg-background border border-card-border rounded-xl px-4 py-3 text-xs font-mono outline-none focus:border-accent text-white transition-all placeholder:text-gray-700"
                         value={ev.value}
                         onChange={(e) => {
                            const updated = [...localEnv];
                            updated[i].value = e.target.value;
                            setLocalEnv(updated);
                         }}
                       />
                       <button 
                         onClick={() => setLocalEnv(localEnv.filter((_, idx) => idx !== i))}
                         className="p-3 text-gray-600 hover:text-red-500 transition-colors"
                       >
                         <Trash2 className="w-4 h-4" />
                       </button>
                    </div>
                  ))}
                  
                  <button 
                    onClick={() => setLocalEnv([...localEnv, {key: "", value: ""}])}
                    className="w-full py-3 border-2 border-dashed border-card-border rounded-xl text-gray-500 hover:text-accent hover:border-accent/40 text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 group"
                  >
                    <Plus className="w-3.5 h-3.5 group-hover:scale-110 transition-transform" />
                    Add Variable
                  </button>
               </div>

               <div className="pt-8 border-t border-card-border flex justify-end">
                  <button 
                    onClick={handleSaveSettings}
                    disabled={isSaving}
                    className="px-8 py-3 bg-accent hover:bg-accent/90 text-white text-xs font-black rounded-xl transition-all shadow-lg shadow-accent/20 flex items-center gap-2 uppercase tracking-widest disabled:opacity-50"
                  >
                    {isSaving ? (
                      <RotateCcw className="w-4 h-4 animate-spin" />
                    ) : (
                      <Save className="w-4 h-4" />
                    )}
                    Save Configuration
                  </button>
               </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 bg-background/50 border-t border-card-border flex justify-center">
            <p className="text-[10px] text-gray-700 uppercase tracking-[0.3em] font-black">App-Specific Control Plane</p>
        </div>
      </div>
    </div>
  );
}
