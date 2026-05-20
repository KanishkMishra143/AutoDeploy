"use client";
import { useState, useEffect } from "react";
import { X, User, Settings as SettingsIcon, Bell, Shield, CreditCard, Upload, ChevronRight, Key, Plus, Trash2, Copy, Check, Loader2, Link2, Lock, Eye, EyeOff, Save } from "lucide-react";
import { supabase } from "../../lib/supabase";
import { useJobs } from "../useJobs";
import Link from "next/link";
import toast from "react-hot-toast";
import ConfirmationModal from "./ConfirmationModal";

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function SettingsModal({ isOpen, onClose }: SettingsModalProps) {
  const { profile, settings, apiKeys, credentials, updateSettings, createApiKey, revokeApiKey, createCredential, deleteCredential } = useJobs();
  const [activeTab, setActiveTab] = useState<'profile' | 'notifications' | 'security' | 'integrations'>('profile');
  const [newKeyName, setNewKeyName] = useState("");
  const [validityDays, setValidityDays] = useState(7);
  const [isCreatingKey, setIsCreatingKey] = useState(false);
  const [isUpdatingSettings, setIsUpdatingSettings] = useState(false);
  const [revokingKeys, setRevokingKeys] = useState<Record<string, boolean>>({});
  const [deletingCreds, setDeletingCreds] = useState<Record<string, boolean>>({});

  // New Credential Form State
  const [showAddCred, setShowAddCred] = useState(false);
  const [newCredName, setNewCredName] = useState("");
  const [newCredType, setNewCredType] = useState<"PAT" | "SSH">("PAT");
  const [newCredValue, setNewCredValue] = useState("");
  const [isCreatingCred, setIsCreatingCred] = useState(false);
  const [showCredValue, setShowCredValue] = useState(false);
  const [keyToDelete, setKeyToDelete] = useState<string | null>(null);
  const [credToDelete, setCredToDelete] = useState<string | null>(null);
  const [newlyCreatedKey, setNewlyCreatedKey] = useState<string | null>(null);

  const handleCreateCredential = async () => {
    if (!newCredName || !newCredValue) return;

    // Safety check: SSH keys must be private keys
    if (newCredType === 'SSH' && (newCredValue.trim().startsWith('ssh-') || newCredValue.trim().startsWith('ecdsa-'))) {
        toast.error("Format Error: You provided a PUBLIC key. AutoDeploy needs the PRIVATE key to authenticate with GitHub.", { duration: 6000 });
        return;
    }

    setIsCreatingCred(true);
    try {
      await createCredential(newCredName, newCredType, newCredValue);
      toast.success(`${newCredType} Credential added!`);
      setNewCredName("");
      setNewCredValue("");
      setShowAddCred(false);
    } catch (err) {
      toast.error("Failed to add credential");
    } finally {
      setIsCreatingCred(false);
    }
  };

  const handleToggleNotification = async (key: string) => {
    if (!settings || isUpdatingSettings) return;
    
    setIsUpdatingSettings(true);
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
    } finally {
      setIsUpdatingSettings(false);
    }
  };

  const handleCreateKey = async () => {
    if (!newKeyName) return;
    setIsCreatingKey(true);
    try {
      const result = await createApiKey(newKeyName, validityDays);
      setNewlyCreatedKey(result.secret_key);
      setNewKeyName("");
      toast.success("API Key generated!");
    } catch (err) {
      toast.error("Failed to generate key");
    } finally {
      setIsCreatingKey(false);
    }
  };

  const confirmRevokeKey = async () => {
    if (!keyToDelete) return;
    setRevokingKeys(prev => ({ ...prev, [keyToDelete]: true }));
    try {
      await revokeApiKey(keyToDelete);
      toast.success("API Key revoked");
    } catch (err) {
      toast.error("Failed to revoke key");
    } finally {
      setRevokingKeys(prev => ({ ...prev, [keyToDelete]: false }));
      setKeyToDelete(null);
    }
  };

  const confirmDeleteCredential = async () => {
    if (!credToDelete) return;
    setDeletingCreds(prev => ({ ...prev, [credToDelete]: true }));
    try {
      await deleteCredential(credToDelete);
      toast.success("Credential removed");
    } catch (err) {
      toast.error("Failed to remove credential");
    } finally {
      setDeletingCreds(prev => ({ ...prev, [credToDelete]: false }));
      setCredToDelete(null);
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
                { id: 'integrations', label: 'Integrations', icon: Link2 },
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
                               disabled={isUpdatingSettings}
                               className={`w-10 h-5 rounded-full relative transition-all ${isEnabled ? 'bg-accent' : 'bg-gray-800'} ${isUpdatingSettings ? 'opacity-50 cursor-not-allowed' : ''}`}
                             >
                                <div className={`absolute top-1 w-3 h-3 rounded-full bg-white transition-all ${isEnabled ? 'left-6' : 'left-1'}`} />
                             </button>
                          </div>
                        );
                      })}
                   </div>
                </div>
              )}

              {activeTab === 'integrations' && (
                <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300 pb-10">
                   <div className="flex justify-between items-center mb-4">
                      <div>
                        <h4 className="text-sm font-bold text-white uppercase tracking-tight">Access Credentials</h4>
                        <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">For Private Repositories</p>
                      </div>
                      <button 
                        onClick={() => setShowAddCred(!showAddCred)}
                        className="px-4 py-2 bg-accent/10 hover:bg-accent text-accent hover:text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2 border border-accent/20"
                      >
                         {showAddCred ? <X className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
                         {showAddCred ? "Cancel" : "Add Credential"}
                      </button>
                   </div>

                   {showAddCred && (
                     <div className="p-6 bg-white/5 border border-accent/20 rounded-[24px] space-y-4 animate-in slide-in-from-top-2 duration-300">
                        <div>
                           <label className="block text-[9px] font-black text-gray-500 uppercase tracking-widest mb-2">Credential Name</label>
                           <input 
                             type="text" 
                             placeholder="e.g. Github Production Token"
                             className="w-full bg-background border border-card-border rounded-xl px-4 py-3 text-sm text-white outline-none focus:border-accent transition-all"
                             value={newCredName}
                             onChange={(e) => setNewCredName(e.target.value)}
                           />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                           <div>
                              <label className="block text-[9px] font-black text-gray-500 uppercase tracking-widest mb-2">Type</label>
                              <select 
                                className="w-full bg-background border border-card-border rounded-xl px-4 py-3 text-sm text-white outline-none focus:border-accent transition-all appearance-none cursor-pointer"
                                value={newCredType}
                                onChange={(e) => setNewCredType(e.target.value as any)}
                              >
                                 <option value="PAT">Personal Access Token (HTTPS)</option>
                                 <option value="SSH">SSH Private Key</option>
                              </select>
                           </div>
                           <div className="flex items-end">
                              <button 
                                onClick={handleCreateCredential}
                                disabled={!newCredName || !newCredValue || isCreatingCred}
                                className="w-full py-3 bg-accent hover:bg-accent/90 text-white text-[10px] font-black rounded-xl transition-all shadow-lg shadow-accent/20 flex items-center justify-center gap-2 uppercase tracking-widest disabled:opacity-50"
                              >
                                 {isCreatingCred ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                                 Save Credential
                              </button>
                           </div>
                        </div>
                        <div>
                           <div className="flex justify-between items-center mb-2">
                              <div className="flex items-center gap-2">
                                <label className="block text-[9px] font-black text-gray-500 uppercase tracking-widest">Secret Value</label>
                                {newCredType === 'SSH' && (
                                  <a 
                                    href="https://docs.github.com/en/authentication/connecting-to-github-with-ssh/managing-deploy-keys#deploy-keys" 
                                    target="_blank" 
                                    className="text-[8px] font-black text-accent uppercase tracking-widest hover:underline flex items-center gap-1"
                                  >
                                    <Shield className="w-2.5 h-2.5" /> What key do I use?
                                  </a>
                                )}
                              </div>
                              <button 
                                onClick={() => setShowCredValue(!showCredValue)}
                                className="text-[9px] font-black text-accent uppercase tracking-widest flex items-center gap-1 hover:underline"
                              >
                                 {showCredValue ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                                 {showCredValue ? "Hide" : "Reveal"}
                              </button>
                           </div>
                           {newCredType === 'PAT' ? (
                             <input 
                               type={showCredValue ? "text" : "password"}
                               placeholder="ghp_xxxxxxxxxxxxxxxxxxxx"
                               className="w-full bg-background border border-card-border rounded-xl px-4 py-3 text-sm text-white font-mono outline-none focus:border-accent transition-all"
                               value={newCredValue}
                               onChange={(e) => setNewCredValue(e.target.value)}
                             />
                           ) : (
                             <textarea 
                               placeholder="-----BEGIN OPENSSH PRIVATE KEY-----"
                               rows={4}
                               className="w-full bg-background border border-card-border rounded-xl px-4 py-3 text-sm text-white font-mono outline-none focus:border-accent transition-all resize-none"
                               value={newCredValue}
                               onChange={(e) => setNewCredValue(e.target.value)}
                             />
                           )}
                        </div>
                     </div>
                   )}

                   <div className="space-y-3">
                      {credentials.length === 0 ? (
                        !showAddCred && (
                          <div className="text-center py-12 border-2 border-dashed border-card-border rounded-3xl">
                             <div className="w-12 h-12 bg-white/5 rounded-2xl flex items-center justify-center mx-auto mb-4">
                                <Lock className="w-6 h-6 text-gray-700" />
                             </div>
                             <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest">No credentials stored</p>
                             <p className="text-[9px] text-gray-700 uppercase tracking-widest mt-1">Add one to enable private repo deployments</p>
                          </div>
                        )
                      ) : (
                        credentials.map(cred => (
                            <div key={cred.id} className="flex items-center justify-between p-4 bg-white/5 rounded-2xl border border-card-border group hover:border-accent/30 transition-all">
                               <div className="flex items-center gap-4">
                                  <div className="p-2 bg-white/5 rounded-xl">
                                     <Key className="w-4 h-4 text-gray-500" />
                                  </div>
                                  <div>
                                     <p className="text-xs font-bold text-white uppercase tracking-tight">{cred.name}</p>
                                     <p className="text-[10px] text-gray-500 font-mono">{cred.type} • ADDED {new Date(cred.created_at).toLocaleDateString()}</p>
                                  </div>
                               </div>
                               <button 
                                 onClick={() => setCredToDelete(cred.id)}
                                 disabled={deletingCreds[cred.id]}
                                 className="p-2 text-gray-600 hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-all opacity-0 group-hover:opacity-100 disabled:opacity-50 disabled:cursor-not-allowed"
                               >
                                  {deletingCreds[cred.id] ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                               </button>
                            </div>
                        ))
                      )}
                   </div>

                   <div className="p-4 bg-amber-500/5 rounded-2xl border border-amber-500/10">
                      <div className="flex gap-3">
                         <Shield className="w-4 h-4 text-amber-500 shrink-0" />
                         <div>
                            <p className="text-[10px] text-amber-500 font-black uppercase tracking-widest mb-1">Security Note</p>
                            <p className="text-[10px] text-gray-400 leading-relaxed">Credentials are encrypted at rest using AES-256 (Fernet) and are only decrypted in worker memory during the clone phase.</p>
                         </div>
                      </div>
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
                        <select 
                          className="bg-background border border-card-border rounded-lg px-2 py-1 text-[10px] outline-none focus:border-accent text-gray-400"
                          value={validityDays}
                          onChange={(e) => setValidityDays(parseInt(e.target.value))}
                        >
                          <option value={1}>24 Hour</option>
                          <option value={2}>48 Hour</option>
                          <option value={3}>3 Days</option>
                          <option value={7}>7 Days</option>
                        </select>
                        <button 
                          onClick={handleCreateKey}
                          disabled={!newKeyName || isCreatingKey}
                          className="p-1.5 bg-accent text-white rounded-lg disabled:opacity-50"
                        >
                          {isCreatingKey ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                        </button>
                      </div>
                   </div>

                   <div className="space-y-3">
                      {apiKeys.length === 0 ? (
                        <div className="text-center py-8 border-2 border-dashed border-card-border rounded-2xl">
                           <Key className="w-8 h-8 text-gray-800 mx-auto mb-2" />
                           <p className="text-[10px] font-black text-gray-600 uppercase">No active API keys</p>
                        </div>
                      ) : (
                        apiKeys.map(key => {
                          const isExpired = !!(key.expires_at && new Date(key.expires_at) < new Date());

                          return (
                            <div key={key.id} className={`flex items-center justify-between p-4 bg-white/5 rounded-2xl border ${isExpired ? 'border-red-500/30' : 'border-card-border'} group hover:border-accent/30 transition-all`}>
                               <div className="flex items-center gap-4">
                                  <div className={`p-2 ${isExpired ? 'bg-red-500/10' : 'bg-white/5'} rounded-xl`}>
                                     <Key className={`w-4 h-4 ${isExpired ? 'text-red-500' : 'text-gray-500'}`} />
                                  </div>
                                  <div>
                                     <div className="flex items-center gap-2 mb-0.5">
                                        <p className="text-xs font-bold text-white">{key.name}</p>
                                        {isExpired && <span className="text-[8px] font-black bg-red-500 text-white px-1.5 py-0.5 rounded uppercase tracking-widest">Expired</span>}
                                     </div>
                                     <div className="flex items-center gap-2">
                                        <code className="text-[10px] font-mono text-gray-400 tracking-tighter">
                                          {key.secret_key 
                                            ? (key.secret_key.length > 20 ? `${key.secret_key.substring(0, 20)}...` : key.secret_key)
                                            : `${key.key_prefix}••••••••••••••••••••••••••••`}
                                        </code>
                                        {key.secret_key && (
                                          <button 
                                            onClick={() => {
                                              if (isExpired) return;
                                              navigator.clipboard.writeText(key.secret_key!);
                                              toast.success("Copied to clipboard");
                                            }}
                                            disabled={isExpired}
                                            className={`p-1 hover:bg-white/10 rounded transition-all ${isExpired ? 'cursor-not-allowed opacity-20' : 'cursor-pointer'}`}
                                          >
                                            <Copy className={`w-3 h-3 ${isExpired ? 'text-gray-600' : 'text-accent'}`} />
                                          </button>
                                        )}
                                     </div>
                                  </div>
                               </div>
                               <div className="flex items-center gap-4">
                                  <div className="text-right">
                                     <p className="text-[8px] font-black text-gray-600 uppercase tracking-widest mb-0.5">Expires</p>
                                     <p className={`text-[9px] font-bold ${isExpired ? 'text-red-500' : 'text-gray-400'}`}>
                                       {key.expires_at ? new Date(key.expires_at).toLocaleDateString('en-GB') : 'Never'}
                                     </p>
                                  </div>
                                  <button 
                                    onClick={() => setKeyToDelete(key.id)}
                                    disabled={revokingKeys[key.id]}
                                    className="p-2 text-gray-600 hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-all opacity-0 group-hover:opacity-100 disabled:opacity-50 disabled:cursor-not-allowed"
                                    title="Revoke Key"
                                  >
                                     {revokingKeys[key.id] ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                                  </button>
                               </div>
                            </div>
                          );
                        })
                      )}
                   </div>
                </div>
              )}
           </div>
        </div>
      </div>

      <ConfirmationModal 
        isOpen={!!keyToDelete}
        title="Revoke API Key"
        message="Are you sure you want to revoke this API key? Any CLI or automated scripts using this key will stop working immediately."
        confirmLabel="Revoke Key"
        confirmVariant="danger"
        onConfirm={confirmRevokeKey}
        onCancel={() => setKeyToDelete(null)}
        isLoading={revokingKeys[keyToDelete || ""]}
      />

      <ConfirmationModal 
        isOpen={!!credToDelete}
        title="Remove Credential"
        message="Are you sure you want to remove this credential? Any applications relying on it for deployments will fail to clone their repositories."
        confirmLabel="Remove Credential"
        confirmVariant="danger"
        onConfirm={confirmDeleteCredential}
        onCancel={() => setCredToDelete(null)}
        isLoading={deletingCreds[credToDelete || ""]}
      />
    </div>
  );
}
