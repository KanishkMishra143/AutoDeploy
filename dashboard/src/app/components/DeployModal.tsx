"use client";
import { useState, useEffect, useRef } from "react";
import { X, Plus, Trash2, Rocket, Globe, Tag, GitBranch, Layers, Terminal, Settings2, Upload, Lock, ShieldCheck, Key } from "lucide-react";
import toast from "react-hot-toast";
import { supabase } from "../../lib/supabase";
import { useJobs } from "../useJobs";
import PortCollisionModal from "./PortCollisionModal";

type TabType = "general" | "env" | "pipeline";

export default function DeployModal({ onClose }: { onClose: (jobId?: string) => void }) {
  const { credentials, createCredential } = useJobs();
  const [activeTab, setActiveTab] = useState<TabType>("general");
  const [name, setName] = useState("");
  const [repo, setRepo] = useState("");
  const [branch, setBranch] = useState("master");
  const [rootDir, setRootDir] = useState(".");
  const [stack, setStack] = useState("dockerfile");
  const [internalPort, setInternalPort] = useState(8000);
  const [availableBranches, setAvailableBranches] = useState<string[]>([]);
  const [fetchingBranches, setFetchingBranches] = useState(false);
  
  // Private Repo State
  const [isPrivate, setIsPrivate] = useState(false);
  const [selectedCredentialId, setSelectedCredentialId] = useState<string>("");
  const [inlinePat, setInlinePat] = useState("");

  const [envVars, setEnvVars] = useState<{ key: string; value: string }[]>([
    { key: "", value: "" }
  ]);
  const [preBuildSteps, setPreBuildSteps] = useState<string[]>([]);
  const [postBuildSteps, setPostBuildSteps] = useState<string[]>([]);
  const [volumes, setVolumes] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [createdAppId, setCreatedAppId] = useState<string | null>(null);
  const [portCollision, setPortCollision] = useState<{isOpen: boolean, detectedPort?: number, source?: string}>({ isOpen: false });

  // Fetch branches when repo URL changes
  useEffect(() => {
    if (repo && repo.startsWith("http")) {
      const fetchBranches = async () => {
        setFetchingBranches(true);
        try {
          const { data: { session } } = await supabase.auth.getSession();
          // Include credential if available to fetch branches from private repos
          let url = `http://127.0.0.1:8000/apps/branches?repo_url=${repo}`;
          if (isPrivate) {
            if (selectedCredentialId) url += `&credential_id=${selectedCredentialId}`;
            else if (inlinePat) url += `&pat=${inlinePat}`;
          }
          
          const res = await fetch(url, {
            headers: {
              "Authorization": `Bearer ${session?.access_token}`,
            }
          });
          if (res.ok) {
            const data = await res.json();
            setAvailableBranches(data.branches || []);
            if (data.branches.includes("main")) setBranch("main");
            else if (data.branches.includes("master")) setBranch("master");
            else if (data.branches.length > 0) setBranch(data.branches[0]);
          }
        } catch (err) {
          console.error("Failed to fetch branches", err);
        } finally {
          setFetchingBranches(false);
        }
      };
      const timer = setTimeout(fetchBranches, 1000);
      return () => clearTimeout(timer);
    }
  }, [repo, isPrivate, selectedCredentialId, inlinePat]);

  const addEnvVar = () => setEnvVars([...envVars, { key: "", value: "" }]);
  const removeEnvVar = (index: number) => setEnvVars(envVars.filter((_, i) => i !== index));
  const updateEnvVar = (index: number, field: "key" | "value", val: string) => {
    const updated = [...envVars];
    updated[index][field] = val;
    setEnvVars(updated);
  };

  const handleEnvFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      const lines = content.split('\n');
      const newVars: { key: string; value: string }[] = [];

      lines.forEach(line => {
        const trimmedLine = line.trim();
        if (trimmedLine && !trimmedLine.startsWith('#')) {
          const firstEqual = trimmedLine.indexOf('=');
          if (firstEqual !== -1) {
            const key = trimmedLine.substring(0, firstEqual).trim();
            let value = trimmedLine.substring(firstEqual + 1).trim();
            // Remove quotes if present
            if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
                value = value.substring(1, value.length - 1);
            }
            if (key) newVars.push({ key, value });
          }
        }
      });

      if (newVars.length > 0) {
        // Filter out empty existing vars and merge
        const filteredExisting = envVars.filter(v => v.key || v.value);
        setEnvVars([...filteredExisting, ...newVars]);
        toast.success(`Detected ${newVars.length} environment variables!`, { icon: '📄' });
      } else {
        toast.error("No valid environment variables found in file.");
      }
    };
    reader.readAsText(file);
    // Reset input
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const addStep = (type: "pre" | "post") => {
    if (type === "pre") setPreBuildSteps([...preBuildSteps, ""]);
    else setPostBuildSteps([...postBuildSteps, ""]);
  };

  const updateStep = (type: "pre" | "post", index: number, val: string) => {
    if (type === "pre") {
      const updated = [...preBuildSteps];
      updated[index] = val;
      setPreBuildSteps(updated);
    } else {
      const updated = [...postBuildSteps];
      updated[index] = val;
      setPostBuildSteps(updated);
    }
  };

  const removeStep = (type: "pre" | "post", index: number) => {
    if (type === "pre") setPreBuildSteps(preBuildSteps.filter((_, i) => i !== index));
    else setPostBuildSteps(postBuildSteps.filter((_, i) => i !== index));
  };

  const handleDeploy = async (overridePort?: number) => {
    const isOverride = typeof overridePort === 'number';
    setLoading(true);
    const envObj = envVars.reduce((acc, curr) => {
      if (curr.key) acc[curr.key] = curr.value;
      return acc;
    }, {} as Record<string, string>);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      let appId = createdAppId;
      let finalCredentialId = selectedCredentialId || null;

      // 0. Handle Inline PAT (Create Credential first if needed)
      if (isPrivate && !selectedCredentialId && inlinePat) {
        toast.loading("Securing repository access...", { id: "cred-gen" });
        try {
          const newCred = await createCredential(`${name} Deployment Key`, "PAT", inlinePat);
          finalCredentialId = newCred.id;
          toast.success("Access token secured.", { id: "cred-gen" });
        } catch (err) {
          toast.error("Failed to secure access token.", { id: "cred-gen" });
          setLoading(false);
          return;
        }
      }

      // 1. Create app if it doesn't exist yet
      if (!appId) {
        const appRes = await fetch("http://127.0.0.1:8000/apps", {
          method: "POST",
          headers: { 
            "Content-Type": "application/json",
            "Authorization": `Bearer ${session?.access_token}`,
          },
          body: JSON.stringify({
            name: name,
            repo_url: repo,
            branch: branch,
            stack: stack,
            internal_port: internalPort,
            root_dir: rootDir,
            volumes: volumes.filter(v => v.trim()),
            env_vars: envObj,
            pre_build_steps: preBuildSteps.filter(s => s.trim()),
            post_build_steps: postBuildSteps.filter(s => s.trim()),
            credential_id: finalCredentialId
          }),
        });

        if (!appRes.ok) {
          const err = await appRes.json();
          toast.error(err.detail || "Failed to create application");
          setLoading(false);
          return;
        }

        const appData = await appRes.json();
        appId = appData.id;
        setCreatedAppId(appId as string);
      }

      // 2. If no override port, check for collision first
      if (!isOverride && appId) {
        const tId = toast.loading("Analyzing repository configuration...");
        const detectRes = await fetch(`http://127.0.0.1:8000/apps/${appId}/detect-port`, {
          headers: { "Authorization": `Bearer ${session?.access_token}` }
        });
        
        if (detectRes.ok) {
          const { detected_port, source, error } = await detectRes.json();
          toast.dismiss(tId);

          if (error) {
            toast.error(error);
          } else if (detected_port && detected_port !== internalPort) {
            setLoading(false);
            setPortCollision({ isOpen: true, detectedPort: detected_port, source: source });
            return;
          } else {
            toast.success("No configuration conflicts detected.", { duration: 1000 });
          }
        } else {
          toast.dismiss(tId);
          toast.error("Failed to connect to orchestrator scanner.");
        }
      }

      // 3. If an override port was chosen, update the app first
      if (isOverride && appId) {
        await fetch(`http://127.0.0.1:8000/apps/${appId}`, {
          method: "PATCH",
          headers: {
            "Authorization": `Bearer ${session?.access_token}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({ internal_port: overridePort })
        });
        setInternalPort(overridePort);
      }

      // 4. Trigger actual deployment
      const deployRes = await fetch(`http://127.0.0.1:8000/apps/${appId}/deploy?trigger_reason=Manual:Canvas`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${session?.access_token}`,
        }
      });
      
      if (deployRes.ok) {
        const jobData = await deployRes.json();
        onClose(jobData.id);
      }
    } catch (err) {
      console.error(err);
      toast.error("An unexpected error occurred.");
    } finally {
      setLoading(false);
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

        const myWrapper = document.getElementById('deploy-modal-wrapper');
        if (topModal === myWrapper) {
          e.stopImmediatePropagation();
          onClose();
        }
      }
    };
    window.addEventListener("keydown", handleEsc, true);
    return () => window.removeEventListener("keydown", handleEsc, true);
  }, [onClose]);

  return (
    <div 
      id="deploy-modal-wrapper"
      onClick={(e) => e.target === e.currentTarget && onClose()}
      className="fixed inset-0 z-[500] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 cursor-default animate-in fade-in duration-200"
    >
      <div className="bg-card border border-card-border w-full max-w-2xl rounded-[32px] shadow-2xl overflow-hidden cursor-default flex flex-col h-[85vh] animate-in zoom-in-95 duration-200">
        
        {/* Modal Header */}
        <div className="p-8 border-b border-card-border flex justify-between items-center bg-background/50">
          <div className="flex items-center gap-4">
             <div className="w-12 h-12 bg-accent/10 rounded-2xl flex items-center justify-center border border-accent/20">
                <Rocket className="w-6 h-6 text-accent" />
             </div>
             <div>
                <h2 className="text-2xl font-black text-white uppercase tracking-tighter leading-none mb-1">Launch Sequence</h2>
                <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Register & Deploy Application</p>
             </div>
          </div>
          <button onClick={() => onClose()} className="p-2.5 hover:bg-white/5 rounded-xl text-gray-400 hover:text-white transition-all group">
            <X className="w-6 h-6 group-hover:rotate-90 transition-transform duration-300" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex px-8 border-b border-card-border bg-background/30 gap-6">
           {[
             { id: 'general', label: 'General', icon: Settings2 },
             { id: 'env', label: 'Environment', icon: Tag },
             { id: 'pipeline', label: 'Pipeline DAG', icon: Terminal }
           ].map(tab => (
             <button
               key={tab.id}
               onClick={() => setActiveTab(tab.id as any)}
               className={`py-4 text-[10px] font-black uppercase tracking-[0.2em] flex items-center gap-2 transition-all relative ${activeTab === tab.id ? 'text-accent' : 'text-gray-500 hover:text-gray-300'}`}
             >
               <tab.icon className="w-3.5 h-3.5" />
               {tab.label}
               {activeTab === tab.id && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-accent shadow-[0_0_8px_rgba(59,130,246,0.5)]" />}
             </button>
           ))}
        </div>

        {/* Scrollable Content Area */}
        <div className="flex-1 overflow-y-auto p-8 custom-scrollbar bg-[#080808]/50">
          
          {activeTab === 'general' && (
            <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-300">
               <div>
                 <label className="block text-[10px] font-black text-gray-500 uppercase tracking-widest mb-3">Application Identity</label>
                 <div className="relative group">
                   <Tag className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-600 group-focus-within:text-accent transition-colors" />
                   <input 
                     type="text" 
                     placeholder="E.G. NEBULA-PRO-API"
                     className="w-full bg-background border border-card-border rounded-2xl py-4 pl-12 pr-6 text-sm focus:border-accent outline-none transition-all text-white placeholder:text-gray-700 font-bold"
                     value={name}
                     onChange={(e) => setName(e.target.value)}
                   />
                 </div>
               </div>

               <div>
                 <div className="flex justify-between items-center mb-3">
                    <label className="block text-[10px] font-black text-gray-500 uppercase tracking-widest">Git Repository Source</label>
                    <button 
                        onClick={() => setIsPrivate(!isPrivate)}
                        className={`flex items-center gap-2 px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest transition-all ${isPrivate ? 'bg-amber-500/10 text-amber-500 border border-amber-500/20' : 'bg-green-500/10 text-green-500 border border-green-500/20'}`}
                    >
                        {isPrivate ? <Lock className="w-3 h-3" /> : <ShieldCheck className="w-3 h-3" />}
                        {isPrivate ? 'Private Repository' : 'Public Repository'}
                    </button>
                 </div>
                 <div className="relative group">
                   <Globe className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-600 group-focus-within:text-accent transition-colors" />
                   <input 
                     type="text" 
                     placeholder="HTTPS://GITHUB.COM/ORG/REPO"
                     className="w-full bg-background border border-card-border rounded-2xl py-4 pl-12 pr-6 text-sm focus:border-accent outline-none transition-all text-white placeholder:text-gray-700 font-bold"
                     value={repo}
                     onChange={(e) => setRepo(e.target.value)}
                   />
                 </div>
               </div>

               {isPrivate && (
                 <div className="grid grid-cols-2 gap-6 animate-in slide-in-from-top-2 duration-300">
                    <div>
                        <label className="block text-[10px] font-black text-gray-500 uppercase tracking-widest mb-3">Access Credential</label>
                        <div className="relative">
                            <Key className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-600 pointer-events-none" />
                            <select 
                                className="w-full bg-background border border-card-border rounded-2xl py-4 pl-12 pr-6 text-sm focus:border-accent outline-none transition-all text-white appearance-none font-bold"
                                value={selectedCredentialId}
                                onChange={(e) => setSelectedCredentialId(e.target.value)}
                            >
                                <option value="">NEW PERSONAL ACCESS TOKEN (PAT)</option>
                                {credentials.map(c => (
                                    <option key={c.id} value={c.id}>{c.name.toUpperCase()} ({c.type})</option>
                                ))}
                            </select>
                        </div>
                    </div>
                    {!selectedCredentialId && (
                        <div>
                            <label className="block text-[10px] font-black text-gray-500 uppercase tracking-widest mb-3">PAT Value</label>
                            <div className="relative group">
                                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-600 group-focus-within:text-accent transition-colors" />
                                <input 
                                    type="password" 
                                    placeholder="GHP_XXXXXXXXXXXXXXXXXXXX"
                                    className="w-full bg-background border border-card-border rounded-2xl py-4 pl-12 pr-6 text-sm focus:border-accent outline-none transition-all text-white placeholder:text-gray-700 font-bold"
                                    value={inlinePat}
                                    onChange={(e) => setInlinePat(e.target.value)}
                                />
                            </div>
                        </div>
                    )}
                 </div>
               )}

               <div className="grid grid-cols-2 gap-6">
                 <div>
                   <label className="block text-[10px] font-black text-gray-500 uppercase tracking-widest mb-3">Target Branch</label>
                   <div className="relative">
                     <GitBranch className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-600 pointer-events-none" />
                     <select 
                       className="w-full bg-background border border-card-border rounded-2xl py-4 pl-12 pr-6 text-sm focus:border-accent outline-none transition-all text-white appearance-none font-bold"
                       value={branch}
                       onChange={(e) => setBranch(e.target.value)}
                       disabled={fetchingBranches}
                     >
                       {fetchingBranches ? <option>FETCHING...</option> : 
                        availableBranches.length > 0 ? availableBranches.map(b => <option key={b} value={b}>{b.toUpperCase()}</option>) : 
                        <option value="master">MASTER</option>}
                     </select>
                   </div>
                 </div>
                 <div>
                   <label className="block text-[10px] font-black text-gray-500 uppercase tracking-widest mb-3">Stack Template</label>
                   <div className="relative">
                     <Layers className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-600 pointer-events-none" />
                     <select 
                       className="w-full bg-background border border-card-border rounded-2xl py-4 pl-12 pr-6 text-sm focus:border-accent outline-none transition-all text-white appearance-none font-bold"
                       value={stack}
                       onChange={(e) => {
                          setStack(e.target.value);
                          if (e.target.value === 'static') setInternalPort(80);
                          else setInternalPort(8000);
                       }}
                     >
                       <option value="dockerfile">NATIVE DOCKERFILE</option>
                       <option value="python">PYTHON ENVIRONMENT</option>
                       <option value="nodejs">NODE.JS RUNTIME</option>
                       <option value="static">STATIC SITE (NGINX)</option>
                     </select>
                   </div>
                 </div>
               </div>

               <div className="grid grid-cols-2 gap-6">
                 <div>
                   <label className="block text-[10px] font-black text-gray-500 uppercase tracking-widest mb-3">Root Directory</label>
                   <div className="relative group">
                     <Layers className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-600 group-focus-within:text-accent transition-colors" />
                     <input 
                       type="text" 
                       placeholder="E.G. ./apps/api"
                       className="w-full bg-background border border-card-border rounded-2xl py-4 pl-12 pr-6 text-sm focus:border-accent outline-none transition-all text-white placeholder:text-gray-700 font-bold"
                       value={rootDir}
                       onChange={(e) => setRootDir(e.target.value)}
                     />
                   </div>
                 </div>
                 <div>
                   <label className="block text-[10px] font-black text-gray-500 uppercase tracking-widest mb-3">Internal Port</label>
                   <div className="relative group">
                     <Terminal className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-600 group-focus-within:text-accent transition-colors" />
                     <input 
                       type="number" 
                       placeholder="Defaults to 8000"
                       className="w-full bg-background border border-card-border rounded-2xl py-4 pl-12 pr-6 text-sm focus:border-accent outline-none transition-all text-white placeholder:text-gray-700 font-bold"
                       value={internalPort || ''}
                       onChange={(e) => setInternalPort(parseInt(e.target.value) || 0)}
                     />
                   </div>
                 </div>
               </div>
               <p className="mt-[-24px] text-[9px] text-gray-600 font-bold uppercase tracking-widest leading-relaxed">
                 Use Root Directory for monorepos. Port detection will scan this folder for Dockerfile or autodeploy.yml.
               </p>
            </div>
          )}

          {activeTab === 'env' && (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-300">
               <div className="flex justify-between items-center">
                 <div>
                    <h4 className="text-sm font-bold text-white uppercase tracking-tight">Secrets & Config</h4>
                    <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">Injected into container at runtime</p>
                 </div>
                 <div className="flex gap-2">
                    <input 
                        type="file" 
                        ref={fileInputRef} 
                        onChange={handleEnvFileUpload} 
                        className="hidden" 
                        accept=".env"
                    />
                    <button 
                        onClick={() => fileInputRef.current?.click()}
                        className="px-4 py-2 bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2 border border-white/10"
                    >
                        <Upload className="w-3.5 h-3.5" /> Import .env
                    </button>
                    <button onClick={addEnvVar} className="px-4 py-2 bg-accent/10 hover:bg-accent text-accent hover:text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2 border border-accent/20">
                    <Plus className="w-3.5 h-3.5" /> Add Variable
                    </button>
                 </div>
               </div>
               
               {/* Drag and Drop Zone */}
               <div 
                 onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
                 onDrop={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    const file = e.dataTransfer.files?.[0];
                    if (file) {
                        const inputE = { target: { files: [file] } } as any;
                        handleEnvFileUpload(inputE);
                    }
                 }}
                 className="group/drop border-2 border-dashed border-card-border rounded-2xl p-8 flex flex-col items-center justify-center bg-white/5 hover:bg-accent/5 hover:border-accent/40 transition-all cursor-pointer"
                 onClick={() => fileInputRef.current?.click()}
               >
                  <div className="p-3 bg-white/5 rounded-2xl mb-3 group-hover/drop:scale-110 transition-transform duration-300">
                    <Upload className="w-6 h-6 text-gray-600 group-hover/drop:text-accent" />
                  </div>
                  <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest group-hover/drop:text-accent transition-colors">Drag & Drop .env file here</p>
                  <p className="text-[9px] text-gray-600 font-bold uppercase tracking-widest mt-1">or click to browse local files</p>
               </div>

               <div className="space-y-3">
                 {envVars.map((ev, i) => (
                   <div key={i} className="flex gap-3 animate-in slide-in-from-left-2 duration-200">
                     <div className="flex-1 bg-background border border-card-border rounded-xl px-4 py-3 flex items-center group focus-within:border-accent/50 transition-all">
                        <input 
                          placeholder="KEY"
                          className="w-full bg-transparent text-xs font-mono outline-none text-white uppercase placeholder:text-gray-800"
                          value={ev.key}
                          onChange={(e) => updateEnvVar(i, "key", e.target.value)}
                        />
                     </div>
                     <div className="flex-[1.5] bg-background border border-card-border rounded-xl px-4 py-3 flex items-center group focus-within:border-accent/50 transition-all">
                        <input 
                          placeholder="VALUE"
                          className="w-full bg-transparent text-xs font-mono outline-none text-white placeholder:text-gray-800"
                          value={ev.value}
                          onChange={(e) => updateEnvVar(i, "value", e.target.value)}
                        />
                     </div>
                     <button onClick={() => removeEnvVar(i)} className="p-3 bg-red-500/5 hover:bg-red-500/10 text-red-500 rounded-xl transition-all border border-red-500/10">
                       <Trash2 className="w-4 h-4" />
                     </button>
                   </div>
                 ))}
               </div>
            </div>
          )}

          {activeTab === 'pipeline' && (
            <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-300">
               {/* Pre-Build Section */}
               <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <div>
                       <h4 className="text-sm font-bold text-white uppercase tracking-tight">Pre-Build Steps</h4>
                       <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">Executed in workspace before Docker build</p>
                    </div>
                    <button onClick={() => addStep("pre")} className="px-4 py-2 bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2 border border-white/5">
                      <Plus className="w-3.5 h-3.5" /> Add Step
                    </button>
                  </div>
                  
                  <div className="space-y-2">
                    {preBuildSteps.map((step, i) => (
                      <div key={i} className="flex gap-2">
                        <div className="flex-1 bg-background/50 border border-card-border rounded-xl px-4 py-3 flex items-center group focus-within:border-accent transition-all">
                           <Terminal className="w-3.5 h-3.5 text-gray-600 mr-3" />
                           <input 
                             placeholder="e.g. npm install --production"
                             className="w-full bg-transparent text-xs font-mono outline-none text-white placeholder:text-gray-800"
                             value={step}
                             onChange={(e) => updateStep("pre", i, e.target.value)}
                           />
                        </div>
                        <button onClick={() => removeStep("pre", i)} className="p-3 text-gray-600 hover:text-red-500 transition-all">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
               </div>

               <div className="h-px bg-card-border" />

               {/* Post-Build Section */}
               <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <div>
                       <h4 className="text-sm font-bold text-white uppercase tracking-tight">Post-Build Steps</h4>
                       <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">Executed in container after startup</p>
                    </div>
                    <button onClick={() => addStep("post")} className="px-4 py-2 bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2 border border-white/5">
                      <Plus className="w-3.5 h-3.5" /> Add Step
                    </button>
                  </div>
                  
                  <div className="space-y-2">
                    {postBuildSteps.map((step, i) => (
                      <div key={i} className="flex gap-2">
                        <div className="flex-1 bg-background/50 border border-card-border rounded-xl px-4 py-3 flex items-center group focus-within:border-accent transition-all">
                           <Terminal className="w-3.5 h-3.5 text-gray-600 mr-3" />
                           <input 
                             placeholder="e.g. ./migrate.sh"
                             className="w-full bg-transparent text-xs font-mono outline-none text-white placeholder:text-gray-800"
                             value={step}
                             onChange={(e) => updateStep("post", i, e.target.value)}
                           />
                        </div>
                        <button onClick={() => removeStep("post", i)} className="p-3 text-gray-600 hover:text-red-500 transition-all">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
               </div>

               <div className="h-px bg-card-border" />

               {/* Volumes Section */}
               <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <div>
                       <h4 className="text-sm font-bold text-white uppercase tracking-tight">Persistent Volumes</h4>
                       <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">Map host storage to container paths</p>
                    </div>
                    <button onClick={() => setVolumes([...volumes, ""])} className="px-4 py-2 bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2 border border-white/5">
                      <Plus className="w-3.5 h-3.5" /> Add Volume
                    </button>
                  </div>
                  
                  <div className="space-y-2">
                    {volumes.map((vol, i) => (
                      <div key={i} className="flex gap-2">
                        <div className="flex-1 bg-background/50 border border-card-border rounded-xl px-4 py-3 flex items-center group focus-within:border-accent transition-all">
                           <Layers className="w-3.5 h-3.5 text-gray-600 mr-3" />
                           <input 
                             placeholder="e.g. ./data:/app/data"
                             className="w-full bg-transparent text-xs font-mono outline-none text-white placeholder:text-gray-800"
                             value={vol}
                             onChange={(e) => {
                                const updated = [...volumes];
                                updated[i] = e.target.value;
                                setVolumes(updated);
                             }}
                           />
                        </div>
                        <button onClick={() => setVolumes(volumes.filter((_, idx) => idx !== i))} className="p-3 text-gray-600 hover:text-red-500 transition-all">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                    {volumes.length === 0 && (
                      <p className="text-[9px] text-gray-600 font-bold uppercase tracking-widest text-center py-4 border border-dashed border-card-border rounded-2xl">
                        No volumes configured. Containers will be ephemeral.
                      </p>
                    )}
                  </div>
               </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-8 bg-background border-t border-card-border flex flex-col gap-4">
           <button 
             disabled={loading || !repo || !name || fetchingBranches}
             onClick={() => handleDeploy()}
             className="w-full bg-accent hover:bg-accent/90 disabled:opacity-50 disabled:cursor-not-allowed text-white font-black py-5 rounded-2xl transition-all shadow-xl shadow-accent/20 flex items-center justify-center gap-3 uppercase tracking-[0.2em] text-sm group"
           >
             {loading ? <div className="flex items-center gap-3 animate-pulse">Initializing Engine...</div> : 
              <>
                Initialize Deployment
                <Rocket className="w-5 h-5 group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform" />
              </>}
           </button>
           <p className="text-[9px] text-gray-600 font-bold uppercase tracking-[0.3em] text-center">AutoDeploy Distributed Orchestrator v0.5 ALPHA</p>

        </div>
      </div>
      <PortCollisionModal
        isOpen={portCollision.isOpen}
        onClose={() => setPortCollision(prev => ({ ...prev, isOpen: false }))}
        onConfirm={(port) => {
          setPortCollision(prev => ({ ...prev, isOpen: false }));
          handleDeploy(port);
        }}
        detectedPort={portCollision.detectedPort}
        source={portCollision.source}
        currentPort={internalPort}
      />
    </div>
  );
}
