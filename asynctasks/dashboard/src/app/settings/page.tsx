"use client";
import { useState, useEffect } from "react";
import { useJobs } from "../useJobs";
import { Settings as SettingsIcon, Shield, Bell, CreditCard, ChevronLeft, AlertTriangle, User, Upload } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Header from "../components/Header";
import PurgeModal from "../components/PurgeModal";
import toast from "react-hot-toast";

type TabType = 'General' | 'Security' | 'Notifications' | 'Billing' | 'Danger';

export default function SettingsPage() {
  const { workerCount, error, jobs, apps } = useJobs();
  const [activeTab, setActiveTab] = useState<TabType>('General');
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [isPurgeModalOpen, setIsPurgeModalOpen] = useState(false);
  const router = useRouter();

  const onViewJob = (jobId: string) => {
    router.push(`/?jobId=${jobId}`);
  };

  const handlePurgeCluster = async () => {
    try {
      const res = await fetch("http://localhost:8000/apps/purge", { method: "DELETE" });
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

  return (
    <div className="min-h-screen bg-background text-white">
      <Header 
        workerCount={workerCount} 
        apiError={error} 
        onSearch={() => {}} 
        jobs={jobs}
        apps={apps}
        onViewJob={onViewJob}
      />

      <main className="pt-32 pb-20 px-8">
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
                          <div className="w-24 h-20 bg-accent/10 rounded-2xl border-2 border-dashed border-accent/20 flex items-center justify-center group-hover:border-accent/50 transition-all">
                             <User className="w-8 h-8 text-accent opacity-40" />
                          </div>
                          <div className="absolute inset-0 bg-black/60 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center cursor-pointer">
                             <Upload className="w-4 h-4 text-white mb-1" />
                             <span className="text-[8px] font-black text-white uppercase">Upload</span>
                          </div>
                       </div>
                       <div>
                          <h4 className="text-sm font-bold text-white mb-1 uppercase tracking-tight">Avatar Image</h4>
                          <p className="text-xs text-gray-500 mb-3">Recommended: 400x400px. Max 2MB.</p>
                          <button className="text-[10px] font-black text-accent uppercase tracking-widest hover:underline">Choose File</button>
                       </div>
                    </div>

                    <div className="space-y-6">
                      <div>
                         <label className="block text-[10px] font-black text-gray-500 uppercase tracking-[0.2em] mb-2">Display Name</label>
                         <input 
                           type="text" 
                           defaultValue="Senior Developer"
                           readOnly
                           className="w-full bg-background border border-card-border rounded-xl px-4 py-3 text-sm text-gray-500 focus:border-accent outline-none transition-all cursor-not-allowed opacity-60"
                         />
                      </div>
                      <div>
                         <label className="block text-[10px] font-black text-gray-500 uppercase tracking-[0.2em] mb-2">Email Address</label>
                         <input 
                           type="email" 
                           defaultValue="developer@autodeploy.local"
                           className="w-full bg-background border border-card-border rounded-xl px-4 py-3 text-sm text-gray-500 focus:border-accent outline-none transition-all opacity-40 cursor-not-allowed"
                           readOnly
                         />
                      </div>
                      <p className="text-[10px] text-gray-600 font-medium italic">Identity management is locked until Phase 12 (Auth Rollout).</p>
                    </div>
                 </div>
               )}

               {activeTab === 'Security' && (
                 <div className="bg-card border border-card-border rounded-[24px] p-8 animate-in fade-in slide-in-from-bottom-4 duration-300">
                    <h3 className="text-lg font-bold text-white mb-2">Security Settings</h3>
                    <p className="text-sm text-gray-500 mb-6">Manage authentication and cluster access keys.</p>
                    <div className="h-40 border-2 border-dashed border-card-border rounded-2xl flex items-center justify-center text-gray-600 text-[10px] font-black uppercase tracking-widest">
                       Coming Soon in v1.6
                    </div>
                 </div>
               )}

               {activeTab === 'Notifications' && (
                 <div className="bg-card border border-card-border rounded-[24px] p-8 animate-in fade-in slide-in-from-bottom-4 duration-300">
                    <h3 className="text-lg font-bold text-white mb-2">Notification Center</h3>
                    <p className="text-sm text-gray-500 mb-6">Configure alerts for build failures and system health.</p>
                    <div className="h-40 border-2 border-dashed border-card-border rounded-2xl flex items-center justify-center text-gray-600 text-[10px] font-black uppercase tracking-widest">
                       Integration with Slack/Discord Pending
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
