"use client";
import { useState, useEffect } from "react";
import { X, Plus, Trash2, Rocket, Globe, Tag, GitBranch, Layers, Terminal, Settings2 } from "lucide-react";
import toast from "react-hot-toast";

type TabType = "general" | "env" | "pipeline";

export default function DeployModal({ onClose }: { onClose: (jobId?: string) => void }) {
  const [activeTab, setActiveTab] = useState<TabType>("general");
  const [name, setName] = useState("");
  const [repo, setRepo] = useState("");
  const [branch, setBranch] = useState("master");
  const [stack, setStack] = useState("dockerfile");
  const [availableBranches, setAvailableBranches] = useState<string[]>([]);
  const [fetchingBranches, setFetchingBranches] = useState(false);
  const [envVars, setEnvVars] = useState<{ key: string; value: string }[]>([
    { key: "", value: "" }
  ]);
  const [preBuildSteps, setPreBuildSteps] = useState<string[]>([]);
  const [postBuildSteps, setPostBuildSteps] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  // Fetch branches when repo URL changes
  useEffect(() => {
    if (repo && repo.startsWith("http")) {
      const fetchBranches = async () => {
        setFetchingBranches(true);
        try {
          const res = await fetch(`http://localhost:8000/apps/branches?repo_url=${repo}`);
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
  }, [repo]);

  const addEnvVar = () => setEnvVars([...envVars, { key: "", value: "" }]);
  const removeEnvVar = (index: number) => setEnvVars(envVars.filter((_, i) => i !== index));
  const updateEnvVar = (index: number, field: "key" | "value", val: string) => {
    const updated = [...envVars];
    updated[index][field] = val;
    setEnvVars(updated);
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

  const handleDeploy = async () => {
    setLoading(true);
    const envObj = envVars.reduce((acc, curr) => {
      if (curr.key) acc[curr.key] = curr.value;
      return acc;
    }, {} as Record<string, string>);

    try {
      const appRes = await fetch("http://localhost:8000/apps", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name,
          repo_url: repo,
          branch: branch,
          stack: stack,
          env_vars: envObj,
          pre_build_steps: preBuildSteps.filter(s => s.trim()),
          post_build_steps: postBuildSteps.filter(s => s.trim())
        }),
      });

      if (!appRes.ok) {
        const err = await appRes.json();
        toast.error(err.detail || "Failed to create application");
        setLoading(false);
        return;
      }

      const appData = await appRes.json();
      const deployRes = await fetch(`http://localhost:8000/apps/${appData.id}/deploy`, {
        method: "POST"
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
                 <label className="block text-[10px] font-black text-gray-500 uppercase tracking-widest mb-3">Git Repository Source</label>
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
                       onChange={(e) => setStack(e.target.value)}
                     >
                       <option value="dockerfile">NATIVE DOCKERFILE</option>
                       <option value="python">PYTHON ENVIRONMENT</option>
                       <option value="nodejs">NODE.JS RUNTIME</option>
                       <option value="static">STATIC SITE (NGINX)</option>
                     </select>
                   </div>
                 </div>
               </div>
            </div>
          )}

          {activeTab === 'env' && (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-300">
               <div className="flex justify-between items-center">
                 <div>
                    <h4 className="text-sm font-bold text-white uppercase tracking-tight">Secrets & Config</h4>
                    <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">Injected into container at runtime</p>
                 </div>
                 <button onClick={addEnvVar} className="px-4 py-2 bg-accent/10 hover:bg-accent text-accent hover:text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2 border border-accent/20">
                   <Plus className="w-3.5 h-3.5" /> Add Variable
                 </button>
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
                       <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">Executed after image build, before deploy</p>
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
                             placeholder="e.g. python migrate.py"
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
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-8 bg-background border-t border-card-border flex flex-col gap-4">
           <button 
             disabled={loading || !repo || !name || fetchingBranches}
             onClick={handleDeploy}
             className="w-full bg-accent hover:bg-accent/90 disabled:opacity-50 disabled:cursor-not-allowed text-white font-black py-5 rounded-2xl transition-all shadow-xl shadow-accent/20 flex items-center justify-center gap-3 uppercase tracking-[0.2em] text-sm group"
           >
             {loading ? <div className="flex items-center gap-3 animate-pulse">Initializing Engine...</div> : 
              <>
                Initialize Deployment
                <Rocket className="w-5 h-5 group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform" />
              </>}
           </button>
           <p className="text-[9px] text-gray-600 font-bold uppercase tracking-[0.3em] text-center">AutoDeploy Distributed Orchestrator v1.5</p>
        </div>
      </div>
    </div>
  );
}
