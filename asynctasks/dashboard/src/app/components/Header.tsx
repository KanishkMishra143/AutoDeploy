"use client";
import { Rocket, LayoutGrid, User, Settings as SettingsIcon, LogOut, Search, Bell, Command } from "lucide-react";
import { useState, useEffect } from "react";
import Link from "next/link";
import NotificationPane from "./NotificationPane";
import CommandPalette from "./CommandPalette";
import SettingsModal from "./SettingsModal";
import { Job, Application } from "../useJobs";

interface HeaderProps {
  workerCount: number;
  apiError: any;
  onSearch: (query: string) => void;
  jobs?: Job[];
  apps?: Application[];
  onViewJob?: (jobId: string) => void;
  onSelectApp?: (app: Application) => void;
}

export default function Header({ 
  workerCount, 
  apiError, 
  onSearch, 
  jobs = [], 
  apps = [], 
  onViewJob = () => {},
  onSelectApp = () => {}
}: HeaderProps) {
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  // Global Key Listeners
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setIsSearchOpen(true);
      }
      if (e.key === "Escape") {
        setIsProfileOpen(false);
        setIsNotificationsOpen(false);
        setIsSearchOpen(false);
        setIsSettingsOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-xl border-b border-card-border px-8 h-20 flex items-center justify-between">
      <div className="flex items-center gap-8">
         {/* Logo Section */}
         <Link href="/" className="flex items-center gap-3 group">
            <div className="w-10 h-10 bg-accent rounded-xl flex items-center justify-center shadow-lg shadow-accent/20 group-hover:scale-110 transition-transform">
               <Rocket className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-black tracking-tighter text-white uppercase leading-none">AutoDeploy</h1>
              <p className="text-[10px] font-bold text-accent tracking-[0.2em] uppercase opacity-80">Orchestrator</p>
            </div>
         </Link>
         
         <div className="h-8 w-px bg-card-border" />
         
         {/* Command Trigger */}
         <button 
            onClick={() => setIsSearchOpen(true)}
            className="flex items-center gap-3 px-4 py-2 bg-white/5 border border-card-border rounded-xl text-gray-500 hover:border-accent/50 hover:bg-white/10 transition-all group w-64 text-left"
         >
            <Search className="w-4 h-4 group-hover:text-accent transition-colors" />
            <span className="text-xs font-medium flex-1">Search cluster...</span>
            <div className="flex items-center gap-1 px-1.5 py-0.5 bg-background border border-card-border rounded text-[9px] font-black group-hover:border-accent/30">
               <Command className="w-2.5 h-2.5" />
               <span>K</span>
            </div>
         </button>

         <CommandPalette 
           isOpen={isSearchOpen} 
           onClose={() => setIsSearchOpen(false)} 
           apps={apps}
           onSelectApp={onSelectApp}
         />
      </div>

      <div className="flex items-center gap-6">
         {/* System Health */}
         <div className="flex gap-4">
            <div className="flex flex-col items-end">
              <div className="flex items-center gap-2">
                 <div className={`w-1.5 h-1.5 rounded-full ${apiError ? "bg-red-500 animate-pulse" : "bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.5)]"}`} />
                 <span className="text-[10px] font-black text-white uppercase tracking-wider">{apiError ? "API Offline" : "System Live"}</span>
              </div>
              <p className="text-[9px] font-bold text-gray-500 uppercase tracking-tighter mt-0.5">{workerCount} Cluster Nodes</p>
            </div>
         </div>

         <div className="h-8 w-px bg-card-border" />

         {/* Actions */}
         <div className="flex items-center gap-3">
            <div className="relative">
              <button 
                onClick={() => setIsNotificationsOpen(!isNotificationsOpen)}
                className={`w-10 h-10 bg-white/5 hover:bg-white/10 border border-card-border rounded-xl flex items-center justify-center transition-all text-gray-400 hover:text-white ${isNotificationsOpen ? 'border-accent text-accent' : ''}`}
              >
                 <Bell className="w-4 h-4" />
                 {jobs.some(j => j.status === 'running') && (
                    <span className="absolute -top-1 -right-1 w-3 h-3 bg-accent rounded-full border-2 border-background animate-pulse" />
                 )}
              </button>
              
              <NotificationPane 
                isOpen={isNotificationsOpen} 
                onClose={() => setIsNotificationsOpen(false)}
                jobs={jobs}
                apps={apps}
                onViewJob={onViewJob}
              />
            </div>
            
            <div className="relative">
              <button 
                onClick={() => setIsProfileOpen(!isProfileOpen)}
                className={`w-11 h-11 bg-white/5 hover:bg-white/10 border border-card-border rounded-xl flex items-center justify-center transition-all overflow-hidden ${isProfileOpen ? 'border-accent ring-4 ring-accent/10' : ''}`}
              >
                 <User className="w-5 h-5 text-gray-400" />
              </button>
              
              {isProfileOpen && (
                <>
                  <div className="fixed inset-0 z-[-1]" onClick={() => setIsProfileOpen(false)} />
                  <div className="absolute right-0 top-full pt-3 animate-in fade-in slide-in-from-top-2 duration-200">
                     <div className="w-64 bg-card border border-card-border rounded-2xl shadow-2xl p-2 overflow-hidden">
                        <div className="px-4 py-3 border-b border-card-border mb-1">
                           <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-0.5">Signed in as</p>
                           <p className="text-xs font-bold text-white truncate">developer@autodeploy.local</p>
                        </div>
                        <button 
                          onClick={() => {
                            setIsSettingsOpen(true);
                            setIsProfileOpen(false);
                          }}
                          className="w-full px-4 py-2.5 hover:bg-white/5 text-left text-xs font-bold text-gray-300 hover:text-white rounded-lg transition-all flex items-center gap-3"
                        >
                           <SettingsIcon className="w-4 h-4 text-accent" />
                           User Settings
                        </button>
                        <div className="h-px bg-card-border my-1" />
                        <button className="w-full px-4 py-2.5 hover:bg-red-500/10 text-left text-xs font-bold text-red-500 rounded-lg transition-all flex items-center gap-3">
                           <LogOut className="w-4 h-4" />
                           Sign Out
                        </button>
                     </div>
                  </div>
                </>
              )}
            </div>
         </div>
      </div>
      
      <SettingsModal isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} />
    </header>
  );
}
