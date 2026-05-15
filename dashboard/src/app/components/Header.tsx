import { useState, useEffect } from "react";
import { 
  Rocket, Search, Bell, User, LogOut, Settings, HelpCircle, 
  Activity, Shield, LayoutGrid, Globe, Terminal, Box, ChevronRight,
  Loader2, Cpu, Wifi, WifiOff
} from "lucide-react";
import { supabase } from "../../lib/supabase";
import { Job, Application, Profile } from "../useJobs";
import NotificationPane from "./NotificationPane";
import SettingsModal from "./SettingsModal";
import CommandPalette from "./CommandPalette";
import Link from "next/link";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
interface HeaderProps {
  workerCount: number;
  apiError: string | null;
  onSearch: (query: string) => void;
  jobs: Job[];
  apps: Application[];
  profile: Profile | null;
  onViewJob: (id: string) => void;
  onSelectApp: (app: Application) => void;
  isModalOpen?: boolean;
  onOverlayToggle?: (isOpen: boolean) => void;
}

export default function Header({ 
  workerCount, 
  apiError, 
  onSearch, 
  jobs, 
  apps,
  profile,
  onViewJob, 
  onSelectApp,
  isModalOpen = false,
  onOverlayToggle
}: HeaderProps) {
  const [scrolled, setScrolled] = useState(false);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showCommandPalette, setShowCommandPalette] = useState(false);
  const [user, setUser] = useState<any>(null);

  // Notify parent when internal overlays are toggled
  useEffect(() => {
    const isOverlayOpen = showNotifications || showSettings || showCommandPalette;
    if (onOverlayToggle) {
      onOverlayToggle(isOverlayOpen);
    }
  }, [showNotifications, showSettings, showCommandPalette, onOverlayToggle]);

  // Handle clicking outside the profile menu
  const [hasUnread, setHasUnread] = useState(false);
  const router = useRouter();

  // Logic to determine if there are unread notifications
  const checkUnread = () => {
    const saved = localStorage.getItem("dismissed_notifications");
    const dismissedIds: string[] = saved ? JSON.parse(saved) : [];
    const unread = jobs.some(j => !dismissedIds.includes(j.id));
    setHasUnread(unread);
  };

  // Check unread status whenever jobs change
  useEffect(() => {
    checkUnread();
  }, [jobs]);

  // Also re-check when the notification pane is closed
  useEffect(() => {
    if (!showNotifications) {
      checkUnread();
    }
  }, [showNotifications]);

  // Handle clicking outside the profile menu
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Element;
      if (showProfileMenu && !target.closest('#profile-menu-container')) {
        setShowProfileMenu(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showProfileMenu]);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", handleScroll);
    
    // Fetch user profile
    supabase.auth.getUser().then(({ data: { user } }) => {
      setUser(user);
    });

    // Keyboard shortcuts
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        // ALWAYS prevent default browser behavior for Ctrl+K (usually search/address bar)
        e.preventDefault();

        // MANDATORY: Disable palette spawn if ANY modal, overlay, or menu is open
        // This follows the "No Back-Drop Spawning Rule" from GEMINI.md
        const isAnyOverlayOpen = 
          isModalOpen ||          // Deploy, History, Confirmation, Logs (from page.tsx)
          showNotifications ||    // Notification Pane
          showSettings ||         // Settings Modal
          showCommandPalette ||   // Already open
          showProfileMenu;        // Profile Dropdown

        if (isAnyOverlayOpen) return;
        
        setShowCommandPalette(true);
      }

      // Handle ESC to close profile menu
      if (e.key === "Escape" && showProfileMenu) {
        setShowProfileMenu(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener("scroll", handleScroll);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isModalOpen, showNotifications, showSettings, showCommandPalette, showProfileMenu]);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    window.location.reload();
  };

  const userMeta = user?.user_metadata || {};
  const avatarUrl = userMeta.avatar_url;
  const fullName = userMeta.full_name || userMeta.name || "Developer";
  const userInitials = fullName.split(" ").map((n: string) => n[0]).join("").toUpperCase();

  return (
    <>
      <header 
        className={`fixed top-0 left-0 right-0 z-[100] transition-all duration-500 ${
          scrolled || isModalOpen ? 'py-4 px-8' : 'py-8 px-12'
        }`}
      >
        <div 
          className={`max-w-[1600px] mx-auto transition-all duration-500 flex items-center justify-between px-6 rounded-[28px] border relative ${
            scrolled || isModalOpen
              ? 'bg-card/80 backdrop-blur-2xl border-card-border h-20 shadow-2xl' 
              : 'bg-background/20 backdrop-blur-md border-white/5 h-24 shadow-none'
          }`}
        >
          {/* Logo Section */}
          <Link href="/" className="flex items-center gap-6 group cursor-pointer z-10">
            <div className="relative">
              <div className="absolute inset-0 bg-accent blur-xl opacity-20 group-hover:opacity-40 transition-opacity" />
              <div className="relative w-12 h-12 bg-accent rounded-2xl flex items-center justify-center shadow-lg shadow-accent/20 group-hover:scale-105 transition-transform duration-500">
                <Rocket className="w-6 h-6 text-white group-hover:rotate-12 transition-transform" />
              </div>
            </div>
            <div className="hidden sm:block">
              <h1 className="text-xl font-black text-white tracking-tighter uppercase leading-none mb-1">AutoDeploy</h1>
              <div className="flex items-center gap-2">
                 <div className="flex items-center gap-1.5 px-2 py-0.5 bg-white/5 rounded-md border border-white/5">
                    <div className={`w-1.5 h-1.5 rounded-full ${apiError ? 'bg-red-500 animate-pulse' : 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.4)]'}`} />
                    <span className="text-[9px] font-black text-gray-500 uppercase tracking-widest">{apiError ? 'Offline' : 'API Operational'}</span>
                 </div>
                 <div className="flex items-center gap-1.5 px-2 py-0.5 bg-white/5 rounded-md border border-white/5">
                    <div className={`w-1.5 h-1.5 rounded-full ${workerCount === 0 ? 'bg-red-500 animate-pulse' : 'bg-accent shadow-[0_0_8px_rgba(59,130,246,0.4)]'}`} />
                    <span className={`text-[9px] font-black uppercase tracking-widest ${workerCount === 0 ? 'text-red-500' : 'text-gray-400'}`}>{workerCount} Nodes Active</span>
                 </div>
              </div>
            </div>
          </Link>

          {/* Search & Command Bar */}
          <div className="flex-1 max-w-xl mx-8 lg:mx-12">
             <div 
               onClick={() => setShowCommandPalette(true)}
               className="group relative flex items-center bg-white/5 hover:bg-white/10 border border-white/5 hover:border-accent/20 rounded-2xl px-5 py-3 cursor-pointer transition-all duration-300"
             >
                <Search className="w-4 h-4 text-gray-500 group-hover:text-accent transition-colors" />
                <span className="ml-4 text-sm font-medium text-gray-600 group-hover:text-gray-400 transition-colors hidden md:inline">Search or run commands...</span>
                <span className="ml-4 text-sm font-medium text-gray-600 md:hidden">Search...</span>
                <div className="ml-auto hidden md:flex items-center gap-1.5">
                   <span className="px-1.5 py-0.5 bg-white/5 rounded text-[10px] font-black text-gray-600 border border-white/5 uppercase tracking-tighter">Ctrl</span>
                   <span className="px-1.5 py-0.5 bg-white/5 rounded text-[10px] font-black text-gray-600 border border-white/5 uppercase tracking-tighter">K</span>
                </div>
             </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-4">
             <button 
               onClick={() => setShowNotifications(!showNotifications)}
               className="relative p-3 bg-white/5 hover:bg-accent hover:text-white text-gray-400 rounded-2xl transition-all border border-white/5 group"
             >
                <Bell className="w-5 h-5 group-hover:scale-110 transition-transform" />
                {hasUnread && (
                  <span className="absolute top-2.5 right-2.5 w-2.5 h-2.5 bg-accent border-2 border-background rounded-full animate-in zoom-in duration-300" />
                )}
             </button>

             <div className="h-10 w-px bg-white/5 mx-2 hidden sm:block" />

             {/* User Profile Dropdown */}
             <div className="relative" id="profile-menu-container">
                <button 
                  onClick={() => setShowProfileMenu(!showProfileMenu)}
                  className={`flex items-center gap-3 p-1.5 pr-4 rounded-2xl transition-all border group relative z-20 ${showProfileMenu ? 'bg-accent border-accent text-white' : 'bg-white/5 border-white/5 text-gray-400 hover:border-white/10'}`}
                >
                   {avatarUrl ? (
                     <img src={avatarUrl} alt={fullName} className="w-9 h-9 rounded-xl border border-white/10" />
                   ) : (
                     <div className="w-9 h-9 bg-accent/20 rounded-xl flex items-center justify-center text-[10px] font-black text-accent group-hover:bg-white/10 transition-all">
                        {userInitials}
                     </div>
                   )}
                   <div className="text-left hidden lg:block">
                      <p className={`text-[10px] font-black uppercase tracking-tighter leading-none mb-0.5 ${showProfileMenu ? 'text-white' : 'text-white'}`}>{fullName}</p>
                      <p className={`text-[9px] font-bold uppercase tracking-widest ${showProfileMenu ? 'text-white/60' : 'text-gray-600'}`}>Admin Level</p>
                   </div>
                </button>

                {showProfileMenu && (
                  <div className="absolute top-full right-0 mt-3 w-64 bg-card border border-card-border rounded-3xl shadow-2xl p-2 animate-in fade-in slide-in-from-top-4 duration-300 z-[110]">
                       <div className="p-4 border-b border-card-border mb-2 flex flex-col gap-3">
                          <div className="flex items-center gap-3">
                             {avatarUrl ? (
                               <img src={avatarUrl} alt={fullName} className="w-10 h-10 rounded-xl" />
                             ) : (
                               <div className="w-10 h-10 bg-accent rounded-xl flex items-center justify-center text-white font-black text-xs">
                                 {userInitials}
                               </div>
                             )}
                             <div className="overflow-hidden">
                                <p className="text-[11px] font-black text-white uppercase truncate">{fullName}</p>
                                <p className="text-[9px] font-medium text-gray-500 truncate">{user?.email}</p>
                             </div>
                          </div>
                          <div 
                            onClick={() => {
                              if (profile?.username) {
                                navigator.clipboard.writeText(profile.username);
                                toast.success("User ID copied!", { icon: "🆔" });
                              }
                            }}
                            className="px-3 py-2 bg-white/5 rounded-xl border border-white/5 cursor-pointer hover:bg-white/10 transition-all group/uuid"
                          >
                             <p className="text-[8px] font-black text-gray-500 uppercase tracking-widest mb-1 group-hover/uuid:text-accent transition-colors">Your User ID (Click to copy)</p>
                             <p className="text-[10px] font-mono text-gray-400 truncate">{profile?.username || 'Loading...'}</p>
                          </div>
                       </div>
                       
                       <div className="space-y-1">
                          <button 
                            onClick={() => { setShowSettings(true); setShowProfileMenu(false); }}
                            className="w-full flex items-center gap-3 px-4 py-3 hover:bg-white/5 text-gray-400 hover:text-white rounded-2xl transition-all text-xs font-bold"
                          >
                             <Settings className="w-4 h-4" />
                             Settings
                          </button>
                          <button className="w-full flex items-center gap-3 px-4 py-3 hover:bg-white/5 text-gray-400 hover:text-white rounded-2xl transition-all text-xs font-bold">
                             <HelpCircle className="w-4 h-4" />
                             Support
                          </button>
                          <div className="h-px bg-card-border my-2 mx-4" />
                          <button 
                            onClick={handleSignOut}
                            className="w-full flex items-center gap-3 px-4 py-3 hover:bg-red-500/10 text-red-500 rounded-2xl transition-all text-xs font-black uppercase tracking-widest"
                          >
                             <LogOut className="w-4 h-4" />
                             Sign Out
                          </button>
                       </div>
                    </div>
                )}
             </div>
          </div>
        </div>
      </header>

      {/* Overlays */}
      <NotificationPane 
        isOpen={showNotifications} 
        onClose={() => setShowNotifications(false)} 
        jobs={jobs}
        apps={apps}
        onViewJob={onViewJob}
        onRefresh={checkUnread}
      />
      
      <SettingsModal 
        isOpen={showSettings} 
        onClose={() => setShowSettings(false)} 
      />

      <CommandPalette 
        isOpen={showCommandPalette} 
        onClose={() => setShowCommandPalette(false)}
        apps={apps}
        jobs={jobs}
        onViewJob={onViewJob}
        onSelectApp={onSelectApp}
      />
    </>
  );
}
