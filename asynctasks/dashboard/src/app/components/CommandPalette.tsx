"use client";
import { useState, useEffect, useRef } from "react";
import { Search, Box, Globe, GitBranch, Command, ChevronRight } from "lucide-react";
import { Application } from "../useJobs";

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  apps: Application[];
  onSelectApp: (app: Application) => void;
}

export default function CommandPalette({ isOpen, onClose, apps, onSelectApp }: CommandPaletteProps) {
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const filteredApps = apps.filter(app => 
    app.name.toLowerCase().includes(query.toLowerCase()) ||
    app.repo_url.toLowerCase().includes(query.toLowerCase())
  );

  useEffect(() => {
    if (isOpen) {
      setQuery("");
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 10);
    }
  }, [isOpen]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;

      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex(prev => (prev + 1) % Math.max(1, filteredApps.length));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex(prev => (prev - 1 + filteredApps.length) % Math.max(1, filteredApps.length));
      } else if (e.key === "Enter") {
        if (filteredApps[selectedIndex]) {
          onSelectApp(filteredApps[selectedIndex]);
          onClose();
        }
      } else if (e.key === "Escape") {
        const allModals = Array.from(document.querySelectorAll('.fixed.inset-0'));
        const topModal = allModals.reduce((prev, curr) => {
          const prevZ = parseInt(window.getComputedStyle(prev).zIndex) || 0;
          const currZ = parseInt(window.getComputedStyle(curr).zIndex) || 0;
          return currZ > prevZ ? curr : prev;
        }, allModals[0]);

        const myWrapper = document.getElementById('command-palette-wrapper');
        if (topModal === myWrapper) {
          e.stopImmediatePropagation();
          onClose();
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown, true);
    return () => window.removeEventListener("keydown", handleKeyDown, true);
  }, [isOpen, filteredApps, selectedIndex, onClose, onSelectApp]);

  if (!isOpen) return null;

  return (
    <div 
      id="command-palette-wrapper"
      className="fixed inset-0 z-[200] flex items-start justify-center pt-[15vh] px-4 animate-in fade-in duration-200 pointer-events-none"
    >
      <div 
        className="fixed inset-0 bg-black/60 backdrop-blur-md pointer-events-auto cursor-pointer" 
        onClick={onClose}
      />
      
      <div className="relative w-full max-w-2xl bg-card border border-card-border rounded-3xl shadow-2xl overflow-hidden flex flex-col animate-in zoom-in-95 duration-200 pointer-events-auto">
        <div className="flex items-center px-6 py-4 border-b border-card-border bg-background/50">
          <Search className="w-5 h-5 text-accent mr-4" />
          <input 
            ref={inputRef}
            type="text" 
            placeholder="Search applications, repositories, or branches..."
            className="flex-1 bg-transparent border-none text-white text-lg font-medium outline-none placeholder:text-gray-600"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedIndex(0);
            }}
          />
          <div className="ml-auto hidden md:flex items-center gap-1.5">
             <span className="px-1.5 py-0.5 bg-white/5 rounded text-[10px] font-black text-gray-600 border border-white/5 uppercase tracking-tighter">Ctrl</span>
             <span className="px-1.5 py-0.5 bg-white/5 rounded text-[10px] font-black text-gray-600 border border-white/5 uppercase tracking-tighter">K</span>
          </div>
        </div>

        <div className="flex-1 max-h-[50vh] overflow-y-auto p-2 custom-scrollbar">
          {filteredApps.length === 0 ? (
             <div className="py-12 text-center">
                <Box className="w-12 h-12 text-gray-800 mx-auto mb-4" />
                <p className="text-gray-500 font-bold uppercase tracking-widest text-xs">No matching applications</p>
             </div>
          ) : (
            filteredApps.map((app, index) => {
              const isSelected = index === selectedIndex;
              return (
                <div 
                  key={app.id}
                  onClick={() => {
                    onSelectApp(app);
                    onClose();
                  }}
                  onMouseEnter={() => setSelectedIndex(index)}
                  className={`flex items-center justify-between p-4 rounded-2xl cursor-pointer transition-all ${isSelected ? 'bg-accent/10 border border-accent/20 translate-x-1' : 'border border-transparent hover:bg-white/5'}`}
                >
                  <div className="flex items-center gap-4">
                    <div className={`p-3 rounded-xl ${isSelected ? 'bg-accent text-white' : 'bg-white/5 text-gray-400'} transition-colors`}>
                       <Box className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className={`text-sm font-black uppercase tracking-tight ${isSelected ? 'text-white' : 'text-gray-300'}`}>{app.name}</h4>
                      <div className="flex items-center gap-3 mt-0.5">
                        <p className="text-[10px] text-gray-500 font-mono flex items-center gap-1">
                          <Globe className="w-3 h-3" /> {app.repo_url.split('/').pop()}
                        </p>
                        <p className="text-[10px] text-accent/60 font-bold flex items-center gap-1 uppercase tracking-widest">
                          <GitBranch className="w-3 h-3" /> {app.branch || 'main'}
                        </p>
                      </div>
                    </div>
                  </div>
                  
                  <div className={`flex items-center gap-2 transition-opacity ${isSelected ? 'opacity-100' : 'opacity-0'}`}>
                     <span className="text-[9px] font-black text-accent uppercase tracking-widest">Open Application</span>
                     <ChevronRight className="w-4 h-4 text-accent" />
                  </div>
                </div>
              )
            })
          )}
        </div>

        <div className="p-4 bg-background/80 border-t border-card-border flex items-center gap-6 justify-center">
           <div className="flex items-center gap-2">
              <span className="px-1.5 py-0.5 bg-white/5 border border-card-border rounded text-[9px] text-gray-500 font-black">↑↓</span>
              <span className="text-[9px] text-gray-600 font-bold uppercase tracking-widest">Navigate</span>
           </div>
           <div className="flex items-center gap-2">
              <span className="px-1.5 py-0.5 bg-white/5 border border-card-border rounded text-[9px] text-gray-500 font-black">ENTER</span>
              <span className="text-[9px] text-gray-600 font-bold uppercase tracking-widest">Select</span>
           </div>
           <div className="flex items-center gap-2">
              <span className="px-1.5 py-0.5 bg-white/5 border border-card-border rounded text-[9px] text-gray-500 font-black">ESC</span>
              <span className="text-[9px] text-gray-600 font-bold uppercase tracking-widest">Close</span>
           </div>
        </div>
      </div>
    </div>
  );
}
