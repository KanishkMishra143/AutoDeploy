"use client";
import { useState, useEffect, useRef } from "react";
import { X, Clock, RotateCcw, AlertCircle, Box, ExternalLink, Globe, Activity, History as HistoryIcon, Layers, Terminal, Trash2, Settings, Plus, Save, Upload, User, Loader2, Shield, GitBranch } from "lucide-react";
import toast from "react-hot-toast";
import { Job, Application, Credential } from "../useJobs";
import TopologyMap from "./TopologyMap";
import ConfirmationModal from "./ConfirmationModal";
import PortCollisionModal from "./PortCollisionModal";
import { supabase } from "../../lib/supabase";
import { API_BASE_URL } from "@/lib/api";

interface AppDetailModalProps {
  app: Application;
  onClose: () => void;
  onViewLogs: (jobId: string) => void;
  allJobs: Job[];
  allApps: Application[];
  credentials: Credential[];
}

export default function AppDetailModal({ app: initialApp, onClose, onViewLogs, allJobs, allApps, credentials }: AppDetailModalProps) {
  const [liveApp, setLiveApp] = useState<Application>(initialApp);
  const app = liveApp; // Alias for JSX compatibility
  const [historyJobs, setHistoryJobs] = useState<Job[]>([]);
  const [totalJobs, setTotalJobs] = useState(0);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"topology" | "history" | "settings" | "pipeline" | "sharing">("topology");
  const [isDeleting, setIsDeleting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeploying, setIsDeploying] = useState(false);
  const [isSharing, setIsSharing] = useState(false);
  const [revokingUsers, setRevokingUsers] = useState<Record<string, boolean>>({});
  const [rollingBackJobs, setRollingBackJobs] = useState<Record<string, boolean>>({});
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
      const res = await fetch(`${API_BASE_URL}/apps/${initialApp.id}`, {
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
        const res = await fetch(`${API_BASE_URL}/auth/search?q=${shareUserId}`, {
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
  const [localPort, setLocalPort] = useState(initialApp.internal_port || 8000);
  const [localBranch, setLocalBranch] = useState(initialApp.branch || "main");
  const [localRootDir, setLocalRootDir] = useState(initialApp.root_dir || ".");
  const [localRetention, setLocalRetention] = useState(initialApp.retention_limit || 10);
  const [localRetentionDays, setLocalRetentionDays] = useState(initialApp.retention_days || 30);
  const [localVolumes, setLocalVolumes] = useState<string[]>(initialApp.volumes || []);
  const [localPreSteps, setLocalPreSteps] = useState<string[]>(initialApp.pre_build_steps || []);
  const [localPostSteps, setLocalPostSteps] = useState<string[]>(initialApp.post_build_steps || []);
  const [localCredentialId, setLocalCredentialId] = useState<string | null>(initialApp.credential_id || null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Confirmation Modal State
  const [confirmConfig, setConfirmConfig] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    confirmLabel: string;
    confirmVariant: "danger" | "accent";
    onConfirm: () => void;
    isLoading?: boolean;
  }>({
    isOpen: false,
    title: "",
    message: "",
    confirmLabel: "",
    confirmVariant: "accent",
    onConfirm: () => {},
    isLoading: false
  });

  // Port Collision State
  const [portCollision, setPortCollision] = useState<{
    isOpen: boolean;
    detectedPort: number | null;
    source: string | null;
  }>({
    isOpen: false,
    detectedPort: null,
    source: null
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
      const res = await fetch(`${API_BASE_URL}/apps/${app.id}/share`, {
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
    setRevokingUsers(prev => ({ ...prev, [userId]: true }));
    const tId = toast.loading("Revoking access...");
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(`${API_BASE_URL}/apps/${app.id}/revoke/${userId}`, {
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
    } finally {
      setRevokingUsers(prev => ({ ...prev, [userId]: false }));
    }
  };

  const fetchHistory = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(`${API_BASE_URL}/jobs?app_id=${app.id}&limit=20`, {
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
        setConfirmConfig(prev => ({ ...prev, isLoading: true }));
        setRollingBackJobs(prev => ({ ...prev, [jobId]: true }));
        const tId = toast.loading("Triggering rollback...");
        try {
          const { data: { session } } = await supabase.auth.getSession();
          const res = await fetch(`${API_BASE_URL}/jobs/${jobId}/rerun`, { 
            method: "POST",
            headers: {
              "Authorization": `Bearer ${session?.access_token}`,
            }
          });
          if (res.ok) {
            toast.success("Rollback pipeline started!", { id: tId });
            onViewLogs(jobId);
          } else {
            const data = await res.json();
            toast.error(data.detail || "Rollback failed to trigger", { id: tId });
          }
          setConfirmConfig(prev => ({ ...prev, isOpen: false }));
        } catch (err) {
          console.error(err);
          toast.error("Network error", { id: tId });
        } finally {
          setConfirmConfig(prev => ({ ...prev, isLoading: false }));
          setRollingBackJobs(prev => ({ ...prev, [jobId]: false }));
        }
      }
    });
  };

  const handleDeploy = async (overridePort?: number) => {
    const isOverride = typeof overridePort === 'number';
    setIsDeploying(true);
    const tId = toast.loading(isOverride ? "Applying port & redeploying..." : "Checking configuration...");
    try {
        const { data: { session } } = await supabase.auth.getSession();
        
        // 1. If no override port, check for collision first
        if (!isOverride) {
          const detectRes = await fetch(`${API_BASE_URL}/apps/${app.id}/detect-port`, {
            headers: { "Authorization": `Bearer ${session?.access_token}` }
          });
          if (detectRes.ok) {
            const { detected_port, source } = await detectRes.json();
            if (detected_port && detected_port !== app.internal_port) {
              toast.dismiss(tId);
              setPortCollision({ isOpen: true, detectedPort: detected_port, source: source });
              setIsDeploying(false);
              return;
            }
          }
        }

        // 2. If an override port was chosen, update the app first
        if (isOverride) {
          await fetch(`${API_BASE_URL}/apps/${app.id}`, {
            method: "PATCH",
            headers: {
              "Authorization": `Bearer ${session?.access_token}`,
              "Content-Type": "application/json"
            },
            body: JSON.stringify({ internal_port: overridePort })
          });
          setLocalPort(overridePort);
        }

        // 3. Trigger actual deployment
        const res = await fetch(`${API_BASE_URL}/apps/${app.id}/deploy?trigger_reason=Manual:Canvas`, {
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
        } else if (res.status === 409) {
            toast.error("Deployment already in progress", { id: tId });
        } else {
            toast.error("Deployment failed to trigger", { id: tId });
        }
    } catch (err) {
        console.error(err);
        toast.error("Connection error", { id: tId });
    } finally {
        setIsDeploying(false);
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
      const res = await fetch(`${API_BASE_URL}/apps/${app.id}`, {
        method: "PATCH",
        headers: {
          "Authorization": `Bearer ${session?.access_token}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          env_vars: envObj,
          internal_port: localPort,
          branch: localBranch,
          root_dir: localRootDir,
          retention_limit: localRetention,
          retention_days: localRetentionDays,
          volumes: localVolumes.filter(v => v.trim()),
          pre_build_steps: localPreSteps,
          post_build_steps: localPostSteps,
          credential_id: localCredentialId
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
          const res = await fetch(`${API_BASE_URL}/apps/${app.id}`, { 
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
          isLoading={confirmConfig.isLoading || isDeleting}
        />

        <PortCollisionModal 
          isOpen={portCollision.isOpen}
          onClose={() => setPortCollision(prev => ({ ...prev, isOpen: false }))}
          onConfirm={(port) => {
            setPortCollision(prev => ({ ...prev, isOpen: false }));
            handleDeploy(port);
          }}
          detectedPort={portCollision.detectedPort}
          source={portCollision.source}
          currentPort={app.internal_port}
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
                      const isKilled = job.status === 'failed' && job.result?.is_violation;
                      
                      return (
                        <div 
                          key={job.id}
                          className={`group border rounded-2xl p-5 transition-all flex flex-col gap-4 ${isLatest ? 'bg-accent/5 border-accent/30 shadow-lg shadow-accent/5' : 'bg-background/30 border-card-border hover:border-accent/20'}`}
                        >
                          <div className="flex items-center justify-between w-full">
                            <div className="flex items-center gap-5">
                              <div className={`w-3 h-3 rounded-full 
                                ${job.status === 'success' ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.4)]' : 
                                  job.status === 'running' ? 'bg-blue-500 animate-pulse' : 
                                  job.status === 'stopped' ? 'bg-gray-500' : 
                                  isKilled ? 'bg-red-500 shadow-[0_0_12px_rgba(239,68,68,0.6)] animate-pulse' :
                                  'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.4)]'}`} 
                              />
                              <div>
                                <div className="flex items-center gap-2">
                                  <span className="text-base font-bold text-white uppercase tracking-tight">Build #{job.build_number || (totalJobs - index)}</span>
                                  {isLatest && <span className="px-2 py-0.5 bg-accent text-[9px] font-black text-white rounded-lg uppercase tracking-tighter">Live</span>}
                                  {isKilled && <span className="px-2 py-0.5 bg-red-500 text-[9px] font-black text-white rounded-lg uppercase tracking-tighter shadow-lg shadow-red-500/20">Killed</span>}
                                  <span className="text-[9px] px-2 py-0.5 bg-white/5 rounded text-gray-500 font-black uppercase tracking-widest flex items-center gap-1.5 border border-white/5">
                                    {triggerIcon} {job.trigger_reason}
                                  </span>
                                </div>
                                <div className="flex items-center gap-2 mt-1">
                                    <p 
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        navigator.clipboard.writeText(job.id);
                                        toast.success("FULL JOB ID COPIED TO CLIPBOARD", {
                                          style: { background: '#111', color: '#fff', border: '1px solid rgba(255,255,255,0.1)', fontSize: '10px', fontWeight: '900', letterSpacing: '0.1em' },
                                          icon: '📋'
                                        });
                                      }}
                                      className="text-[10px] text-gray-600 font-mono cursor-pointer hover:text-accent transition-colors group/id"
                                      title="Click to copy full UUID"
                                    >
                                      Job: {job.id.split('-')[0]}
                                      <span className="ml-2 opacity-0 group-hover/id:opacity-100 transition-opacity text-[8px] font-black uppercase tracking-tighter text-accent/50">Click to copy</span>
                                    </p>
                                    {job.trigger_metadata?.commit_id && (
                                        <span className="text-[10px] text-accent/50 font-mono font-bold italic">@{job.trigger_metadata.commit_id}</span>
                                    )}
                                </div>
                              </div>
                            </div>

                            <div className="flex items-center gap-6">
                              <div className="text-right">
                                <p className="text-[11px] text-white font-medium">{new Date(job.created_at).toLocaleDateString('en-GB')}</p>
                                <p className="text-[10px] text-gray-500">{new Date(job.created_at).toLocaleTimeString()}</p>
                              </div>
                              <div className="flex gap-2">
                                <button 
                                  onClick={() => onViewLogs(job.id)}
                                  className={`p-2.5 rounded-xl transition-all ${isKilled ? 'bg-red-500/20 text-red-500 hover:bg-red-500 hover:text-white' : 'bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white'}`}
                                  title={isKilled ? "View Violation Audit" : "Terminal Logs"}
                                >
                                  <Terminal className="w-4 h-4" />
                                </button>
                                {job.status === 'success' && !isLatest && (
                                  <button 
                                    onClick={() => handleRollback(job.id)}
                                    disabled={app.role === 'VIEWER' || rollingBackJobs[job.id]}
                                    title={app.role === 'VIEWER' ? "Only owners and admins can rollback" : "Restore this version"}
                                    className="px-4 py-2 bg-accent/10 hover:bg-accent text-accent hover:text-white text-[10px] font-black rounded-xl transition-all uppercase tracking-widest border border-accent/20 disabled:opacity-20 disabled:cursor-not-allowed min-w-[80px] flex items-center justify-center"
                                  >
                                    {rollingBackJobs[job.id] ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Restore"}
                                  </button>
                                )}
                              </div>
                            </div>
                          </div>

                          {/* Policy Violation Alert */}
                          {isKilled && (
                            <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl animate-in fade-in slide-in-from-top-2 duration-300">
                               <div className="flex items-center gap-2 mb-2">
                                  <AlertCircle className="w-4 h-4 text-red-500" />
                                  <span className="text-[10px] font-black text-red-500 uppercase tracking-widest">Resource Policy Violation: {job.result?.violation_type}</span>
                               </div>
                               <p className="text-xs text-gray-400 leading-relaxed font-medium">
                                  This build was terminated because it exceeded defined resource limits. Click the terminal icon to view the high-fidelity audit trail.
                                </p>
                            </div>
                          )}

                          {/* Smart Diagnosis Section */}
                          {!isKilled && job.result?.diagnosis && (
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
                  onClick={() => handleDeploy()}
                  disabled={app.role === 'VIEWER' || isDeploying}
                  className="px-8 py-4 bg-accent hover:bg-accent/90 text-white text-xs font-black rounded-2xl transition-all shadow-2xl shadow-accent/40 flex items-center gap-3 uppercase tracking-widest border border-accent/20 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isDeploying ? <Loader2 className="w-4 h-4 animate-spin" /> : <RotateCcw className="w-4 h-4" />}
                  {isDeploying ? "Initializing..." : "Redeploy Application"}
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
                    <span className="px-2 py-0.5 bg-accent/10 text-accent text-[8px] font-black rounded uppercase tracking-widest border border-accent/20">Write-Only Secrets</span>
                  </div>
                  <p className="text-sm text-gray-500">Sensitive variables are stored in HashiCorp Vault and never revealed. To change a value, simply type over the mask.</p>
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

              <div className="mb-8 grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3">Service Networking</h4>
                  <div className="flex items-center gap-4 bg-background border border-card-border rounded-2xl px-6 py-4 focus-within:border-accent transition-all group">
                    <Terminal className="w-4 h-4 text-gray-600 group-focus-within:text-accent" />
                    <div className="flex-1">
                      <p className="text-[9px] font-black text-gray-500 uppercase tracking-widest mb-1">Internal Target Port</p>
                      <input 
                        type="number"
                        className="w-full bg-transparent text-sm font-bold text-white outline-none"
                        value={localPort}
                        onChange={(e) => setLocalPort(parseInt(e.target.value) || 0)}
                      />
                    </div>
                  </div>
                </div>

                <div>
                  <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3">Target Branch</h4>
                  <div className="flex items-center gap-4 bg-background border border-card-border rounded-2xl px-6 py-4 focus-within:border-accent transition-all group">
                    <GitBranch className="w-4 h-4 text-gray-600 group-focus-within:text-accent" />
                    <div className="flex-1">
                      <p className="text-[9px] font-black text-gray-500 uppercase tracking-widest mb-1">Source Branch</p>
                      <input 
                        className="w-full bg-transparent text-sm font-bold text-white outline-none"
                        value={localBranch}
                        onChange={(e) => setLocalBranch(e.target.value)}
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="mb-8">
                <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3">Repository Authentication</h4>
                <div className="flex items-center gap-4 bg-background border border-card-border rounded-2xl px-6 py-4 focus-within:border-accent transition-all group">
                  <Shield className="w-4 h-4 text-gray-600 group-focus-within:text-accent" />
                  <div className="flex-1">
                    <p className="text-[9px] font-black text-gray-500 uppercase tracking-widest mb-1">Access Credential (PAT/SSH)</p>
                    <select 
                        className="w-full bg-transparent text-sm font-bold text-white outline-none cursor-pointer"
                        value={localCredentialId || ""}
                        onChange={(e) => setLocalCredentialId(e.target.value || null)}
                    >
                        <option value="" className="bg-card text-white">Public / No PAT</option>
                        {credentials.map(cred => (
                          <option key={cred.id} value={cred.id} className="bg-card text-white">{cred.name} ({cred.type})</option>
                        ))}
                    </select>
                  </div>
                </div>
                <p className="mt-3 text-[9px] text-gray-600 font-bold uppercase tracking-widest leading-relaxed">
                  Required for private repositories. Manage global credentials in System Settings.
                </p>
              </div>

              <div className="mb-8">
                <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3">Repository Configuration</h4>
                <div className="flex items-center gap-4 bg-background border border-card-border rounded-2xl px-6 py-4 focus-within:border-accent transition-all group">
                  <Layers className="w-4 h-4 text-gray-600 group-focus-within:text-accent" />
                  <div className="flex-1">
                    <p className="text-[9px] font-black text-gray-500 uppercase tracking-widest mb-1">Root Directory (Monorepo)</p>
                    <input 
                      className="w-full bg-transparent text-sm font-bold text-white outline-none"
                      value={localRootDir}
                      onChange={(e) => setLocalRootDir(e.target.value)}
                    />
                  </div>
                </div>
                <p className="mt-3 text-[9px] text-gray-600 font-bold uppercase tracking-widest leading-relaxed">
                  Set this if your Dockerfile is not in the repository root.
                </p>
              </div>

              <div className="mb-8">
                <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3">Build Retention Policy</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="flex items-center gap-4 bg-background border border-card-border rounded-2xl px-6 py-4 focus-within:border-accent transition-all group">
                    <HistoryIcon className="w-4 h-4 text-gray-600 group-focus-within:text-accent" />
                    <div className="flex-1">
                      <p className="text-[9px] font-black text-gray-500 uppercase tracking-widest mb-1">Max Build Images to Keep</p>
                      <select 
                          className="w-full bg-transparent text-sm font-bold text-white outline-none cursor-pointer"
                          value={localRetention}
                          onChange={(e) => setLocalRetention(parseInt(e.target.value))}
                      >
                          {[5, 10, 20, 30, 50].map(val => (
                            <option key={val} value={val} className="bg-card text-white">{val} Builds</option>
                          ))}
                      </select>
                    </div>
                  </div>

                  <div className="flex items-center gap-4 bg-background border border-card-border rounded-2xl px-6 py-4 focus-within:border-accent transition-all group">
                    <Clock className="w-4 h-4 text-gray-600 group-focus-within:text-accent" />
                    <div className="flex-1">
                      <p className="text-[9px] font-black text-gray-500 uppercase tracking-widest mb-1">Retention Expiration</p>
                      <select 
                          className="w-full bg-transparent text-sm font-bold text-white outline-none cursor-pointer"
                          value={localRetentionDays}
                          onChange={(e) => setLocalRetentionDays(parseInt(e.target.value))}
                      >
                          {[1, 3, 7, 14, 30, 90].map(val => (
                            <option key={val} value={val} className="bg-card text-white">{val} Days</option>
                          ))}
                      </select>
                    </div>
                  </div>
                </div>
                <p className="mt-3 text-[9px] text-gray-600 font-bold uppercase tracking-widest leading-relaxed">
                  Controls how many builds and for how long they are stored for rollbacks. Images past either limit are automatically pruned.
                </p>
              </div>

              <div className="mb-8">
                <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3">Persistent Volumes</h4>
                <p className="text-[10px] text-gray-500 mb-3 uppercase tracking-tight">Map host storage to container paths. Relative host paths are stored in <code className="bg-white/10 px-1 py-0.5 rounded text-accent">~/.autodeploy/volumes/</code>.</p>
                <div className="space-y-3">
                  {localVolumes.map((vol, i) => (
                    <div key={i} className="flex gap-2 group/vol">
                      <div className="flex-1 bg-background border border-card-border rounded-xl px-4 py-3 flex items-center focus-within:border-accent transition-all group">
                        <Layers className="w-3.5 h-3.5 text-gray-600 mr-3 group-focus-within:text-accent" />
                        <input 
                          placeholder="e.g. ./data:/app/data"
                          className="w-full bg-transparent text-xs font-mono outline-none text-white"
                          value={vol}
                          onChange={(e) => {
                            const updated = [...localVolumes];
                            updated[i] = e.target.value;
                            setLocalVolumes(updated);
                          }}
                        />
                      </div>
                      <button 
                        onClick={() => setLocalVolumes(localVolumes.filter((_, idx) => idx !== i))}
                        className="p-3 text-gray-600 hover:text-red-500 hover:bg-red-500/10 rounded-xl transition-all opacity-0 group-hover/vol:opacity-100"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                  <button 
                    onClick={() => setLocalVolumes([...localVolumes, ""])}
                    className="w-full py-3 border border-dashed border-card-border rounded-xl text-gray-600 hover:text-accent hover:border-accent/40 hover:bg-accent/5 transition-all text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2"
                  >
                    <Plus className="w-3 h-3" />
                    Add Volume Mapping
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
                        type="password"
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
                                disabled={revokingUsers[access.user_id]}
                                className="p-3 text-gray-600 hover:text-red-500 hover:bg-red-500/10 rounded-xl transition-all opacity-0 group-hover:opacity-100 disabled:opacity-50 disabled:cursor-not-allowed"
                                title="Revoke Access"
                              >
                                {revokingUsers[access.user_id] ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
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
