"use client";
import { useState, useEffect } from "react";
import { X, Plus, Trash2, Rocket, Globe, Tag, GitBranch, Layers } from "lucide-react";
import toast from "react-hot-toast";

export default function DeployModal({ onClose }: { onClose: (jobId?: string) => void }) {
  const [name, setName] = useState("");
  const [repo, setRepo] = useState("");
  const [branch, setBranch] = useState("master");
  const [stack, setStack] = useState("dockerfile");
  const [availableBranches, setAvailableBranches] = useState<string[]>([]);
  const [fetchingBranches, setFetchingBranches] = useState(false);
  const [envVars, setEnvVars] = useState<{ key: string; value: string }[]>([
    { key: "", value: "" }
  ]);
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
            // Intelligent branch selection
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
      const timer = setTimeout(fetchBranches, 1000); // Debounce typing
      return () => clearTimeout(timer);
    }
  }, [repo]);

  // Handle ESC key to close
  useEffect(() => {
    const handleEsc = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.stopImmediatePropagation();
        onClose();
      }
    };
    window.addEventListener("keydown", handleEsc, true);
    return () => window.removeEventListener("keydown", handleEsc, true);
  }, [onClose]);

  const addEnvVar = () => setEnvVars([...envVars, { key: "", value: "" }]);
  const removeEnvVar = (index: number) => setEnvVars(envVars.filter((_, i) => i !== index));
  const updateEnvVar = (index: number, field: "key" | "value", val: string) => {
    const updated = [...envVars];
    updated[index][field] = val;
    setEnvVars(updated);
  };

  const handleDeploy = async () => {
    setLoading(true);
    const envObj = envVars.reduce((acc, curr) => {
      if (curr.key) acc[curr.key] = curr.value;
      return acc;
    }, {} as Record<string, string>);

    try {
      // 1. Create the Application Identity
      const appRes = await fetch("http://localhost:8000/apps", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name,
          repo_url: repo,
          branch: branch,
          stack: stack,
          env_vars: envObj
        }),
      });

      if (!appRes.ok) {
        const err = await appRes.json();
        toast.error(err.detail || "Failed to create application");
        setLoading(false);
        return;
      }

      const appData = await appRes.json();

      // 2. Trigger the first deployment for this app
      const deployRes = await fetch(`http://localhost:8000/apps/${appData.id}/deploy`, {
        method: "POST"
      });
      
      if (deployRes.ok) {
        const jobData = await deployRes.json();
        onClose(jobData.id); // Open logs for the new job
      }
    } catch (err) {
      console.error(err);
      toast.error("An unexpected error occurred.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div 
      onClick={(e) => e.target === e.currentTarget && onClose()}
      className="fixed inset-0 z-[500] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 cursor-default"
    >
      <div className="bg-card border border-card-border w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden cursor-default">
        <div className="p-6 border-b border-card-border flex justify-between items-center">
          <h2 className="text-xl font-bold flex items-center gap-2">
            <Rocket className="w-5 h-5 text-accent" />
            Deploy New Service
          </h2>
          <button onClick={() => onClose()} className="text-gray-400 hover:text-white transition-colors">
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="p-6 space-y-6 max-h-[70vh] overflow-y-auto custom-scrollbar">
          <div>
            <label className="block text-xs font-bold text-gray-400 uppercase mb-2 tracking-wider">Application Name</label>
            <div className="relative">
              <Tag className="absolute left-3 top-3 w-4 h-4 text-gray-500" />
              <input 
                type="text" 
                placeholder="e.g. my-awesome-app"
                className="w-full bg-background border border-card-border rounded-lg py-2.5 pl-10 pr-4 text-sm focus:border-accent outline-none transition-all text-white"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-400 uppercase mb-2 tracking-wider">Git Repository URL</label>
            <div className="relative">
              <Globe className="absolute left-3 top-3 w-4 h-4 text-gray-500" />
              <input 
                type="text" 
                placeholder="https://github.com/user/repo"
                className="w-full bg-background border border-card-border rounded-lg py-2.5 pl-10 pr-4 text-sm focus:border-accent outline-none transition-all text-white"
                value={repo}
                onChange={(e) => setRepo(e.target.value)}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-gray-400 uppercase mb-2 tracking-wider">Target Branch</label>
              <div className="relative">
                <GitBranch className="absolute left-3 top-3 w-4 h-4 text-gray-500 pointer-events-none" />
                <select 
                  className="w-full bg-background border border-card-border rounded-lg py-2.5 pl-10 pr-4 text-sm focus:border-accent outline-none transition-all text-white appearance-none"
                  value={branch}
                  onChange={(e) => setBranch(e.target.value)}
                  disabled={fetchingBranches}
                >
                  {fetchingBranches ? (
                    <option>Fetching...</option>
                  ) : availableBranches.length > 0 ? (
                    availableBranches.map(b => <option key={b} value={b}>{b}</option>)
                  ) : (
                    <option value="master">master</option>
                  )}
                </select>
              </div>
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-400 uppercase mb-2 tracking-wider">Stack Template</label>
              <div className="relative">
                <Layers className="absolute left-3 top-3 w-4 h-4 text-gray-500 pointer-events-none" />
                <select 
                  className="w-full bg-background border border-card-border rounded-lg py-2.5 pl-10 pr-4 text-sm focus:border-accent outline-none transition-all text-white appearance-none"
                  value={stack}
                  onChange={(e) => setStack(e.target.value)}
                >
                  <option value="dockerfile">Native Dockerfile</option>
                  <option value="python">Python API</option>
                  <option value="nodejs">Node.js Express</option>
                  <option value="static">Static Site (Nginx)</option>
                </select>
              </div>
            </div>
          </div>

          <div>
            <div className="flex justify-between items-center mb-2">
              <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider">Environment Variables</label>
              <button onClick={addEnvVar} className="text-accent hover:text-accent/80 text-xs font-bold flex items-center gap-1">
                <Plus className="w-3 h-3" /> ADD VAR
              </button>
            </div>
            
            <div className="space-y-2 max-h-40 overflow-y-auto pr-2 custom-scrollbar">
              {envVars.map((ev, i) => (
                <div key={i} className="flex gap-2">
                  <input 
                    placeholder="KEY"
                    className="flex-1 bg-background border border-card-border rounded-lg px-3 py-2 text-xs outline-none focus:border-accent text-white"
                    value={ev.key}
                    onChange={(e) => updateEnvVar(i, "key", e.target.value)}
                  />
                  <input 
                    placeholder="VALUE"
                    className="flex-1 bg-background border border-card-border rounded-lg px-3 py-2 text-xs outline-none focus:border-accent text-white"
                    value={ev.value}
                    onChange={(e) => updateEnvVar(i, "value", e.target.value)}
                  />
                  <button onClick={() => removeEnvVar(i)} className="text-gray-600 hover:text-red-500 transition-colors">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="p-6 bg-accent/5 border-t border-card-border">
          <button 
            disabled={loading || !repo || !name || fetchingBranches}
            onClick={handleDeploy}
            className="w-full bg-accent hover:bg-accent/90 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold py-3 rounded-xl transition-all shadow-lg shadow-accent/20 flex items-center justify-center gap-2"
          >
            {loading ? "PREPARING ENGINE..." : "LAUNCH APPLICATION"}
          </button>
        </div>
      </div>
    </div>
  );
}
