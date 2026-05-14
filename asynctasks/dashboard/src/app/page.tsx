"use client";
import { useState, useEffect } from "react";
import { 
  Activity, Server, Clock, CheckCircle2, XCircle, Loader2, Plus, 
  StopCircle, RotateCcw, Box, Globe, ChevronRight, User, 
  Settings as SettingsIcon, LayoutGrid, Rocket, LogOut, Search, Bell, ExternalLink, GitBranch, Terminal
} from "lucide-react";
import toast from "react-hot-toast";
import { useSearchParams, useRouter } from "next/navigation";
import { useJobs, Job, Application } from "./useJobs";
import LogViewer from "./components/LogViewer";
import DeployModal from "./components/DeployModal";
import AppDetailModal from "./components/HistoryModal"; 
import TopologyMap from "./components/TopologyMap";
import ConfirmationModal from "./components/ConfirmationModal";
import Header from "./components/Header";
import { supabase } from "../lib/supabase";

export default function CanvasPage() {
  const { jobs, apps, loading, error, workerCount } = useJobs();
  const searchParams = useSearchParams();
  const router = useRouter();
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [selectedAppId, setSelectedAppId] = useState<string | null>(null);

  // Pick up jobId or appId from URL if present
  useEffect(() => {
    const jobId = searchParams.get('jobId');
    const appId = searchParams.get('appId');
    
    if (jobId) {
      setSelectedJobId(jobId);
    }
    if (appId) {
      setSelectedAppId(appId);
    }

    if (jobId || appId) {
      // Clean up URL
      router.replace('/');
    }
  }, [searchParams, router]);

  // Sync selectedApp with selectedAppId
  useEffect(() => {
    if (selectedAppId && apps.length > 0) {
      const app = apps.find(a => a.id === selectedAppId);
      if (app) setSelectedApp(app);
      setSelectedAppId(null);
    }
  }, [selectedAppId, apps]);

  const [showDeployModal, setShowDeployModal] = useState(false);
  const [selectedApp, setSelectedApp] = useState<Application | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  
  // Track job statuses to trigger toasts on completion
  const [prevJobStatuses, setPrevJobStatuses] = useState<Record<string, string>>({});

  useEffect(() => {
    jobs.forEach(job => {
      const prevStatus = prevJobStatuses[job.id];
      if (prevStatus && prevStatus === 'running' && job.status !== 'running') {
        const app = apps.find(a => a.id === job.app_id);
        const appName = app?.name || "Application";
        
        if (job.status === 'success') {
          toast.success(`${appName} deployed successfully!`, {
            duration: 5000,
            icon: '🚀'
          });
        } else if (job.status === 'failed') {
          toast.error(`${appName} deployment failed.`, {
            duration: 6000
          });
        }
      }
    });

    // Update statuses for next run
    const newStatuses: Record<string, string> = {};
    jobs.forEach(j => { newStatuses[j.id] = j.status; });
    setPrevJobStatuses(newStatuses);
  }, [jobs, apps]);

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

  const handleStopJob = (e: React.MouseEvent, jobId: string) => {
    e.stopPropagation();
    
    setConfirmConfig({
      isOpen: true,
      title: "Stop Service",
      message: "Are you sure you want to stop this service? This will kill the container and disconnect the live URL.",
      confirmLabel: "Stop Container",
      confirmVariant: "danger",
      onConfirm: async () => {
        try {
          const { data: { session } } = await supabase.auth.getSession();
          const res = await fetch(`http://localhost:8000/jobs/${jobId}`, {
            method: "DELETE",
            headers: {
              "Authorization": `Bearer ${session?.access_token}`,
            }
          });
          if (res.ok) {
            toast.success("Service termination signal sent.");
          } else {
            toast.error("Failed to stop service");
          }
          setConfirmConfig(prev => ({ ...prev, isOpen: false }));
        } catch (err) {
          console.error(err);
          toast.error("Network error while stopping service");
        }
      }
    });
  };

  const deployApp = async (appId: string) => {
    const tId = toast.loading("Triggering deployment...");
    try {
        const { data: { session } } = await supabase.auth.getSession();
        const res = await fetch(`http://localhost:8000/apps/${appId}/deploy`, { 
          method: "POST",
          headers: {
            "Authorization": `Bearer ${session?.access_token}`,
          }
        });
        if (res.ok) {
            const data = await res.json();
            setSelectedJobId(data.id);
            toast.success("Deployment started!", { id: tId });
        } else {
            toast.error("Deployment failed to trigger", { id: tId });
        }
    } catch (err) {
        console.error(err);
        toast.error("Connection error", { id: tId });
    }
  };

  const filteredApps = apps.filter(app => 
    app.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    app.repo_url.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-background">
      <Header 
        workerCount={workerCount} 
        apiError={error} 
        onSearch={setSearchQuery}
        jobs={jobs}
        apps={apps}
        onViewJob={setSelectedJobId}
        onSelectApp={setSelectedApp}
        isModalOpen={showDeployModal || !!selectedApp || confirmConfig.isOpen || !!selectedJobId}
      />

      <main className="pt-48 pb-20 px-8">
        {selectedJobId && (
          <LogViewer jobId={selectedJobId} onClose={() => setSelectedJobId(null)} />
        )}

        {showDeployModal && (
          <DeployModal onClose={(jobId) => {
            setShowDeployModal(false);
            if (jobId) {
              setSelectedJobId(jobId);
              toast.success("New application registered!");
            }
          }} />
        )}

        {selectedApp && (
          <AppDetailModal 
            app={selectedApp} 
            onClose={() => setSelectedApp(null)} 
            onViewLogs={(id) => setSelectedJobId(id)}
            allJobs={jobs}
            allApps={apps}
          />
        )}

        <ConfirmationModal 
          isOpen={confirmConfig.isOpen}
          title={confirmConfig.title}
          message={confirmConfig.message}
          confirmLabel={confirmConfig.confirmLabel}
          confirmVariant={confirmConfig.confirmVariant}
          onConfirm={confirmConfig.onConfirm}
          onCancel={() => setConfirmConfig(prev => ({ ...prev, isOpen: false }))}
        />

        <div className="max-w-7xl mx-auto">
          {/* Hero Section */}
          <div className="flex justify-between items-end mb-16">
            <div>
              <div className="flex items-center gap-2 mb-3">
                <span className="px-2 py-0.5 bg-accent/10 text-accent text-[9px] font-black rounded uppercase tracking-widest border border-accent/20">v1.5 Enterprise</span>
              </div>
              <h2 className="text-4xl font-black tracking-tighter text-white uppercase mb-2">Workspace</h2>
              <p className="text-gray-500 text-sm max-w-md font-medium">Manage your distributed application cluster from a single pane of glass.</p>
            </div>
            
            <button 
              onClick={() => setShowDeployModal(true)}
              className="bg-accent hover:bg-accent/90 text-white px-6 py-3.5 rounded-2xl flex items-center gap-3 text-sm font-black transition-all shadow-xl shadow-accent/20 active:scale-95 uppercase tracking-widest border border-accent/20"
            >
              <Plus className="w-5 h-5" />
              New Application
            </button>
          </div>

          {/* Global Topology Map Section (Compact) */}
          <div className="mb-16">
             <div className="flex items-center gap-2 mb-6">
                <Activity className="w-5 h-5 text-accent" />
                <h3 className="text-xl font-bold text-white uppercase tracking-tight">Global Infrastructure</h3>
             </div>
             <TopologyMap 
               apps={apps} 
               jobs={jobs} 
               compact={true} 
               onAppClick={(app) => setSelectedApp(app)} 
             />
          </div>

          {/* Applications Section */}
          <div className="mb-24 mt-12">
            <div className="flex items-center gap-2 mb-10 text-white">
               <Box className="w-5 h-5 text-accent" />
               <h3 className="text-xl font-bold uppercase tracking-tight">Managed Applications</h3>
            </div>

            {loading && apps.length === 0 ? (
              <div className="h-64 flex items-center justify-center">
                  <div className="flex flex-col items-center gap-4">
                    <Loader2 className="w-10 h-10 animate-spin text-accent" />
                    <p className="text-xs font-bold text-gray-500 uppercase tracking-widest">Waking up cluster...</p>
                  </div>
              </div>
            ) : filteredApps.length === 0 ? (
               <div className="rounded-[32px] border-2 border-dashed border-card-border p-20 flex flex-col items-center justify-center text-gray-500 bg-card/20 backdrop-blur-sm">
                  <div className="w-20 h-20 bg-white/5 rounded-full flex items-center justify-center mb-6">
                    <Box className="w-10 h-10 opacity-20" />
                  </div>
                  <h4 className="text-white font-bold mb-2">No applications found</h4>
                  <p className="text-sm mb-8 text-center max-w-xs">
                    {searchQuery ? `No results matching "${searchQuery}"` : "Get started by creating your first application in this workspace."}
                  </p>
                  {!searchQuery && (
                    <button 
                      onClick={() => setShowDeployModal(true)}
                      className="px-6 py-2.5 bg-white/5 hover:bg-white/10 text-white rounded-xl text-xs font-bold transition-all border border-white/5"
                    >
                      Initialize App
                    </button>
                  )}
               </div>
            ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredApps.map(app => {
                const latestJob = jobs.find(j => j.app_id === app.id);
                const isRunning = latestJob?.status === 'running';
                const progressMsg = latestJob?.result?.progress_msg || "Initializing...";
                const progressPct = latestJob?.result?.progress_pct || 0;

                return (
                  <div 
                    key={app.id} 
                    onClick={() => setSelectedApp(app)}
                    className="group relative pt-6 z-10 hover:z-20 transition-[z-index] duration-0"
                  >
                    {/* Smart Progress Tab (Slides out from top) */}
                    <div 
                      onClick={(e) => {
                        e.stopPropagation();
                        if (latestJob) setSelectedJobId(latestJob.id);
                      }}
                      className={`absolute top-0 left-0 right-0 h-20 bg-accent rounded-t-[28px] flex items-start pt-4 px-8 transition-all duration-500 ease-out z-0 cursor-pointer hover:bg-accent/90 active:scale-[0.98] ${isRunning ? '-translate-y-8 opacity-100' : 'translate-y-0 opacity-0 pointer-events-none'}`}
                    >
                        <div className="flex flex-col w-full gap-3">
                           <div className="flex justify-between items-center">
                              <span className="text-[11px] font-black text-white uppercase tracking-widest flex items-center gap-2">
                                 <Loader2 className="w-4 h-4 animate-spin" />
                                 {progressMsg}
                              </span>
                              <div className="flex items-center gap-2">
                                 <span className="px-2 py-0.5 bg-white/20 rounded text-[9px] font-black text-white uppercase tracking-tighter flex items-center gap-1">
                                    <Terminal className="w-2.5 h-2.5" /> View Logs
                                 </span>
                                 <span className="text-[11px] font-black text-white/80">{progressPct}%</span>
                              </div>
                           </div>
                           <div className="h-2 bg-white/20 rounded-full overflow-hidden border border-white/10 p-0.5">
                              <div 
                                className="h-full bg-white rounded-full transition-all duration-1000 ease-in-out shadow-[0_0_12px_rgba(255,255,255,0.6)]" 
                                style={{ width: `${progressPct}%` }} 
                              />
                           </div>
                        </div>
                    </div>

                    <div className="bg-card border border-card-border rounded-[28px] overflow-hidden hover:border-accent/40 transition-all cursor-pointer relative z-10 shadow-xl">
                      <div className="p-8">
                        <div className="flex justify-between items-start mb-8">
                           <div className="p-4 bg-accent/5 rounded-2xl border border-accent/10 group-hover:bg-accent/10 transition-colors text-accent group-hover:scale-110 duration-300">
                              <Box className="w-7 h-7" />
                           </div>
                           {latestJob ? (
                             <StatusBadge 
                               status={latestJob.status} 
                               onClick={(e) => {
                                 e.stopPropagation();
                                 setSelectedJobId(latestJob.id);
                               }}
                             />
                           ) : (
                             <span className="text-[10px] font-bold text-gray-600 uppercase tracking-widest">Pending</span>
                           )}
                        </div>
                        
                        <h4 className="text-2xl font-black mb-1 text-white uppercase tracking-tighter">{app.name}</h4>
                        <div className="space-y-1.5 mb-8">
                          <p className="text-xs text-gray-500 font-mono flex items-center gap-1.5 truncate opacity-60">
                            <Globe className="w-3.5 h-3.5" /> {app.repo_url}
                          </p>
                          <p className="text-[10px] text-accent/70 font-bold flex items-center gap-1.5 uppercase tracking-widest">
                            <GitBranch className="w-3.5 h-3.5" /> {app.branch || 'main'}
                          </p>
                        </div>

                        {latestJob?.status === 'failed' && latestJob.result?.diagnosis && (
                          <div className="mb-6 p-3 bg-red-500/5 border border-red-500/10 rounded-xl flex items-center gap-3 animate-in fade-in slide-in-from-bottom-2">
                             <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
                             <p className="text-[10px] font-bold text-red-500/80 uppercase tracking-tight truncate">
                                {latestJob.result.diagnosis.title} Detected
                             </p>
                          </div>
                        )}

                        <div className="flex gap-2.5 pointer-events-auto" onClick={(e) => e.stopPropagation()}>

                          <button 
                            onClick={() => deployApp(app.id)}
                            className="flex-1 bg-accent/10 hover:bg-accent/20 text-accent py-3 rounded-xl text-[11px] font-black transition-all flex items-center justify-center gap-2 uppercase tracking-widest border border-accent/10"
                          >
                            <RotateCcw className="w-3.5 h-3.5" />
                            Redeploy
                          </button>
                          
                          {latestJob?.status === "success" && latestJob.result?.url && (
                             <a 
                               href={latestJob.result.url} 
                               target="_blank" 
                               className="p-3 bg-green-500/10 hover:bg-green-500/20 text-green-500 rounded-xl transition-all border border-green-500/10"
                               title="View Live"
                             >
                               <ExternalLink className="w-5 h-5" />
                             </a>
                          )}

                          <button 
                            onClick={(e) => handleStopJob(e, latestJob?.id)}
                            disabled={!latestJob || latestJob.status !== 'success'}
                            className="p-3 bg-red-500/10 hover:bg-red-500/20 text-red-500 rounded-xl transition-all disabled:opacity-20 disabled:cursor-not-allowed border border-red-500/10"
                            title="Stop Service"
                          >
                            <StopCircle className="w-5 h-5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
            )}
          </div>

          {/* Recent Activity Section */}
          <div className="max-w-4xl">
              <div className="flex items-center gap-2 mb-6">
                  <Activity className="w-5 h-5 text-gray-500" />
                  <h3 className="text-xl font-bold text-white uppercase tracking-tight">Recent Activity</h3>
              </div>
              
              <div className="grid gap-3">
                 {jobs.length === 0 ? (
                    <div className="p-8 border border-dashed border-card-border rounded-[24px] text-center">
                       <p className="text-gray-600 text-xs font-bold uppercase tracking-[0.2em]">No operational logs</p>
                    </div>
                 ) : (
                   jobs.map(job => {
                     const app = apps.find(a => job.app_id === a.id);
                     return (
                       <div 
                          key={job.id} 
                          onClick={() => setSelectedJobId(job.id)}
                          className="bg-card/30 border border-card-border p-5 rounded-2xl flex items-center justify-between hover:bg-card hover:border-accent/20 transition-all cursor-pointer group"
                        >
                          <div className="flex items-center gap-5">
                             <div className={`w-2.5 h-2.5 rounded-full ${job.status === 'success' ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.4)]' : job.status === 'running' ? 'bg-blue-500 animate-pulse' : job.status === 'stopped' ? 'bg-gray-500' : 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.4)]'}`} />
                             <div>
                                <p className="text-sm font-black text-white flex items-center gap-2 uppercase tracking-tight">
                                  {job.type} Job 
                                  {app && <span className="px-2 py-0.5 bg-accent text-white text-[9px] rounded font-black uppercase tracking-tighter ml-1">{app.name}</span>}
                                </p>
                                <p className="text-[10px] text-gray-500 font-mono mt-0.5">Operation Reference: {job.id.split('-')[0]}</p>
                             </div>
                          </div>
                          
                          <div className="flex items-center gap-8">
                             <div className="text-right">
                                <div className="flex items-center gap-2 justify-end">
                                   <span className="opacity-0 group-hover:opacity-100 transition-opacity text-[9px] font-black text-accent flex items-center gap-1">
                                      <Terminal className="w-3 h-3" /> LOGS
                                   </span>
                                   <p className={`text-[10px] font-black uppercase tracking-widest ${job.status === 'failed' ? 'text-red-500' : job.status === 'running' ? 'text-blue-500' : job.status === 'success' ? 'text-green-500' : 'text-gray-400'}`}>{job.status}</p>
                                </div>
                                <p className="text-[10px] text-gray-500 font-medium">{new Date(job.updated_at).toLocaleTimeString()}</p>
                             </div>
                             <div className="p-2 bg-white/5 rounded-lg group-hover:bg-accent/10 group-hover:text-accent transition-all duration-300">
                                <ChevronRight className="w-4 h-4" />
                             </div>
                          </div>
                       </div>
                     )
                   })
                 )}
              </div>
          </div>
        </div>
      </main>
    </div>
  );
}

function StatusBadge({ status, onClick }: { status: string, onClick?: (e: React.MouseEvent) => void }) {
  const styles: Record<string, any> = {
    queued: { icon: Clock, color: "text-yellow-500", bg: "bg-yellow-500/10" },
    running: { icon: Loader2, color: "text-blue-500", bg: "bg-blue-500/10", animate: "animate-spin" },
    success: { icon: CheckCircle2, color: "text-green-500", bg: "bg-green-500/10" },
    failed: { icon: XCircle, color: "text-red-500", bg: "bg-red-500/10" },
    stopped: { icon: StopCircle, color: "text-gray-500", bg: "bg-gray-500/10" },
  };

  const config = styles[status] || styles.queued;
  const Icon = config.icon;

  return (
    <div 
      onClick={onClick}
      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl ${config.bg} ${config.color} text-[10px] font-black uppercase tracking-widest border border-white/5 ${onClick ? 'cursor-pointer hover:brightness-125 transition-all active:scale-95 group/status' : ''}`}
    >
      <Icon className={`w-3.5 h-3.5 ${config.animate || ""}`} />
      {status}
      {onClick && (
        <span className="ml-1 opacity-50 group-hover/status:opacity-100 flex items-center gap-1 border-l border-current pl-1.5 transition-opacity">
           <Terminal className="w-3 h-3" />
           {status === 'running' ? 'LOGS' : 'VIEW'}
        </span>
      )}
    </div>
  );
}
