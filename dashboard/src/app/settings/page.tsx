"use client";
import { useState, useEffect } from "react";
import { useJobs } from "../useJobs";
import { Settings as SettingsIcon, Shield, Bell, CreditCard, ChevronLeft, AlertTriangle, User, Upload, Key, Plus, Trash2, Copy, Loader2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Header from "../components/Header";
import PurgeModal from "../components/PurgeModal";
import toast from "react-hot-toast";
import { supabase } from "../../lib/supabase";

type TabType = 'General' | 'Security' | 'Notifications' | 'Billing' | 'Danger';

export default function SettingsPage() {
  const { workerCount, error, jobs, apps, profile, settings, apiKeys, updateSettings, createApiKey, revokeApiKey } = useJobs();
  const [activeTab, setActiveTab] = useState<TabType>('General');
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [isPurgeModalOpen, setIsPurgeModalOpen] = useState(false);
  const [newKeyName, setNewKeyName] = useState("");
  const [isCreatingKey, setIsCreatingKey] = useState(false);
  const [newlyCreatedKey, setNewlyCreatedKey] = useState<string | null>(null);
  const router = useRouter();

  const onViewJob = (jobId: string) => {
    router.push(`/?jobId=${jobId}`);
  };

  const handleToggleNotification = async (key: string) => {
    if (!settings) return;
    const updatedNotifications = {
      ...settings.notifications_enabled,
      [key]: !settings.notifications_enabled[key]
    };
    try {
      await updateSettings({ ...settings, notifications_enabled: updatedNotifications });
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

  const handlePurgeCluster = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch("http://127.0.0.1:8000/apps/purge", { 
        method: "DELETE",
        headers: {
          "Authorization": `Bearer ${session?.access_token}`,
        }
      });
      if (res.ok) {
        toast.success("Cluster purged successfully.");
        router.push("/");
      } else {
        toast.error("Failed to purge cluster.");
      }
    } catch (err) {
      console.error(err);
      toast.error("Connection error during purge.");
    }
  };

  const tabs: { label: TabType; icon: any; color?: string }[] = [
    { label: 'General', icon: SettingsIcon },
    { label: 'Security', icon: Shield },
    { label: 'Notifications', icon: Bell },
    { label: 'Billing', icon: CreditCard },
    { label: 'Danger', icon: AlertTriangle, color: 'text-red-500' }
  ];

  const fullName = profile?.full_name || profile?.username || "Developer";
  const avatarUrl = profile?.avatar_url;

  return (
    <div className="min-h-screen bg-background text-white">
      <Header 
        workerCount={workerCount} 
        apiError={error} 
        onSearch={() => {}} 
        jobs={jobs}
        apps={apps}
        profile={profile}
        onViewJob={onViewJob}
        onSelectApp={(app) => router.push(`/?appId=${app.id}`)}
        isModalOpen={isPurgeModalOpen}
      />

      <main className="pt-52 pb-20 px-8">
        <div className="max-w-4xl mx-auto">
          <Link 
            href="/"
            className="flex items-center gap-2 text-gray-500 hover:text-white transition-colors mb-8 group"
          >
            <ChevronLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
            <span className="text-xs font-bold uppercase tracking-widest">Back to Canvas</span>
          </Link>

          <div className="mb-12">
            <h2 className="text-4xl font-black tracking-tighter text-white uppercase mb-2">Account Settings</h2>
            <p className="text-gray-500 text-sm font-medium">Manage your personal preferences and cluster configuration.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            <aside className="space-y-1">
               {tabs.map(item => (
                 <button 
                   key={item.label}
                   onClick={() => setActiveTab(item.label)}
                   className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-bold uppercase tracking-widest transition-all ${activeTab === item.label ? 'bg-accent/10 text-accent' : `text-gray-500 hover:bg-white/5 hover:text-gray-300 ${item.color || ''}`}`}
                 >
                   <item.icon className="w-4 h-4" />
                   {item.label === 'Danger' ? 'Danger Zone' : item.label}
                 </button>
               ))}
            </aside>

            <div className="md:col-span-3 space-y-6">
               {activeTab === 'General' && (
                 <div className="bg-card border border-card-border rounded-[24px] p-8 animate-in fade-in slide-in-from-bottom-4 duration-300">
                    <h3 className="text-lg font-bold text-white mb-6">Profile Information</h3>
                    
                    <div className="flex items-center gap-8 mb-8 p-6 bg-white/5 rounded-2xl border border-card-border">
                       <div className="relative group">
                          {avatarUrl ? (
                            <img src={avatarUrl} className="w-24 h-24 rounded-2xl border-2 border-accent/20 object-cover" />
                          ) : (
                            <div className="w-24 h-24 bg-accent/10 rounded-2xl border-2 border-dashed border-accent/20 flex items-center justify-center group-hover:border-accent/50 transition-all">
                               <User className="w-8 h-8 text-accent opacity-40" />
                            </div>
                          )}
                          <div className="absolute inset-0 bg-black/60 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center cursor-pointer">
                             <Upload className="w-4 h-4 text-white mb-1" />
                             <span className="text-[8px] font-black text-white uppercase">Upload</span>
                          </div>
                       </div>
                       <div>
                          <h4 className="text-sm font-bold text-white mb-1 uppercase tracking-tight">Avatar Image</h4>
                          <p className="text-xs text-gray-500 mb-3">Synced from GitHub.</p>
                          <button className="text-[10px] font-black text-accent uppercase tracking-widest hover:underline">Sync Profile</button>
                       </div>
                    </div>

                    <div className="space-y-6">
                      <div>
                         <label className="block text-[10px] font-black text-gray-500 uppercase tracking-[0.2em] mb-2">User ID (Username)</label>
                         <input 
                           type="text" 
                           value={profile?.username || ""}
                           readOnly
                           className="w-full bg-background border border-card-border rounded-xl px-4 py-3 text-sm text-gray-500 focus:border-accent outline-none transition-all cursor-not-allowed opacity-60 font-mono"
                         />
                      </div>
                      <div className="p-4 bg-accent/5 rounded-2xl border border-accent/10">
                        <p className="text-[10px] text-accent font-black uppercase tracking-widest mb-1">Identity Authority</p>
                        <p className="text-xs text-gray-400">Your identity is managed via GitHub and Supabase Auth.</p>
                      </div>
                    </div>
                 </div>
               )}

               {activeTab === 'Security' && (
                 <div className="bg-card border border-card-border rounded-[24px] p-8 animate-in fade-in slide-in-from-bottom-4 duration-300">
                    <div className="flex justify-between items-center mb-6">
                       <div>
                          <h3 className="text-lg font-bold text-white mb-1">API Access Keys</h3>
                          <p className="text-sm text-gray-500">Manage keys for CLI and automated deployments.</p>
                       </div>
                       <div className="flex gap-2">
                          <input 
                            type="text"
                            placeholder="Key Name (e.g. CLI Laptop)"
                            className="bg-background border border-card-border rounded-xl px-4 py-2 text-xs outline-none focus:border-accent w-48"
                            value={newKeyName}
                            onChange={(e) => setNewKeyName(e.target.value)}
                          />
                          <button 
                            onClick={handleCreateKey}
                            disabled={!newKeyName || isCreatingKey}
                            className="p-2.5 bg-accent text-white rounded-xl disabled:opacity-50 transition-all active:scale-95"
                          >
                             {isCreatingKey ? <Loader2 className="w-5 h-5 animate-spin" /> : <Plus className="w-5 h-5" />}
                          </button>
                       </div>
                    </div>

                    {newlyCreatedKey && (
                      <div className="p-6 bg-green-500/10 border border-green-500/20 rounded-2xl mb-8 animate-in zoom-in-95">
                         <p className="text-[10px] font-black text-green-500 uppercase tracking-widest mb-3">Secret Key Generated</p>
                         <p className="text-xs text-gray-400 mb-4 font-medium">This key will never be shown again. Please save it securely.</p>
                         <div className="flex items-center gap-2 bg-black/40 p-4 rounded-xl border border-white/5">
                            <code className="text-sm text-white font-mono truncate flex-1">{newlyCreatedKey}</code>
                            <button 
                             onClick={() => {
                               navigator.clipboard.writeText(newlyCreatedKey);
                               toast.success("Copied to clipboard");
                             }}
                             className="p-2.5 hover:bg-white/10 rounded-xl text-white transition-all"
                            >
                               <Copy className="w-5 h-5" />
                            </button>
                         </div>
                         <button 
                           onClick={() => setNewlyCreatedKey(null)}
                           className="mt-6 w-full py-3 bg-green-500 text-white text-[11px] font-black rounded-xl uppercase tracking-widest hover:bg-green-600 transition-all"
                         >
                           I have securely saved this key
                         </button>
                      </div>
                    )}

                    <div className="space-y-4">
                       {apiKeys.length === 0 ? (
                         <div className="py-12 border-2 border-dashed border-card-border rounded-[24px] text-center">
                            <Key className="w-12 h-12 text-gray-800 mx-auto mb-4" />
                            <p className="text-xs font-bold text-gray-600 uppercase tracking-widest">No active API keys found</p>
                         </div>
                       ) : (
                         apiKeys.map(key => (
                           <div key={key.id} className="flex items-center justify-between p-5 bg-white/5 rounded-2xl border border-card-border group hover:border-accent/30 transition-all">
                              <div className="flex items-center gap-5">
                                 <div className="w-12 h-12 bg-white/5 rounded-xl flex items-center justify-center">
                                    <Key className="w-6 h-6 text-gray-500" />
                                 </div>
                                 <div>
                                    <p className="text-sm font-bold text-white">{key.name}</p>
                                    <p className="text-[10px] font-mono text-gray-500 uppercase tracking-tighter mt-1">{key.key_prefix}••••••••••••••••••••••••••••</p>
                                 </div>
                              </div>
                              <div className="flex items-center gap-8">
                                 <div className="text-right">
                                    <p className="text-[10px] font-black text-gray-600 uppercase tracking-widest mb-1">Created</p>
                                    <p className="text-[10px] font-bold text-gray-400">{new Date(key.created_at).toLocaleDateString()}</p>
                                 </div>
                                 <button 
                                   onClick={() => revokeApiKey(key.id)}
                                   className="p-3 text-gray-600 hover:text-red-500 hover:bg-red-500/10 rounded-xl transition-all opacity-0 group-hover:opacity-100"
                                   title="Revoke Key"
                                 >
                                    <Trash2 className="w-5 h-5" />
                                 </button>
                              </div>
                           </div>
                         ))
                       )}
                    </div>
                 </div>
               )}

               {activeTab === 'Notifications' && (
                 <div className="bg-card border border-card-border rounded-[24px] p-8 animate-in fade-in slide-in-from-bottom-4 duration-300">
                    <h3 className="text-lg font-bold text-white mb-2">Notification Center</h3>
                    <p className="text-sm text-gray-500 mb-8">Configure how and when you want to be alerted.</p>
                    
                    <div className="grid grid-cols-1 gap-4">
                       {[
                         { key: 'deploy_success', label: 'Deployment Success', desc: 'Alert when an application successfully goes live.' },
                         { key: 'deploy_failure', label: 'Deployment Failure', desc: 'Urgent alerts for failed build pipelines.' },
                         { key: 'system_health', label: 'System Health Alerts', desc: 'Critical alerts regarding cluster node health.' },
                         { key: 'weekly_report', label: 'Weekly Cluster Report', desc: 'Summary of resource usage and deployment velocity.' }
                       ].map(item => {
                         const isEnabled = settings?.notifications_enabled[item.key] || false;
                         return (
                           <div key={item.key} className="flex items-center justify-between p-6 bg-white/5 rounded-2xl border border-card-border hover:border-white/10 transition-all">
                              <div className="flex gap-4">
                                 <div className={`p-3 rounded-xl bg-white/5 ${isEnabled ? 'text-accent' : 'text-gray-600'}`}>
                                    <Bell className="w-5 h-5" />
                                 </div>
                                 <div>
                                    <h4 className="text-sm font-bold text-white mb-1 uppercase tracking-tight">{item.label}</h4>
                                    <p className="text-[11px] text-gray-500 font-medium">{item.desc}</p>
                                 </div>
                              </div>
                              <button 
                                onClick={() => handleToggleNotification(item.key)}
                                className={`w-12 h-6 rounded-full relative transition-all shadow-inner ${isEnabled ? 'bg-accent' : 'bg-gray-800'}`}
                              >
                                 <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all shadow-sm ${isEnabled ? 'left-7' : 'left-1'}`} />
                              </button>
                           </div>
                         );
                       })}
                    </div>
                 </div>
               )}

               {activeTab === 'Billing' && (
                 <div className="bg-card border border-card-border rounded-[24px] p-8 animate-in fade-in slide-in-from-bottom-4 duration-300">
                    <h3 className="text-lg font-bold text-white mb-2">Subscription & Usage</h3>
                    <p className="text-sm text-gray-500 mb-6">Monitor cluster resource consumption and billing cycles.</p>
                    <div className="h-40 border-2 border-dashed border-card-border rounded-2xl flex items-center justify-center text-gray-600 text-[10px] font-black uppercase tracking-widest">
                       Enterprise License Detected
                    </div>
                 </div>
               )}

               {activeTab === 'Danger' && (
                 <div className="bg-card border border-card-border rounded-[24px] p-8 border-red-500/20 animate-in zoom-in-95 duration-200">
                    <h3 className="text-lg font-bold text-red-500 mb-2 flex items-center gap-2">
                       <AlertTriangle className="w-5 h-5" />
                       Danger Zone
                    </h3>
                    <p className="text-sm text-gray-500 mb-6">These actions are destructive and cannot be undone. Exercise extreme caution.</p>
                    
                    <div className="p-6 bg-red-500/5 rounded-2xl border border-red-500/10 mb-6">
                       <h4 className="text-xs font-black uppercase tracking-widest text-white mb-2">Purge Entire Cluster</h4>
                       <p className="text-[11px] text-gray-500 mb-4">This will immediately stop and delete ALL running applications, containers, and database entries. Your live URLs will go offline instantly.</p>
                       <button 
                         onClick={() => setIsPurgeModalOpen(true)}
                         className="px-6 py-3 bg-red-500/10 hover:bg-red-500 text-red-500 hover:text-white text-xs font-black rounded-xl transition-all uppercase tracking-widest border border-red-500/20"
                       >
                         Purge All Applications
                       </button>
                    </div>
                 </div>
               )}
            </div>
          </div>
        </div>
      </main>

      <PurgeModal 
        isOpen={isPurgeModalOpen} 
        onClose={() => setIsPurgeModalOpen(false)} 
        onConfirm={handlePurgeCluster} 
      />
    </div>
  );
}
