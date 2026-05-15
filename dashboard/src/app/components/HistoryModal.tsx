"use client";
import { useState, useEffect, useRef } from "react";
import { X, Clock, RotateCcw, AlertCircle, Box, ExternalLink, Globe, Activity, History as HistoryIcon, Layers, Terminal, Trash2, Settings, Plus, Save, Upload, User, Loader2, Shield } from "lucide-react";
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

export default function AppDetailModal({ app: initialApp, onClose, onViewLogs, allJobs, allApps }: AppDetailModalProps) {
  const [liveApp, setLiveApp] = useState<Application>(initialApp);
  const app = liveApp; // Alias for JSX compatibility
  const [historyJobs, setHistoryJobs] = useState<Job[]>([]);
  const [totalJobs, setTotalJobs] = useState(0);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"topology" | "history" | "settings" | "pipeline" | "sharing">("topology");
  const [isDeleting, setIsDeleting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isSharing, setIsSharing] = useState(false);
  const [shareUserId, setShareUserId] = useState("");
  const [shareRole, setShareRole] = useState<"ADMIN" | "VIEWER">("VIEWER");
  const [userSuggestions, setUserSuggestions] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [currentUser, setCurrentUser] = useState<any>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => setCurrentUser(user));
  }, []);

  useEffect(() => {
    setLiveApp(initialApp);
  }, [initialApp]);

  const fetchAppDetails = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(`http://127.0.0.1:8000/apps/${initialApp.id}`, {
        headers: {
          "Authorization": `Bearer ${session?.access_token}`,
        }
      });
      if (res.ok) {
        const data = await res.json();
        setLiveApp(data);
      }
    } catch (err) {
      console.error("Failed to fetch app details:", err);
    }
  };

  useEffect(() => {
    const searchUsers = async () => {
      if (shareUserId.length < 2) {
        setUserSuggestions([]);
        return;
      }
      setIsSearching(true);
      try {
        const { data: { session } } = await supabase.auth.getSession();
        const res = await fetch(`http://127.0.0.1:8000/auth/search?q=${shareUserId}`, {
          headers: { "Authorization": `Bearer ${session?.access_token}` }
        });
        if (res.ok) {
          const data = await res.json();
          setUserSuggestions(data);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setIsSearching(false);
      }
    };

    const timer = setTimeout(searchUsers, 300);
    return () => clearTimeout(timer);
  }, [shareUserId]);
  
  // Local Settings for editing
  const [localEnv, setLocalEnv] = useState<{key: string, value: string}[]>(() => {
    if (initialApp.env_vars) {
      const vars = Object.entries(initialApp.env_vars).map(([key, value]) => ({ 
        key, 
        value: String(value) 
      }));
      return vars.length > 0 ? vars : [{key: "", value: ""}];
    }
    return [{key: "", value: ""}];
  });
  const [localPreSteps, setLocalPreSteps] = useState<string[]>(initialApp.pre_build_steps || []);
  const [localPostSteps, setLocalPostSteps] = useState<string[]>(initialApp.post_build_steps || []);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  const handleShare = async () => {
    if (!shareUserId) return;

    // Client-side self-sharing check
    const { data: { user } } = await supabase.auth.getUser();
    if (user && (shareUserId === user.id || shareUserId === (app as any).profile?.username)) {
      toast.error("You are already the owner of this project!");
      return;
    }

    setIsSharing(true);
    const tId = toast.loading("Granting access...");
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(`http://127.0.0.1:8000/apps/${app.id}/share`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${session?.access_token}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          user_id_or_username: shareUserId,
          role: shareRole
        })
      });

      const data = await res.json();
      
      if (res.ok) {
        toast.success("Access granted successfully!", { id: tId });
        setShareUserId("");
        fetchAppDetails(); // Refresh list instantly
      } else {
        // Extract string message from error (FastAPI detail can be a string or a list of objects)
        const errorMessage = typeof data.detail === 'string' 
          ? data.detail 
          : "Failed to share app (Invalid input)";
        toast.error(errorMessage, { id: tId });
      }
    } catch (err) {
      toast.error("Network error", { id: tId });
    } finally {
      setIsSharing(false);
    }
  };

  const handleRevoke = async (userId: string) => {
    const tId = toast.loading("Revoking access...");
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(`http://127.0.0.1:8000/apps/${app.id}/revoke/${userId}`, {
        method: "DELETE",
        headers: {
          "Authorization": `Bearer ${session?.access_token}`,
        }
      });
      if (res.ok) {
        toast.success("Access revoked", { id: tId });
        fetchAppDetails(); // Refresh list instantly
      } else {
        toast.error("Failed to revoke access", { id: tId });
      }
    } catch (err) {
      toast.error("Network error", { id: tId });
    }
  };

  const fetchHistory = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(`http://127.0.0.1:8000/jobs?app_id=${app.id}&limit=20`, {
        headers: {
          "Authorization": `Bearer ${session?.access_token}`,
        }
      });
      if (res.ok) {
        const data = await res.json();
        setHistoryJobs(data.jobs);
        setTotalJobs(data.total);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHistory();
  }, [app.id]);

  const handleRollback = (jobId: string) => {
    setConfirmConfig({
      isOpen: true,
      title: "Rollback Deployment",
      message: "This will create a new deployment using the exact configuration and source code from this historical build. Are you sure?",
      confirmLabel: "Trigger Rollback",
      confirmVariant: "accent",
      onConfirm: async () => {
        const tId = toast.loading("Triggering rollback...");
        try {
          const { data: { session } } = await supabase.auth.getSession();
          const res = await fetch(`http://127.0.0.1:8000/jobs/${jobId}/rerun`, { 
            method: "POST",
            headers: {
              "Authorization": `Bearer ${session?.access_token}`,
            }
          });
          if (res.ok) {
            toast.success("Rollback pipeline started!", { id: tId });
            onViewLogs(jobId);
          } else {
            toast.error("Rollback failed to trigger", { id: tId });
          }
          setConfirmConfig(prev => ({ ...prev, isOpen: false }));
        } catch (err) {
          console.error(err);
          toast.error("Network error", { id: tId });
        }
      }
    });
  };

  const handleDeploy = async () => {
    const tId = toast.loading("Triggering deployment...");
    try {
        const { data: { session } } = await supabase.auth.getSession();
        const res = await fetch(`http://127.0.0.1:8000/apps/${app.id}/deploy`, { 
          method: "POST",
          headers: {
            "Authorization": `Bearer ${session?.access_token}`,
          }
        });
        if (res.ok) {
            const data = await res.json();
            toast.success("Deployment started!", { id: tId });
            onViewLogs(data.id);
            fetchHistory(); // Refresh the list
        } else {
            toast.error("Deployment failed to trigger", { id: tId });
        }
    } catch (err) {
        console.error(err);
        toast.error("Connection error", { id: tId });
    }
  };

  const handleSaveSettings = async () => {
    setIsSaving(true);
    const tId = toast.loading("Saving configuration...");

    // Convert localEnv array back to dict
    const envObj: Record<string, string> = {};
    localEnv.forEach(v => {
      if (v.key) envObj[v.key] = v.value;
    });

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(`http://127.0.0.1:8000/apps/${app.id}`, {
        method: "PATCH",
        headers: {
          "Authorization": `Bearer ${session?.access_token}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          env_vars: envObj,
          pre_build_steps: localPreSteps,
          post_build_steps: localPostSteps
        })
      });

      if (res.ok) {
        toast.success("Configuration updated!", { id: tId });
        fetchAppDetails();
      } else {
        toast.error("Failed to save configuration", { id: tId });
      }
    } catch (err) {
      toast.error("Network error", { id: tId });
    } finally {
      setIsSaving(false);
    }
  };

  const handleEnvFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      const lines = content.split('\n');
      const newVars: {key: string, value: string}[] = [];
      
      lines.forEach(line => {
        const trimmedLine = line.trim();
        if (trimmedLine && !trimmedLine.startsWith('#')) {
          const firstEqual = trimmedLine.indexOf('=');
          if (firstEqual !== -1) {
            const key = trimmedLine.substring(0, firstEqual).trim();
            let value = trimmedLine.substring(firstEqual + 1).trim();
            if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
                value = value.substring(1, value.length - 1);
            }
            if (key) newVars.push({ key, value });
          }
        }
      });

      if (newVars.length > 0) {
        const filteredExisting = localEnv.filter(v => v.key || v.value);
        setLocalEnv([...filteredExisting, ...newVars]);
        toast.success(`Detected ${newVars.length} environment variables!`, { icon: '📄' });
      } else {
        toast.error("No valid environment variables found in file.");
      }
    };
    reader.readAsText(file);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

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
          const res = await fetch(`http://127.0.0.1:8000/apps/${app.id}`, { 
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
          toast.error("Connection error during deletion", { id: tId });
        } finally {
          setIsDeleting(false);
          setConfirmConfig(prev => ({ ...prev, isOpen: false }));
        }
      }
    });
  };

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        // Find all active modals
        const allModals = Array.from(document.querySelectorAll('[id$="-modal-wrapper"]'));
        // Sort by Z-index or DOM order (assumes higher Z-index or later in DOM means top-most)
        const topModal = allModals.reduce((top, current) => {
          const currentZ = parseInt(window.getComputedStyle(current).zIndex);
          const topZ = parseInt(window.getComputedStyle(top).zIndex);
          return currentZ >= topZ ? current : top;
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
                    {app.role && (
                      <span className={`px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-widest border ${app.role === 'OWNER' ? 'bg-accent/10 text-accent border-accent/20' : 'bg-blue-500/10 text-blue-500 border-blue-500/20'}`}>
                        {app.role} Access
                      </span>
                    )}
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
                disabled={isDeleting || app.role !== 'OWNER'}
                title={app.role !== 'OWNER' ? "Only owners can delete applications" : "Delete Application"}
                className="flex items-center gap-2 px-4 py-2 bg-red-500/10 hover:bg-red-500 text-red-500 hover:text-white text-[10px] font-black rounded-xl transition-all uppercase tracking-widest border border-red-500/20 disabled:opacity-50 disabled:cursor-not-allowed"
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
             { id: 'settings', label: 'Settings', icon: Settings },
             ...(app.role === 'OWNER' || app.role === 'ADMIN' ? [{ id: 'sharing', label: 'Sharing', icon: User }] : [])
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
                  apps={allApps.filter(a => a.id === app.id)} 
                  jobs={allJobs.filter(j => j.app_id === app.id)} 
                  onAppClick={() => {}}
               />
            </div>
          )}

          {activeTab === "history" && (
            <div className="flex-1 flex flex-col overflow-hidden relative">
              <div className="flex-1 overflow-y-auto p-8 pb-24 space-y-6 custom-scrollbar">
                  {loading ? (
                    <div className="h-40 flex items-center justify-center">
                       <div className="w-6 h-6 border-2 border-accent border-t-transparent rounded-full animate-spin" />
                    </div>
                  ) : historyJobs.length === 0 ? (
                    <div className="h-40 border border-dashed border-card-border rounded-[24px] flex items-center justify-center text-gray-600">
                      <p className="text-xs font-bold uppercase tracking-widest">No deployment history found</p>
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
                              <div className={`w-3 h-3 rounded-full ${job.status === 'success' ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.4)]' : job.status === 'running' ? 'bg-blue-500 animate-pulse' : job.status === 'stopped' ? 'bg-gray-500' : 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.4)]'}`} />
                              <div>
                                <div className="flex items-center gap-2">
                                  <span className="text-base font-bold text-white uppercase tracking-tight">Build #{job.build_number || (totalJobs - index)}</span>
                                  {isLatest && <span className="px-2 py-0.5 bg-accent text-[9px] font-black text-white rounded-lg uppercase tracking-tighter">Live</span>}
                                  <span className="text-[9px] px-2 py-0.5 bg-white/5 rounded text-gray-500 font-black uppercase tracking-widest flex items-center gap-1.5 border border-white/5">
                                    {triggerIcon} {job.trigger_reason}
                                  </span>
                                  {job.trigger_reason === 'Rollback' && job.trigger_metadata?.from_version && (
                                      <span className="text-[9px] px-2 py-0.5 bg-blue-500/20 text-blue-400 rounded font-black uppercase tracking-widest border border-blue-500/20 animate-pulse">
                                          From Build #{job.trigger_metadata.from_version}
                                      </span>
                                  )}
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
                                    disabled={app.role === 'VIEWER'}
                                    title={app.role === 'VIEWER' ? "Only owners and admins can rollback" : "Restore this version"}
                                    className="px-4 py-2 bg-accent/10 hover:bg-accent text-accent hover:text-white text-[10px] font-black rounded-xl transition-all uppercase tracking-widest border border-accent/20 disabled:opacity-20 disabled:cursor-not-allowed"
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

              {/* Redeploy Button (Bottom Right) */}
              <div className="absolute bottom-8 right-8 animate-in slide-in-from-bottom-4 duration-500">
                <button 
                  onClick={handleDeploy}
                  disabled={app.role === 'VIEWER'}
                  className="px-8 py-4 bg-accent hover:bg-accent/90 text-white text-xs font-black rounded-2xl transition-all shadow-2xl shadow-accent/40 flex items-center gap-3 uppercase tracking-widest border border-accent/20 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <RotateCcw className="w-4 h-4" />
                  Redeploy Application
                </button>
              </div>
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
                         <div className="flex-1 bg-background border border-card-border rounded-xl px-4 py-3 flex items-center focus-within:border-accent transition-all group">
                            <Terminal className="w-3.5 h-3.5 text-gray-600 mr-3 group-focus-within:text-accent" />
                            <input 
                              className="w-full bg-transparent text-xs font-mono outline-none text-white"
                              value={step}
                              onChange={(e) => {
                                const updated = [...localPreSteps];
                                updated[i] = e.target.value;
                                setLocalPreSteps(updated);
                              }}
                            />
                         </div>
                         <button 
                            onClick={() => setLocalPreSteps(localPreSteps.filter((_, idx) => idx !== i))}
                            className="p-3 text-gray-600 hover:text-red-500 hover:bg-red-500/10 rounded-xl transition-all"
                          >
                           <Trash2 className="w-4 h-4" />
                         </button>
                      </div>
                    ))}
                    {localPreSteps.length === 0 && <p className="text-[10px] text-gray-700 uppercase font-black text-center py-4 border border-dashed border-card-border rounded-xl">No pre-build steps defined</p>}
                  </div>
                </div>

                <div className="h-px bg-card-border" />

                {/* Post-Build Section */}
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <div>
                       <h4 className="text-xs font-black text-gray-400 uppercase tracking-widest">Post-Build Steps</h4>
                       <p className="text-[10px] text-gray-600 font-bold uppercase tracking-widest">After successful build</p>
                    </div>
                    <button onClick={() => setLocalPostSteps([...localPostSteps, ""])} className="p-2 bg-accent/10 hover:bg-accent text-accent hover:text-white rounded-xl transition-all">
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="space-y-2">
                    {localPostSteps.map((step, i) => (
                      <div key={i} className="flex gap-2">
                         <div className="flex-1 bg-background border border-card-border rounded-xl px-4 py-3 flex items-center focus-within:border-accent transition-all group">
                            <Terminal className="w-3.5 h-3.5 text-gray-600 mr-3 group-focus-within:text-accent" />
                            <input 
                              className="w-full bg-transparent text-xs font-mono outline-none text-white"
                              value={step}
                              onChange={(e) => {
                                const updated = [...localPostSteps];
                                updated[i] = e.target.value;
                                setLocalPostSteps(updated);
                              }}
                            />
                         </div>
                         <button 
                            onClick={() => setLocalPostSteps(localPostSteps.filter((_, idx) => idx !== i))}
                            className="p-3 text-gray-600 hover:text-red-500 hover:bg-red-500/10 rounded-xl transition-all"
                          >
                           <Trash2 className="w-4 h-4" />
                         </button>
                      </div>
                    ))}
                    {localPostSteps.length === 0 && <p className="text-[10px] text-gray-700 uppercase font-black text-center py-4 border border-dashed border-card-border rounded-xl">No post-build steps defined</p>}
                  </div>
                </div>
                
                <div className="pt-4">
                  <button 
                    onClick={handleSaveSettings}
                    disabled={isSaving || app.role === 'VIEWER'}
                    className="w-full py-4 bg-accent hover:bg-accent/90 text-white text-[10px] font-black rounded-2xl transition-all shadow-xl shadow-accent/20 flex items-center justify-center gap-3 uppercase tracking-[0.2em] disabled:opacity-50"
                  >
                    {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                    Update Pipeline DAG
                  </button>
                </div>
            </div>
          )}

          {activeTab === "settings" && (
            <div className="flex-1 overflow-y-auto p-8 max-w-2xl mx-auto w-full">
               <div className="mb-8 flex justify-between items-end">
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                       <h3 className="text-lg font-bold text-white">Environment Variables</h3>
                       <span className="px-2 py-0.5 bg-accent/10 text-accent text-[8px] font-black rounded uppercase tracking-widest border border-accent/20">Advanced Secrets Supported</span>
                    </div>
                    <p className="text-sm text-gray-500">Variables defined here are encrypted at rest. To use HashiCorp Vault, prefix your value with <code className="bg-white/10 px-1 py-0.5 rounded text-accent">vault://path/to/key</code>.</p>
                  </div>

                  <div className="flex gap-2">
                    <input 
                        type="file" 
                        ref={fileInputRef} 
                        onChange={handleEnvFileUpload} 
                        className="hidden" 
                        accept=".env,text/plain"
                    />
                    <button 
                        onClick={() => fileInputRef.current?.click()}
                        className="px-4 py-2 bg-white/5 hover:bg-white/10 text-white text-[10px] font-black rounded-xl transition-all border border-white/5 flex items-center gap-2 uppercase tracking-widest"
                    >
                        <Upload className="w-3.5 h-3.5" />
                        Import .env
                    </button>
                  </div>
               </div>

               <div className="space-y-3 mb-10">
                  {localEnv.map((v, i) => (
                    <div key={i} className="flex gap-3 group animate-in fade-in slide-in-from-left-2 duration-300" style={{ animationDelay: `${i * 50}ms` }}>
                       <div className="flex-1 bg-background border border-card-border rounded-2xl px-4 py-3 flex items-center focus-within:border-accent transition-all">
                          <input 
                             placeholder="KEY"
                             className="w-1/3 bg-transparent text-xs font-black outline-none text-accent placeholder:text-gray-800 border-r border-card-border mr-4"
                             value={v.key}
                             onChange={(e) => {
                                const updated = [...localEnv];
                                updated[i].key = e.target.value.toUpperCase();
                                setLocalEnv(updated);
                             }}
                          />
                          <input 
                             placeholder="VALUE"
                             className="w-2/3 bg-transparent text-xs font-mono outline-none text-white placeholder:text-gray-800"
                             value={v.value}
                             onChange={(e) => {
                                const updated = [...localEnv];
                                updated[i].value = e.target.value;
                                setLocalEnv(updated);
                             }}
                          />
                       </div>
                       <button 
                          onClick={() => setLocalEnv(localEnv.filter((_, idx) => idx !== i))}
                          className="p-4 text-gray-600 hover:text-red-500 hover:bg-red-500/10 rounded-2xl transition-all opacity-0 group-hover:opacity-100"
                        >
                         <Trash2 className="w-4 h-4" />
                       </button>
                    </div>
                  ))}
                  
                  <button 
                    onClick={() => setLocalEnv([...localEnv, {key: "", value: ""}])}
                    className="w-full py-4 border-2 border-dashed border-card-border rounded-2xl text-gray-600 hover:text-accent hover:border-accent/40 hover:bg-accent/5 transition-all text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2"
                  >
                    <Plus className="w-4 h-4" />
                    Add Variable
                  </button>
               </div>

               <div className="sticky bottom-0 bg-gradient-to-t from-[#0a0a0a] via-[#0a0a0a] to-transparent pt-10 pb-4">
                  <button 
                    onClick={handleSaveSettings}
                    disabled={isSaving || app.role === 'VIEWER'}
                    className="w-full py-5 bg-accent hover:bg-accent/90 text-white text-xs font-black rounded-[24px] transition-all shadow-2xl shadow-accent/20 flex items-center justify-center gap-3 uppercase tracking-[0.3em] disabled:opacity-50"
                  >
                    {isSaving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
                    Save Configuration
                  </button>
               </div>
            </div>
          )}

          {activeTab === "sharing" && (
            <div className="flex-1 overflow-y-auto p-8 max-w-2xl mx-auto w-full space-y-8 custom-scrollbar">
               <div className="mb-4">
                  <h3 className="text-lg font-bold text-white mb-2 uppercase tracking-tight">Project Sharing</h3>
                  <p className="text-sm text-gray-500">Grant other users access to this application. They will be able to view logs or trigger deployments based on their role.</p>
               </div>

               {/* Current Access List */}
               <div className="space-y-4">
                  <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-2">
                     <Activity className="w-3 h-3 text-accent" />
                     Active Access
                  </h4>
                  <div className="grid grid-cols-1 gap-3">
                    {/* Owner Row (ALWAYS Visible) */}
                    <div className="bg-accent/5 border border-accent/20 rounded-2xl p-4 flex justify-between items-center group transition-all">
                        <div className="flex items-center gap-4">
                          {app.owner_profile?.avatar_url ? (
                            <img src={app.owner_profile.avatar_url} alt={app.owner_profile.username} className="w-10 h-10 rounded-xl border border-accent/20" />
                          ) : (
                            <div className="w-10 h-10 bg-accent rounded-xl flex items-center justify-center">
                                <Shield className="w-5 h-5 text-white" />
                            </div>
                          )}
                          <div>
                              <p className="text-xs font-black text-white uppercase tracking-tight">
                                {app.owner_profile?.username || "Project Owner"}
                                {currentUser?.id === app.owner_id && <span className="ml-2 text-[8px] bg-accent/20 text-accent px-1.5 py-0.5 rounded">YOU</span>}
                              </p>
                              <p className="text-[9px] font-black text-accent uppercase tracking-[0.2em] mt-1">Creator / Authority</p>
                          </div>
                        </div>
                    </div>

                    {/* Collaborators */}
                    {app.access_list?.map((access) => {
                      const isMe = currentUser?.id === access.user_id;
                      return (
                        <div key={access.id} className={`bg-background/50 border border-card-border rounded-2xl p-4 flex justify-between items-center group hover:border-accent/20 transition-all ${isMe ? 'ring-1 ring-accent/20' : ''}`}>
                            <div className="flex items-center gap-4">
                              {access.profile?.avatar_url ? (
                                <img src={access.profile.avatar_url} alt={access.profile.username} className="w-10 h-10 rounded-xl border border-white/10" />
                              ) : (
                                <div className="w-10 h-10 bg-white/5 rounded-xl flex items-center justify-center">
                                    <User className="w-5 h-5 text-gray-500" />
                                </div>
                              )}
                              <div>
                                  <p className="text-xs font-black text-white uppercase tracking-tight">
                                    {access.profile?.username || access.user_id.split('-')[0]}
                                    {isMe && <span className="ml-2 text-[8px] bg-accent/20 text-accent px-1.5 py-0.5 rounded">YOU</span>}
                                  </p>
                                  <p className="text-[9px] font-black text-accent uppercase tracking-[0.2em] mt-1">{access.role}</p>
                              </div>
                            </div>
                            
                            {/* Only show revoke if it's not the current user and current user is Admin/Owner */}
                            {!isMe && (
                              <button 
                                onClick={() => handleRevoke(access.user_id)}
                                className="p-3 text-gray-600 hover:text-red-500 hover:bg-red-500/10 rounded-xl transition-all opacity-0 group-hover:opacity-100"
                                title="Revoke Access"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                        </div>
                      )
                    })}
                  </div>
               </div>

               <div className="h-px bg-card-border opacity-50" />

               {/* Add New Access */}
               <div className="bg-white/5 border border-card-border rounded-[24px] p-6 space-y-6">
                  <div className="flex justify-between items-start">
                    <div>
                      <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Invite New Collaborator</h4>
                      <p className="text-[10px] text-gray-600 font-bold uppercase tracking-tight">Search by username or paste a User ID</p>
                    </div>
                    <div className="flex gap-4">
                       <div className="flex flex-col items-end">
                          <span className="text-[9px] font-black text-accent uppercase tracking-widest">Admin</span>
                          <span className="text-[8px] text-gray-600 font-medium">Deploy, Edit, Restart</span>
                       </div>
                       <div className="w-px h-6 bg-card-border" />
                       <div className="flex flex-col items-start">
                          <span className="text-[9px] font-black text-blue-500 uppercase tracking-widest">Viewer</span>
                          <span className="text-[8px] text-gray-600 font-medium">Read-only logs & map</span>
                       </div>
                    </div>
                  </div>

                  <div className="flex gap-3 relative">
                     <div className="flex-1 bg-background border border-card-border rounded-xl px-4 py-3 flex items-center focus-within:border-accent transition-all relative">
                        <User className="w-3.5 h-3.5 text-gray-600 mr-3" />
                        <input 
                          placeholder="Type username (e.g. dev_kanishk)"
                          className="w-full bg-transparent text-xs font-mono outline-none text-white placeholder:text-gray-800"
                          value={shareUserId}
                          onChange={(e) => setShareUserId(e.target.value)}
                        />
                        {isSearching && (
                          <Loader2 className="w-3.5 h-3.5 text-accent animate-spin absolute right-4" />
                        )}

                        {/* Suggestions Dropdown */}
                        {userSuggestions.length > 0 && (
                          <div className="absolute top-full left-0 right-0 mt-2 bg-card border border-card-border rounded-xl shadow-2xl overflow-hidden z-[100] animate-in fade-in slide-in-from-top-2">
                             {userSuggestions.map((suggestion) => (
                               <button 
                                 key={suggestion.user_id}
                                 onClick={() => {
                                   setShareUserId(suggestion.username);
                                   setUserSuggestions([]);
                                 }}
                                 className="w-full px-4 py-3 hover:bg-accent/10 flex items-center gap-3 transition-colors text-left border-b border-card-border last:border-0"
                                >
                                  {suggestion.avatar_url ? (
                                    <img src={suggestion.avatar_url} alt={suggestion.username} className="w-8 h-8 rounded-full border border-white/10" />
                                  ) : (
                                    <div className="w-8 h-8 bg-accent/20 rounded-full flex items-center justify-center">
                                       <User className="w-4 h-4 text-accent" />
                                    </div>
                                  )}
                                  <div>
                                     <p className="text-xs font-bold text-white uppercase tracking-tight">{suggestion.username}</p>
                                     {suggestion.full_name && <p className="text-[10px] text-gray-500">{suggestion.full_name}</p>}
                                  </div>
                               </button>
                             ))}
                          </div>
                        )}
                     </div>
                     <select 
                        value={shareRole}
                        onChange={(e) => setShareRole(e.target.value as any)}
                        className="bg-background border border-card-border rounded-xl px-4 py-3 text-[10px] font-black uppercase text-white outline-none focus:border-accent transition-all"
                     >
                        <option value="VIEWER">Viewer</option>
                        <option value="ADMIN">Admin</option>
                     </select>
                     <button 
                        onClick={handleShare}
                        disabled={isSharing || !shareUserId}
                        className="px-6 py-3 bg-accent hover:bg-accent/90 text-white text-[10px] font-black rounded-xl transition-all shadow-lg shadow-accent/20 flex items-center gap-2 uppercase tracking-widest disabled:opacity-50"
                     >
                        {isSharing ? <RotateCcw className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                        Share
                     </button>
                  </div>
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
