"use client";
import { useState, useEffect } from "react";
import { X, User, Settings as SettingsIcon, Bell, Shield, CreditCard, Upload, ChevronRight, Key, Plus, Trash2, Copy, Check, Loader2 } from "lucide-react";
import { supabase } from "../../lib/supabase";
import { useJobs } from "../useJobs";
import Link from "next/link";
import toast from "react-hot-toast";

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function SettingsModal({ isOpen, onClose }: SettingsModalProps) {
  const { profile, settings, apiKeys, updateSettings, createApiKey, revokeApiKey } = useJobs();
  const [activeTab, setActiveTab] = useState<'profile' | 'notifications' | 'security'>('profile');
  const [newKeyName, setNewKeyName] = useState("");
  const [isCreatingKey, setIsCreatingKey] = useState(false);
  const [newlyCreatedKey, setNewlyCreatedKey] = useState<string | null>(null);

  const handleToggleNotification = async (key: string) => {
    if (!settings) return;
    
    const updatedNotifications = {
      ...settings.notifications_enabled,
      [key]: !settings.notifications_enabled[key]
    };
    
    try {
      await updateSettings({
        ...settings,
        notifications_enabled: updatedNotifications
      });
      toast.success("Preference updated");
    } catch (err) {
      toast.error("Failed to update preference");
    }
  };

  const handleCreateKey = async () => {
    if (!newKeyName) return;
    setIsCreatingKey(true);
    try {
      const result = await createApiKey(newKeyName);
      setNewlyCreatedKey(result.secret_key);
      setNewKeyName("");
      toast.success("API Key generated!");
    } catch (err) {
      toast.error("Failed to generate key");
    } finally {
      setIsCreatingKey(false);
    }
  };

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        const allModals = Array.from(document.querySelectorAll('.fixed.inset-0'));
        const topModal = allModals.reduce((prev, curr) => {
          const prevZ = parseInt(window.getComputedStyle(prev).zIndex) || 0;
          const currZ = parseInt(window.getComputedStyle(curr).zIndex) || 0;
          return currZ > prevZ ? curr : prev;
        }, allModals[0]);

        const myWrapper = document.getElementById('settings-modal-wrapper');
        if (topModal === myWrapper) {
          e.stopImmediatePropagation();
          onClose();
        }
      }
    };
    window.addEventListener("keydown", handleEsc, true);
    return () => window.removeEventListener("keydown", handleEsc, true);
  }, [onClose]);

  if (!isOpen) return null;

  const avatarUrl = profile?.avatar_url;
  const fullName = profile?.full_name || profile?.username || "Developer";

  return (
    <div 
      id="settings-modal-wrapper"
      className="fixed inset-0 z-[700] flex items-center justify-center p-4 animate-in fade-in duration-200 pointer-events-none"
    >
      <div 
        className="fixed inset-0 bg-black/60 backdrop-blur-md pointer-events-auto cursor-pointer" 
        onClick={onClose}
      />
      
      <div className="relative w-full max-w-2xl bg-card border border-card-border rounded-[32px] shadow-2xl overflow-hidden flex flex-col h-[70vh] animate-in zoom-in-95 duration-200 pointer-events-auto">
        {/* Header */}
        <div className="p-6 border-b border-card-border flex justify-between items-center bg-background/50">
          <div className="flex items-center gap-3">
             <div className="p-2 bg-accent/10 rounded-xl">
                <SettingsIcon className="w-5 h-5 text-accent" />
             </div>
             <h3 className="text-xl font-black text-white uppercase tracking-tighter">System Settings</h3>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-white/5 rounded-full text-gray-400 hover:text-white transition-all">
             <X className="w-6 h-6" />
          </button>
        </div>

        <div className="flex flex-1 overflow-hidden">
           {/* Sidebar */}
           <aside className="w-48 border-r border-card-border bg-background/30 p-4 flex flex-col gap-1">
              {[
                { id: 'profile', label: 'Profile', icon: User },
                { id: 'notifications', label: 'Alerts', icon: Bell },
                { id: 'security', label: 'Security', icon: Shield }
              ].map(tab => (
                <button 
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === tab.id ? 'bg-accent/10 text-accent' : 'text-gray-500 hover:bg-white/5 hover:text-gray-300'}`}
                >
                  <tab.icon className="w-4 h-4" />
                  {tab.label}
                </button>
              ))}
              
              <div className="mt-auto pt-4 border-t border-card-border">
                 <Link 
                   href="/settings" 
                   onClick={onClose}
                   className="w-full flex items-center justify-between px-4 py-3 bg-white/5 hover:bg-accent hover:text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-all group"
                 >
                    More Settings
                    <ChevronRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
                 </Link>
              </div>
           </aside>

           {/* Content */}
           <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
              {activeTab === 'profile' && (
                <div className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-300">
                   <div className="flex items-center gap-6">
                      <div className="relative group">
                         {avatarUrl ? (
                           <img src={avatarUrl} alt={fullName} className="w-20 h-20 rounded-3xl border-2 border-accent/30 object-cover" />
                         ) : (
                           <div className="w-20 h-20 bg-accent/10 rounded-3xl border-2 border-dashed border-accent/30 flex items-center justify-center group-hover:border-accent transition-all">
                              <User className="w-8 h-8 text-accent opacity-50" />
                           </div>
                         )}
                         <div className="absolute inset-0 bg-black/60 rounded-3xl opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center cursor-pointer">
                            <Upload className="w-5 h-5 text-white" />
                         </div>
                      </div>
                      <div>
                         <h4 className="text-sm font-bold text-white mb-1">Developer Identity</h4>
                         <p className="text-xs text-gray-500">Your profile data is synced with GitHub.</p>
                         <button className="text-[10px] font-black text-accent uppercase tracking-widest mt-2 hover:underline">Sync Profile</button>
                      </div>
                   </div>

                   <div className="space-y-4">
                      <div>
                         <label className="block text-[10px] font-black text-gray-500 uppercase tracking-widest mb-2">User ID (Username)</label>
                         <input 
                           type="text" 
                           value={profile?.username || ""}
                           readOnly
                           className="w-full bg-background/50 border border-card-border rounded-xl px-4 py-3 text-sm text-gray-400 cursor-not-allowed font-mono"
                         />
                      </div>
                      <div className="p-4 bg-accent/5 rounded-2xl border border-accent/10">
                        <p className="text-[10px] text-accent font-black uppercase tracking-widest mb-1">Account Authority</p>
                        <p className="text-xs text-gray-400">Managed via Supabase Auth</p>
                      </div>
                   </div>
                </div>
              )}

              {activeTab === 'notifications' && (
                <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
                   <h4 className="text-sm font-bold text-white mb-4 uppercase tracking-tight">Notification Channels</h4>
                   <div className="space-y-3">
                      {[
                        { key: 'deploy_success', label: 'Deployment Success' },
                        { key: 'deploy_failure', label: 'Deployment Failure' },
                        { key: 'system_health', label: 'System Health Alerts' },
                        { key: 'weekly_report', label: 'Weekly Cluster Report' }
                      ].map(item => {
                        const isEnabled = settings?.notifications_enabled[item.key] || false;
                        return (
                          <div key={item.key} className="flex items-center justify-between p-4 bg-white/5 rounded-2xl border border-card-border">
                             <span className="text-xs font-bold text-gray-300">{item.label}</span>
                             <button 
                               onClick={() => handleToggleNotification(item.key)}
                               className={`w-10 h-5 rounded-full relative transition-all ${isEnabled ? 'bg-accent' : 'bg-gray-800'}`}
                             >
                                <div className={`absolute top-1 w-3 h-3 rounded-full bg-white transition-all ${isEnabled ? 'left-6' : 'left-1'}`} />
                             </button>
                          </div>
                        );
                      })}
                   </div>
                </div>
              )}

              {activeTab === 'security' && (
                <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
                   <div className="flex justify-between items-center mb-4">
                      <h4 className="text-sm font-bold text-white uppercase tracking-tight">API Access Keys</h4>
                      <div className="flex gap-2">
                        <input 
                          type="text"
                          placeholder="Key Name"
                          className="bg-background border border-card-border rounded-lg px-3 py-1 text-[10px] outline-none focus:border-accent"
                          value={newKeyName}
                          onChange={(e) => setNewKeyName(e.target.value)}
                        />
                        <button 
                          onClick={handleCreateKey}
                          disabled={!newKeyName || isCreatingKey}
                          className="p-1.5 bg-accent text-white rounded-lg disabled:opacity-50"
                        >
                          {isCreatingKey ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                        </button>
                      </div>
                   </div>

                   {newlyCreatedKey && (
                     <div className="p-4 bg-green-500/10 border border-green-500/20 rounded-2xl mb-6">
                        <p className="text-[10px] font-black text-green-500 uppercase tracking-widest mb-2">New Secret Key (Copy now, it won't be shown again!)</p>
                        <div className="flex items-center gap-2 bg-black/40 p-3 rounded-xl">
                           <code className="text-xs text-white font-mono truncate flex-1">{newlyCreatedKey}</code>
                           <button 
                            onClick={() => {
                              navigator.clipboard.writeText(newlyCreatedKey);
                              toast.success("Copied to clipboard");
                            }}
                            className="p-2 hover:bg-white/10 rounded-lg text-white"
                           >
                              <Copy className="w-4 h-4" />
                           </button>
                        </div>
                        <button 
                          onClick={() => setNewlyCreatedKey(null)}
                          className="mt-4 w-full py-2 bg-green-500 text-white text-[10px] font-black rounded-xl uppercase tracking-widest"
                        >
                          I have saved it
                        </button>
                     </div>
                   )}

                   <div className="space-y-3">
                      {apiKeys.length === 0 ? (
                        <div className="text-center py-8 border-2 border-dashed border-card-border rounded-2xl">
                           <Key className="w-8 h-8 text-gray-800 mx-auto mb-2" />
                           <p className="text-[10px] font-black text-gray-600 uppercase">No active API keys</p>
                        </div>
                      ) : (
                        apiKeys.map(key => (
                          <div key={key.id} className="flex items-center justify-between p-4 bg-white/5 rounded-2xl border border-card-border group">
                             <div className="flex items-center gap-4">
                                <div className="p-2 bg-white/5 rounded-xl">
                                   <Key className="w-4 h-4 text-gray-500" />
                                </div>
                                <div>
                                   <p className="text-xs font-bold text-white">{key.name}</p>
                                   <p className="text-[10px] font-mono text-gray-500">{key.key_prefix}••••••••••••</p>
                                </div>
                             </div>
                             <div className="flex items-center gap-4">
                                <span className="text-[8px] font-black text-gray-600 uppercase">Created {new Date(key.created_at).toLocaleDateString()}</span>
                                <button 
                                  onClick={() => revokeApiKey(key.id)}
                                  className="p-2 text-gray-600 hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-all opacity-0 group-hover:opacity-100"
                                >
                                   <Trash2 className="w-4 h-4" />
                                </button>
                             </div>
                          </div>
                        ))
                      )}
                   </div>
                </div>
              )}
           </div>
        </div>
      </div>
    </div>
  );
}
