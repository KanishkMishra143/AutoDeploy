"use client";
import { useState } from "react";
import { Activity, Server, Clock, CheckCircle2, XCircle, Loader2, Plus, StopCircle, RotateCcw, Box, Globe, ChevronRight } from "lucide-react";
import { useJobs, Job, Application } from "./useJobs";
import LogViewer from "./components/LogViewer";
import DeployModal from "./components/DeployModal";
import AppDetailModal from "./components/HistoryModal"; // Renamed for clarity
import TopologyMap from "./components/TopologyMap";

export default function CanvasPage() {
  const { jobs, apps, loading, error, workerCount } = useJobs();
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [showDeployModal, setShowDeployModal] = useState(false);
  const [selectedApp, setSelectedApp] = useState<Application | null>(null);

  const handleStopJob = async (e: React.MouseEvent, jobId: string) => {
    e.stopPropagation();
    if (!confirm("Are you sure you want to stop this service? This will kill the container.")) return;

    try {
      const res = await fetch(`http://localhost:8000/jobs/${jobId}`, {
        method: "DELETE",
      });
      if (!res.ok) alert("Failed to stop service");
    } catch (err) {
      console.error(err);
    }
  };

  const deployApp = async (appId: string) => {
    try {
        const res = await fetch(`http://localhost:8000/apps/${appId}/deploy`, { method: "POST" });
        if (res.ok) {
            const data = await res.json();
            setSelectedJobId(data.id);
        }
    } catch (err) {
        console.error(err);
    }
  };

  return (
    <div className="p-8">
      {selectedJobId && (
        <LogViewer jobId={selectedJobId} onClose={() => setSelectedJobId(null)} />
      )}

      {showDeployModal && (
        <DeployModal onClose={(jobId) => {
          setShowDeployModal(false);
          if (jobId) setSelectedJobId(jobId);
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

      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex justify-between items-end mb-12 border-b border-card-border pb-8 text-white">
          <div>
            <h2 className="text-3xl font-black tracking-tight mb-2 uppercase">Canvas</h2>
            <p className="text-gray-400 text-sm">Orchestrate and monitor your distributed applications.</p>
          </div>
          <div className="flex gap-4 items-center">
            <div className="flex gap-2">
              <div className="bg-card border border-card-border px-4 py-2 rounded-lg flex items-center gap-2">
                <Activity className={`w-4 h-4 ${error ? "text-red-500" : "text-green-500"}`} />
                <span className="text-sm font-medium">{error ? "API Offline" : "API Online"}</span>
              </div>
              <div className="bg-card border border-card-border px-4 py-2 rounded-lg flex items-center gap-2">
                <Server className={`w-4 h-4 ${workerCount > 0 ? "text-green-500" : "text-red-500"}`} />
                <span className="text-sm font-medium">{workerCount} Workers</span>
              </div>
            </div>
            
            <button 
              onClick={() => setShowDeployModal(true)}
              className="bg-accent hover:bg-accent/90 text-white px-5 py-2.5 rounded-xl flex items-center gap-2 text-sm font-bold transition-all shadow-lg shadow-accent/20 active:scale-95"
            >
              <Plus className="w-5 h-5" />
              NEW APPLICATION
            </button>
          </div>
        </div>

        {/* Global Topology Map Section (Compact) */}
        <div className="mb-16">
           <div className="flex items-center gap-2 mb-6">
              <Activity className="w-5 h-5 text-accent" />
              <h3 className="text-xl font-bold text-white">Global Infrastructure</h3>
           </div>
           <TopologyMap 
             apps={apps} 
             jobs={jobs} 
             compact={true} 
             onAppClick={(app) => setSelectedApp(app)} 
           />
        </div>

        {/* Applications Section */}
        <div className="mb-16">
          <div className="flex items-center gap-2 mb-6 text-white">
             <Box className="w-5 h-5 text-accent" />
             <h3 className="text-xl font-bold">Managed Applications</h3>
          </div>

          {loading && apps.length === 0 ? (
            <div className="h-32 flex items-center justify-center">
                <Loader2 className="w-8 h-8 animate-spin text-accent/50" />
            </div>
          ) : apps.length === 0 ? (
             <div className="rounded-2xl border-2 border-dashed border-card-border p-12 flex flex-col items-center justify-center text-gray-500">
                <Box className="w-12 h-12 mb-4 opacity-10" />
                <p>No applications registered. Click 'New Application' to start.</p>
             </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {apps.map(app => {
                const latestJob = jobs.find(j => j.app_id === app.id);
                return (
                  <div 
                    key={app.id} 
                    onClick={() => setSelectedApp(app)}
                    className="bg-card border border-card-border rounded-2xl overflow-hidden hover:border-accent/40 transition-all group cursor-pointer"
                  >
                    <div className="p-6">
                      <div className="flex justify-between items-start mb-6">
                         <div className="p-3 bg-accent/5 rounded-xl border border-accent/10 group-hover:bg-accent/10 transition-colors text-accent">
                            <Box className="w-6 h-6" />
                         </div>
                         {latestJob ? <StatusBadge status={latestJob.status} /> : <span className="text-[10px] font-bold text-gray-600 uppercase">No Deploys</span>}
                      </div>
                      
                      <h4 className="text-xl font-bold mb-1 text-white">{app.name}</h4>
                      <p className="text-xs text-gray-500 font-mono flex items-center gap-1.5 mb-6 truncate">
                        <Globe className="w-3 h-3" /> {app.repo_url}
                      </p>

                      <div className="flex gap-2 pointer-events-auto" onClick={(e) => e.stopPropagation()}>
                        <button 
                          onClick={() => deployApp(app.id)}
                          className="flex-1 bg-accent/10 hover:bg-accent/20 text-accent py-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5"
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                          DEPLOY
                        </button>
                        
                        {latestJob?.status === "success" && latestJob.result?.url && (
                           <a 
                             href={latestJob.result.url} 
                             target="_blank" 
                             className="p-2.5 bg-green-500/10 hover:bg-green-500/20 text-green-500 rounded-xl transition-all"
                             title="View Live"
                           >
                             <Globe className="w-5 h-5" />
                           </a>
                        )}

                        <button 
                          onClick={(e) => handleStopJob(e, latestJob?.id)}
                          disabled={!latestJob || latestJob.status !== 'success'}
                          className="p-2.5 bg-red-500/10 hover:bg-red-500/20 text-red-500 rounded-xl transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                          title="Stop Service"
                        >
                          <StopCircle className="w-5 h-5" />
                        </button>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Recent Activity Section */}
        <div>
            <div className="flex items-center gap-2 mb-6">
                <Activity className="w-5 h-5 text-gray-400" />
                <h3 className="text-xl font-bold text-white">Recent Activity</h3>
            </div>
            
            <div className="space-y-3">
               {jobs.length === 0 ? (
                  <p className="text-gray-500 italic text-sm">No recent activity found.</p>
               ) : (
                 jobs.map(job => {
                   const app = apps.find(a => job.app_id === a.id);
                   return (
                     <div 
                        key={job.id} 
                        onClick={() => setSelectedJobId(job.id)}
                        className="bg-card/50 border border-card-border p-4 rounded-xl flex items-center justify-between hover:bg-card hover:border-accent/20 transition-all cursor-pointer group"
                      >
                        <div className="flex items-center gap-4">
                           <div className={`w-2 h-2 rounded-full ${job.status === 'success' ? 'bg-green-500' : job.status === 'running' ? 'bg-blue-500 animate-pulse' : job.status === 'stopped' ? 'bg-gray-500' : 'bg-red-500'}`} />
                           <div>
                              <p className="text-sm font-bold text-white flex items-center gap-2">
                                {job.type} Job 
                                {app && <span className="px-2 py-0.5 bg-accent/10 text-accent text-[10px] rounded uppercase font-black">{app.name}</span>}
                              </p>
                              <p className="text-[10px] text-gray-500 font-mono">ID: {job.id.split('-')[0]}</p>
                           </div>
                        </div>
                        
                        <div className="flex items-center gap-6">
                           <div className="text-right text-white">
                              <p className="text-[10px] font-bold text-gray-400 uppercase">{job.status}</p>
                              <p className="text-[10px] text-gray-500">{new Date(job.updated_at).toLocaleTimeString()}</p>
                           </div>
                           <ChevronRight className="w-4 h-4 text-gray-600 group-hover:text-accent transition-colors" />
                        </div>
                     </div>
                   )
                 })
               )}
            </div>
        </div>
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
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
    <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full ${config.bg} ${config.color} text-[10px] font-bold uppercase tracking-wider`}>
      <Icon className={`w-3 h-3 ${config.animate || ""}`} />
      {status}
    </div>
  );
}
