"use client";
import { useEffect, useState, useRef } from "react";
import { X, ExternalLink, Globe, AlertCircle, Loader2, Activity, ArrowDown, Terminal, Trash2 } from "lucide-react";
import { Job } from "../useJobs";
import { supabase } from "../../lib/supabase";
import { API_BASE_URL, WS_BASE_URL } from "@/lib/api";
import { toast } from "react-hot-toast";
import ConfirmationModal from "./ConfirmationModal";

export default function LogViewer({ jobId, onClose }: { jobId: string; onClose: () => void }) {
  const [logs, setLogs] = useState<any[]>([]);
  const [job, setJob] = useState<Job | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const [isAtBottom, setIsAtBottom] = useState(true);
  const [isCancelling, setIsCancelling] = useState(false);
  const [isConfirmCancelOpen, setIsConfirmCancelOpen] = useState(false);
  const seenKeys = useRef<Set<string>>(new Set());
  const [activeTab, setActiveTab] = useState<"logs" | "audit">("logs");

  const isViolation = job?.result?.is_violation;

  // Reset seen keys when jobId changes
  useEffect(() => {
    seenKeys.current.clear();
    setLogs([]);
    setActiveTab("logs");
  }, [jobId]);

  // Fetch job details to check status/result
  useEffect(() => {
    const fetchJob = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        const res = await fetch(`${API_BASE_URL}/jobs/${jobId}`, {
          headers: {
            "Authorization": `Bearer ${session?.access_token}`,
          }
        });
        if (res.ok) {
          const data = await res.json();
          setJob(data);
        }
      } catch (err) {
        console.error("Failed to fetch job info:", err);
      }
    };

    const fetchLogs = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        const res = await fetch(`${API_BASE_URL}/jobs/${jobId}/logs`, {
          headers: {
            "Authorization": `Bearer ${session?.access_token}`,
          }
        });
        if (res.ok) {
          const data = await res.json();
          if (data.logs) {
            setLogs(data.logs);
            // Pre-populate seenKeys to avoid duplicates from WebSocket
            data.logs.forEach((log: any) => {
              const key = `${log.created_at}-${log.message}`;
              seenKeys.current.add(key);
            });
          }
        }
      } catch (err) {
        console.error("Failed to fetch historical logs:", err);
      }
    };

    fetchJob();
    fetchLogs();
    const interval = setInterval(fetchJob, 2000);
    return () => clearInterval(interval);
  }, [jobId]);

  useEffect(() => {
    let ws: WebSocket;
    let isMounted = true;

    const connect = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;

      if (!isMounted) return;

      ws = new WebSocket(`${WS_BASE_URL}/ws/logs/${jobId}?token=${token}`);

      ws.onmessage = (event) => {
        const data = JSON.parse(event.data);
        if (isMounted) {
          setLogs((prev) => {
            // Optimized O(1) deduplication using a Set
            const newLogs = data.filter((log: any) => {
              const key = `${log.created_at}-${log.message}`;
              if (seenKeys.current.has(key)) return false;
              seenKeys.current.add(key);
              return true;
            });
            
            if (newLogs.length === 0) return prev;
            return [...prev, ...newLogs];
          });
        }
      };
    };

    connect();

    return () => {
      isMounted = false;
      ws?.close();
    };
  }, [jobId]);

  // Track if user has scrolled up
  const handleScroll = () => {
    if (!scrollRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = scrollRef.current;

    // Increased tolerance (150px) to handle large log batches during auto-scroll
    const atBottom = scrollHeight - scrollTop - clientHeight < 150;

    if (atBottom !== isAtBottom) {
      setIsAtBottom(atBottom);
    }
  };

  // Sticky Auto-scroll logic
  useEffect(() => {
    if (isAtBottom && scrollRef.current) {
      // Direct scroll for better performance and reliability
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs, isAtBottom]);

  // Handle ESC key to close
  useEffect(() => {
    const handleEsc = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        const allModals = Array.from(document.querySelectorAll('.fixed.inset-0'));
        const topModal = allModals.reduce((prev, curr) => {
          const prevZ = parseInt(window.getComputedStyle(prev).zIndex) || 0;
          const currZ = parseInt(window.getComputedStyle(curr).zIndex) || 0;
          return currZ > prevZ ? curr : prev;
        }, allModals[0]);

        const myWrapper = document.getElementById('log-viewer-wrapper');
        if (topModal === myWrapper) {
          event.stopImmediatePropagation();
          onClose();
        }
      }
    };
    window.addEventListener("keydown", handleEsc, true);
    return () => window.removeEventListener("keydown", handleEsc, true);
  }, [onClose]);

  const handleCancel = async () => {
    if (!job) return;

    setIsConfirmCancelOpen(false);
    setIsCancelling(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(`${API_BASE_URL}/jobs/${jobId}`, {
        method: "DELETE",
        headers: {
          "Authorization": `Bearer ${session?.access_token}`,
        }
      });
      if (res.ok) {
        toast.success("Cancellation signal sent to orchestrator.");
      } else {
        const err = await res.json();
        toast.error(err.detail || "Failed to cancel job.");
      }
    } catch (err) {
      toast.error("Network error while cancelling.");
    } finally {
      setIsCancelling(false);
    }
  };

  const renderLogMessage = (message: string) => {
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    const parts = message.split(urlRegex);

    return parts.map((part, i) => {
      if (part.match(urlRegex)) {
        return (
          <a
            key={i}
            href={part}
            target="_blank"
            rel="noopener noreferrer"
            className="text-accent hover:underline inline-flex items-center gap-1 group/link"
          >
            {part}
            <ExternalLink className="w-3 h-3 opacity-50 group-hover/link:opacity-100 transition-opacity" />
          </a>
        );
      }
      return part;
    });
  };

  return (
    <div 
      id="log-viewer-wrapper"
      onClick={(e) => e.target === e.currentTarget && onClose()}
      className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/90 backdrop-blur-md p-0 md:p-4 animate-in fade-in duration-300"
    >
      <div className="w-full h-full md:h-[85vh] md:max-w-5xl bg-card border-y md:border border-card-border md:rounded-2xl shadow-2xl overflow-hidden flex flex-col animate-in zoom-in-95 duration-300">

        {/* Terminal Title Bar */}
        <div className="bg-[#111] px-4 md:px-6 py-3 md:py-4 border-b border-card-border flex justify-between items-center select-none">
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2 md:gap-3">
                <Terminal className="w-4 h-4 text-accent" />
                <span 
                  onClick={(e) => {
                    e.stopPropagation();
                    navigator.clipboard.writeText(jobId);
                    toast.success("FULL JOB ID COPIED TO CLIPBOARD", {
                      style: { background: '#111', color: '#fff', border: '1px solid rgba(255,255,255,0.1)', fontSize: '10px', fontWeight: '900', letterSpacing: '0.1em' },
                      icon: '📋'
                    });
                  }}
                  className="text-[9px] md:text-[10px] font-black font-mono text-gray-400 uppercase tracking-widest cursor-pointer hover:text-accent transition-colors group/id"
                  title="Click to copy full UUID"
                >
                  {activeTab === "logs" ? "Live Stream" : "Resource Audit"} ~ {job?.build_number ? `BUILD #${job.build_number}` : jobId.split('-')[0]}
                  <span className="ml-2 opacity-0 group-hover/id:opacity-100 transition-opacity text-[8px] font-black uppercase tracking-tighter text-accent/50 hidden md:inline">Click to copy</span>
                </span>
            </div>

            {/* Tab Toggles */}
            {isViolation && (
              <div className="flex bg-black/40 p-1 rounded-xl border border-white/5">
                <button 
                  onClick={() => setActiveTab("logs")}
                  className={`px-4 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${activeTab === 'logs' ? 'bg-accent text-white shadow-lg' : 'text-gray-500 hover:text-gray-300'}`}
                >
                  Logs
                </button>
                <button 
                  onClick={() => setActiveTab("audit")}
                  className={`px-4 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${activeTab === 'audit' ? 'bg-red-500 text-white shadow-lg' : 'text-gray-500 hover:text-gray-300'}`}
                >
                  Audit Trail
                </button>
              </div>
            )}
          </div>
          <button onClick={onClose} className="p-1 hover:bg-white/5 rounded-lg text-gray-400 hover:text-white transition-all">
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="relative flex-1 overflow-hidden flex flex-col">
          {/* Violation Overlay */}
          {isViolation && (
            <div className="bg-red-500/10 border-b border-red-500/20 p-4 md:p-5 shrink-0 flex items-start gap-3 md:gap-4 animate-in slide-in-from-top-2">
              <div className="bg-red-500/20 p-2 md:p-2.5 rounded-lg md:rounded-xl border border-red-500/20 shrink-0">
                <AlertCircle className="w-4 h-4 md:w-5 md:h-5 text-red-500" />
              </div>
              <div>
                <h4 className="text-red-500 font-black text-[9px] md:text-[10px] tracking-[0.2em] uppercase mb-1">
                  Policy Violation Detected
                </h4>
                <p className="text-white text-xs md:text-sm font-bold">This application was terminated due to resource abuse.</p>
                <p className="text-gray-400 text-[10px] md:text-xs mt-1 font-medium leading-tight">
                  Violation Type: <span className="text-red-400 uppercase">{job.result?.violation_type}</span> | 
                  Peak Memory: <span className="text-red-400">{job.result?.peak_mem?.toFixed(1)} MiB</span>
                </p>

              </div>
            </div>
          )}

          {/* Diagnostic Overlay */}
          {!isViolation && job?.result?.diagnosis && (
            <div className="bg-accent/10 border-b border-accent/20 p-4 md:p-5 shrink-0 flex items-start gap-3 md:gap-4 animate-in slide-in-from-top-2">
              <div className="bg-accent/20 p-2 md:p-2.5 rounded-lg md:rounded-xl border border-accent/20 shrink-0">
                <AlertCircle className="w-4 h-4 md:w-5 md:h-5 text-accent" />
              </div>
              <div>
                <h4 className="text-accent font-black text-[9px] md:text-[10px] tracking-[0.2em] uppercase mb-1">
                  Orchestrator Diagnosis
                </h4>
                <p className="text-white text-xs md:text-sm font-bold">{job.result.diagnosis.title}</p>
                <p className="text-gray-400 text-[10px] md:text-xs mt-1 font-medium leading-tight">{job.result.diagnosis.suggestion}</p>
              </div>
            </div>
          )}

          {/* Content Area */}
          <div 
            className="flex-1 bg-[#050505] overflow-y-auto custom-scrollbar selection:bg-accent/30" 
            ref={scrollRef}
            onScroll={handleScroll}
          >
            {activeTab === "logs" ? (
              <div className="p-4 md:p-6 font-mono text-[11px] md:text-sm">
                {logs.length === 0 && (
                  <div className="h-full py-20 flex flex-col items-center justify-center text-gray-600 space-y-4 opacity-30">
                    {job?.status && ["success", "failed", "stopped"].includes(job.status) ? (
                      <>
                        <Activity className="w-12 h-12 mb-2" />
                        <p className="text-xs font-black uppercase tracking-[0.3em]">Operational History Cleared</p>
                      </>
                    ) : (
                      <>
                        <Loader2 className="w-12 h-12 mb-2 animate-spin text-accent" />
                        <p className="text-xs font-black uppercase tracking-[0.3em] animate-pulse">Syncing with Worker Cluster...</p>
                      </>
                    )}
                  </div>
                )}

                <div className="space-y-1">
                    {logs.map((log, i) => {
                    const isLiveLine = log.message.includes("Application is live at");
                    const isError = log.message.toLowerCase().includes("error") || log.message.toLowerCase().includes("failed");
                    const isWarning = log.message.toLowerCase().includes("warning");

                    return (
                        <div 
                        key={i} 
                        className={`group flex gap-5 px-3 py-1 rounded-lg transition-all ${
                            isLiveLine 
                            ? "bg-green-500/10 border border-green-500/20 py-4 my-4 shadow-[0_0_30px_rgba(34,197,94,0.1)] animate-in zoom-in-95" 
                            : "hover:bg-white/[0.03]"
                        }`}
                        >
                        <span className="text-gray-700 shrink-0 text-[10px] mt-1 font-bold select-none">
                            [{new Date(log.created_at).toLocaleTimeString([], { hour12: false })}]
                        </span>
                        <span className={`shrink-0 text-[10px] mt-1 font-black ${isError ? 'text-red-500' : 'text-accent/50'}`}>❯</span>
                        <span className={`
                            ${isLiveLine ? "text-green-400 font-black text-base" : "text-gray-300"} 
                            ${isError ? "text-red-400" : ""}
                            ${isWarning ? "text-yellow-400" : ""}
                            break-words leading-relaxed
                        `}>
                            {renderLogMessage(log.message)}
                        </span>
                        </div>
                    );
                    })}
                    {/* Sentinel for sticky scroll */}
                    <div ref={bottomRef} className="h-4 w-full" />
                </div>
              </div>
            ) : (
              /* Audit Trail Content */
              <div className="p-8 space-y-10 animate-in fade-in slide-in-from-bottom-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="bg-[#0A0A0A] border border-white/5 p-6 rounded-2xl">
                    <h5 className="text-[9px] font-black text-gray-500 uppercase tracking-widest mb-2">Peak Memory</h5>
                    <div className="text-3xl font-black text-red-500 font-mono">
                      {job?.result?.peak_mem?.toFixed(1)} <span className="text-xs text-gray-600">MiB</span>
                    </div>
                  </div>
                  <div className="bg-[#0A0A0A] border border-white/5 p-6 rounded-2xl">
                    <h5 className="text-[9px] font-black text-gray-500 uppercase tracking-widest mb-2">Allocated Limit</h5>
                    <div className="text-3xl font-black text-gray-400 font-mono">
                      {job?.result?.audit_trail?.[0]?.limit_mem} <span className="text-xs text-gray-600">MiB</span>
                    </div>
                  </div>
                  <div className="bg-[#0A0A0A] border border-white/5 p-6 rounded-2xl">
                    <h5 className="text-[9px] font-black text-gray-500 uppercase tracking-widest mb-2">Utilization</h5>
                    <div className="text-3xl font-black text-red-400 font-mono">
                      {((job?.result?.peak_mem / job?.result?.audit_trail?.[0]?.limit_mem) * 100).toFixed(1)}%
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                   <h4 className="text-[10px] font-black text-white uppercase tracking-[0.3em] flex items-center gap-3">
                     <Activity className="w-4 h-4 text-red-500" />
                     Execution Snapshots
                   </h4>
                   <div className="border border-white/5 rounded-2xl overflow-hidden bg-[#080808]">
                     <table className="w-full text-left text-[10px] font-mono">
                        <thead className="bg-white/5 text-gray-500 uppercase font-black">
                          <tr>
                            <th className="px-6 py-4">Timestamp</th>
                            <th className="px-6 py-4">CPU %</th>
                            <th className="px-6 py-4">Memory (MiB)</th>
                            <th className="px-6 py-4">PIDs</th>
                            <th className="px-6 py-4">Status</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                          {job?.result?.audit_trail?.map((entry: any, idx: number) => {
                            const isDanger = entry.mem > entry.limit_mem * 0.95;
                            return (
                              <tr key={idx} className="hover:bg-white/[0.02] transition-colors">
                                <td className="px-6 py-4 text-gray-600">
                                  {new Date(entry.timestamp).toLocaleTimeString([], { hour12: false, fractionalSecondDigits: 1 })}
                                </td>
                                <td className="px-6 py-4 text-gray-300 font-bold">{entry.cpu.toFixed(1)}%</td>
                                <td className={`px-6 py-4 font-black ${isDanger ? 'text-red-500' : 'text-gray-300'}`}>
                                  {entry.mem.toFixed(1)} MiB
                                </td>
                                <td className="px-6 py-4 text-gray-400">{entry.pids}</td>
                                <td className="px-6 py-4">
                                  {isDanger ? (
                                    <span className="bg-red-500/20 text-red-500 px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-tighter">RED-LINE</span>
                                  ) : (
                                    <span className="text-gray-700">NOMINAL</span>
                                  )}
                                </td>
                              </tr>
                            )
                          })}
                        </tbody>
                     </table>
                   </div>
                </div>
              </div>
            )}
          </div>

          {/* Floating Actions */}
          <div className="absolute bottom-8 right-8 flex flex-col gap-3 items-end">
             {job?.status === "success" && job.result?.url && (
                <a 
                  href={job.result.url} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="bg-green-500 hover:bg-green-600 text-white px-8 py-3 rounded-2xl text-[10px] font-black shadow-2xl transition-all flex items-center gap-3 animate-in fade-in slide-in-from-right-4 uppercase tracking-widest"
                >
                  <Globe className="w-4 h-4" />
                  Launch Application
                </a>
             )}

             {["queued", "running", "pending"].includes(job?.status || "") && (
                <button 
                  onClick={() => setIsConfirmCancelOpen(true)}
                  disabled={isCancelling}
                  className="bg-red-500 hover:bg-red-600 text-white px-8 py-3 rounded-2xl text-[10px] font-black shadow-2xl transition-all flex items-center gap-3 animate-in fade-in slide-in-from-right-4 uppercase tracking-widest disabled:opacity-50"
                >
                  {isCancelling ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                  Cancel Deployment
                </button>
             )}

             {!isAtBottom && logs.length > 0 && (
                <button 
                  onClick={() => {
                    setIsAtBottom(true);
                    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
                  }}
                  className="bg-accent hover:bg-accent/90 text-white px-6 py-3 rounded-2xl text-[10px] font-black shadow-2xl transition-all animate-in fade-in slide-in-from-bottom-4 uppercase tracking-widest flex items-center gap-2"
                >
                  <ArrowDown className="w-4 h-4 animate-bounce" />
                  Resume Live Stream
                </button>
             )}
          </div>
        </div>

        {/* Footer info */}
        <div className="bg-[#080808] px-6 py-2 border-t border-card-border flex justify-between items-center text-[9px] font-bold text-gray-700 uppercase tracking-[0.3em]">
            <div className="flex items-center gap-6">
                <div className="flex items-center gap-2">
                    <div className={`w-1.5 h-1.5 rounded-full ${logs.length > 0 ? 'bg-green-500 animate-pulse' : 'bg-yellow-500'}`} />
                    <span>SYSTEM HEALTH: NOMINAL</span>
                </div>
                <div className="flex items-center gap-2 border-l border-white/5 pl-6">
                    <Activity className="w-3 h-3 text-accent" />
                    <span>PUB/SUB ENGINE: ACTIVE</span>
                </div>
            </div>
            <div className="flex items-center gap-2">
                <span>ORCHESTRATOR: v0.5 ALPHA</span>
            </div>
        </div>
      </div>
      
      <ConfirmationModal
        isOpen={isConfirmCancelOpen}
        title="Abort Deployment?"
        message="Are you sure you want to cancel this deployment? This will stop all active build processes and cleanup allocated resources. This action cannot be undone."
        confirmLabel="Abort Deployment"
        confirmVariant="danger"
        onConfirm={handleCancel}
        onCancel={() => setIsConfirmCancelOpen(false)}
        isLoading={isCancelling}
      />
    </div>
  );
}