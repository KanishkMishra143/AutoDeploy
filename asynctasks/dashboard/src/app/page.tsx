"use client";
import { useState } from "react";
import { Activity, Server, Clock, CheckCircle2, XCircle, Loader2 } from "lucide-react";
import { useJobs, Job } from "./useJobs";
import LogViewer from "./components/LogViewer";

export default function CanvasPage() {
  const { jobs, loading, error, workerCount } = useJobs();
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);

  return (
    <div className="p-8">
      {selectedJobId && (
        <LogViewer jobId={selectedJobId} onClose={() => setSelectedJobId(null)} />
      )}

      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-end mb-8">
          <div>
            <h2 className="text-2xl font-bold">Service Overview</h2>
            <p className="text-gray-400 text-sm">Monitor and manage your asynchronous deployment pipeline.</p>
          </div>
          <div className="flex gap-4">
            <div className="bg-card border border-card-border px-4 py-2 rounded-lg flex items-center gap-2">
              <Activity className={`w-4 h-4 ${error ? "text-red-500" : loading && jobs.length === 0 ? "text-gray-500" : "text-green-500"}`} />
              <span className="text-sm font-medium">
                {error ? "API: Offline" : loading && jobs.length === 0 ? "Connecting..." : "API: Online"}
              </span>
            </div>
            <div className="bg-card border border-card-border px-4 py-2 rounded-lg flex items-center gap-2">
              <Server className={`w-4 h-4 ${workerCount > 0 ? "text-blue-500" : "text-red-500"}`} />
              <span className="text-sm font-medium">
                {error ? "Workers: Unknown" : `Workers: ${workerCount} Active`}
              </span>
            </div>
          </div>
        </div>

        {loading && jobs.length === 0 ? (
          <div className="flex items-center justify-center h-48">
             <Loader2 className="w-8 h-8 animate-spin text-accent" />
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {jobs.length === 0 && !error ? (
               <div className="col-span-full h-48 rounded-xl border-2 border-dashed border-card-border flex flex-col items-center justify-center text-gray-500">
                  <Clock className="w-8 h-8 mb-2 opacity-20" />
                  <p>No active jobs found in the database.</p>
               </div>
            ) : (
              jobs.map((job) => (
                <div 
                  key={job.id} 
                  onClick={() => setSelectedJobId(job.id.toString())}
                  className="bg-card border border-card-border p-5 rounded-xl hover:border-accent/50 transition-all group cursor-pointer active:scale-[0.98]"
                >
                  <div className="flex justify-between items-start mb-4">
                    <div className="p-2 bg-background rounded-lg border border-card-border group-hover:border-accent/30 group-hover:bg-accent/5 transition-colors">
                       <Server className="w-5 h-5 text-accent" />
                    </div>
                    <StatusBadge status={job.status} />
                  </div>
                  <div>
                    <h3 className="font-bold text-lg mb-1">{job.type} Job</h3>
                    <p className="text-xs text-gray-500 font-mono mb-4">ID: {job.id}</p>
                    <div className="flex items-center gap-2 text-xs text-gray-400">
                      <Clock className="w-3.5 h-3.5" />
                      <span>Updated {new Date(job.updated_at).toLocaleTimeString()}</span>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
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