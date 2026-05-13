"use client";
import { useState, useEffect } from "react";
import { X, User, Settings as SettingsIcon, Bell, Shield, CreditCard, Upload, ChevronRight } from "lucide-react";
import Link from "next/link";

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function SettingsModal({ isOpen, onClose }: SettingsModalProps) {
  const [activeTab, setActiveTab] = useState<'profile' | 'notifications' | 'security'>('profile');

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
                         <div className="w-20 h-20 bg-accent/10 rounded-3xl border-2 border-dashed border-accent/30 flex items-center justify-center group-hover:border-accent transition-all">
                            <User className="w-8 h-8 text-accent opacity-50" />
                         </div>
                         <div className="absolute inset-0 bg-black/60 rounded-3xl opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center cursor-pointer">
                            <Upload className="w-5 h-5 text-white" />
                         </div>
                      </div>
                      <div>
                         <h4 className="text-sm font-bold text-white mb-1">Developer Identity</h4>
                         <p className="text-xs text-gray-500">Update your cluster profile and avatar.</p>
                         <button className="text-[10px] font-black text-accent uppercase tracking-widest mt-2 hover:underline">Change Photo</button>
                      </div>
                   </div>

                   <div className="space-y-4">
                      <div>
                         <label className="block text-[10px] font-black text-gray-500 uppercase tracking-widest mb-2">Display Name</label>
                         <input 
                           type="text" 
                           defaultValue="Senior Developer"
                           readOnly
                           className="w-full bg-background/50 border border-card-border rounded-xl px-4 py-3 text-sm text-gray-400 cursor-not-allowed"
                         />
                      </div>
                      <div>
                         <label className="block text-[10px] font-black text-gray-500 uppercase tracking-widest mb-2">Email Address</label>
                         <input 
                           type="email" 
                           defaultValue="developer@autodeploy.local"
                           readOnly
                           className="w-full bg-background/50 border border-card-border rounded-xl px-4 py-3 text-sm text-gray-400 cursor-not-allowed"
                         />
                      </div>
                      <p className="text-[10px] text-gray-600 italic">Account details will be editable in Phase 12 (Auth & Accounts).</p>
                   </div>
                </div>
              )}

              {activeTab === 'notifications' && (
                <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
                   <h4 className="text-sm font-bold text-white mb-4 uppercase tracking-tight">Notification Channels</h4>
                   <div className="space-y-3">
                      {[
                        { label: 'Deployment Success', enabled: true },
                        { label: 'Deployment Failure', enabled: true },
                        { label: 'System Health Alerts', enabled: false },
                        { label: 'Weekly Cluster Report', enabled: false }
                      ].map(item => (
                        <div key={item.label} className="flex items-center justify-between p-4 bg-white/5 rounded-2xl border border-card-border">
                           <span className="text-xs font-bold text-gray-300">{item.label}</span>
                           <div className={`w-10 h-5 rounded-full relative transition-all ${item.enabled ? 'bg-accent' : 'bg-gray-800'}`}>
                              <div className={`absolute top-1 w-3 h-3 rounded-full bg-white transition-all ${item.enabled ? 'left-6' : 'left-1'}`} />
                           </div>
                        </div>
                      ))}
                   </div>
                </div>
              )}

              {activeTab === 'security' && (
                <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300 text-center py-12">
                   <Shield className="w-16 h-16 text-gray-800 mx-auto mb-4" />
                   <h4 className="text-sm font-bold text-white mb-2 uppercase tracking-tight">Secure Cluster Access</h4>
                   <p className="text-xs text-gray-500 max-w-xs mx-auto">RBAC and Multi-node security keys are part of the upcoming v1.6 Hardening update.</p>
                </div>
              )}
           </div>
        </div>
      </div>
    </div>
  );
}
