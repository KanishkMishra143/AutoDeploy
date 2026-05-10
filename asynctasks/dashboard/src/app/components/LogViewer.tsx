"use client";
import { useEffect, useState, useRef } from "react";
import { X, ExternalLink } from "lucide-react";

export default function LogViewer({ jobId, onClose }: { jobId: string; onClose: () => void }) {
  const [logs, setLogs] = useState<any[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [isAtBottom, setIsAtBottom] = useState(true);

  useEffect(() => {
    const ws = new WebSocket(`ws://localhost:8000/ws/logs/${jobId}`);
    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      setLogs(data);
    };
    return () => ws.close();
  }, [jobId]);

  // Track if user has scrolled up
  const handleScroll = () => {
    if (!scrollRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = scrollRef.current;
    // If we are within 50px of the bottom, we consider it "at bottom"
    const atBottom = scrollHeight - scrollTop - clientHeight < 50;
    setIsAtBottom(atBottom);
  };

  // Smart Auto-scroll: Only snap to bottom if the user was already there
  useEffect(() => {
    if (isAtBottom && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs, isAtBottom]);

  // Handle ESC key to close
  useEffect(() => {
    const handleEsc = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleEsc);
    return () => window.removeEventListener("keydown", handleEsc);
  }, [onClose]);

  // Helper to detect and linkify URLs while highlighting the live line
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
      onClick={(e) => e.target === e.currentTarget && onClose()}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 cursor-default"
    >
      <div className="w-full max-w-4xl bg-card border border-card-border rounded-xl shadow-2xl overflow-hidden flex flex-col h-[80vh] cursor-default">
        
        <div className="bg-background px-4 py-3 border-b border-card-border flex justify-between items-center">
          <div className="flex items-center gap-2">
            <div className="flex gap-1.5">
              <div className="w-3 h-3 rounded-full bg-red-500/20 border border-red-500/50"></div>
              <div className="w-3 h-3 rounded-full bg-yellow-500/20 border border-yellow-500/50"></div>
              <div className="w-3 h-3 rounded-full bg-green-500/20 border border-green-500/50"></div>
            </div>
            <span className="text-xs font-mono text-gray-400 ml-2">autodeploy-worker ~ {jobId.split('-')[0]}</span>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="relative flex-1 overflow-hidden flex flex-col">
          <div 
            className="flex-1 bg-[#0a0a0a] p-4 font-mono text-sm overflow-y-auto cursor-text" 
            ref={scrollRef}
            onScroll={handleScroll}
          >
            {logs.length === 0 && <p className="text-gray-600 italic">Waiting for connection to worker...</p>}
            {logs.map((log, i) => {
              const isLiveLine = log.message.includes("Application is live at");
              return (
                <div 
                  key={i} 
                  className={`mb-1.5 flex gap-4 px-2 py-0.5 rounded transition-all ${
                    isLiveLine 
                      ? "bg-green-500/10 border-l-2 border-green-500 py-2 my-2 shadow-[0_0_15px_rgba(34,197,94,0.1)]" 
                      : "hover:bg-white/5"
                  }`}
                >
                  <span className="text-gray-600 shrink-0">[{new Date(log.created_at).toLocaleTimeString()}]</span>
                  <span className="text-accent shrink-0">❯</span>
                  <span className={`${isLiveLine ? "text-white font-semibold" : "text-gray-300"} break-words`}>
                    {renderLogMessage(log.message)}
                  </span>
                </div>
              );
            })}
          </div>
          
          {!isAtBottom && logs.length > 0 && (
            <button 
              onClick={() => {
                setIsAtBottom(true);
                if(scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
              }}
              className="absolute bottom-6 left-1/2 -translate-x-1/2 bg-accent/90 hover:bg-accent text-white px-4 py-1.5 rounded-full text-xs font-bold shadow-lg transition-all animate-in fade-in slide-in-from-bottom-2"
            >
              Resume Auto-scroll
            </button>
          )}
        </div>

      </div>
    </div>
  );
}