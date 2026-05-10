"use client";
import { useEffect, useState, useRef } from "react";
import { X } from "lucide-react";

export default function LogViewer({ jobId, onClose }: { jobId: string; onClose: () => void }) {
  const [logs, setLogs] = useState<any[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // ONLY connect the WebSocket when this component is rendered (modal opens)
    const ws = new WebSocket(`ws://localhost:8000/ws/logs/${jobId}`);
    
    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      setLogs(data);
    };

    // Disconnect when the modal closes
    return () => ws.close();
  }, [jobId]);

  // Auto-scroll to bottom
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="w-full max-w-4xl bg-card border border-card-border rounded-xl shadow-2xl overflow-hidden flex flex-col h-[80vh]">
        
        {/* Terminal Header */}
        <div className="bg-background px-4 py-3 border-b border-card-border flex justify-between items-center">
          <div className="flex items-center gap-2">
            <div className="flex gap-1.5">
              <div className="w-3 h-3 rounded-full bg-red-500/20 border border-red-500/50"></div>
              <div className="w-3 h-3 rounded-full bg-yellow-500/20 border border-yellow-500/50"></div>
              <div className="w-3 h-3 rounded-full bg-green-500/20 border border-green-500/50"></div>
            </div>
            <span className="text-xs font-mono text-gray-400 ml-2">autodeploy-worker ~ {jobId.split('-')[0]}</span>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Terminal Body */}
        <div className="flex-1 bg-[#0a0a0a] p-4 font-mono text-sm overflow-y-auto" ref={scrollRef}>
          {logs.length === 0 && <p className="text-gray-600 italic">Waiting for connection to worker...</p>}
          {logs.map((log, i) => (
            <div key={i} className="mb-1.5 flex gap-4 hover:bg-white/5 px-2 py-0.5 rounded transition-colors">
              <span className="text-gray-600 shrink-0">[{new Date(log.created_at).toLocaleTimeString()}]</span>
              <span className="text-accent shrink-0">❯</span>
              <span className="text-gray-300 break-words">{log.message}</span>
            </div>
          ))}
        </div>

      </div>
    </div>
  );
}