"use client";
import { X, AlertTriangle, Settings2, GitBranch, CheckCircle2 } from "lucide-react";

export interface EnvConflictEntry {
    key: string;
    repo_value: string;
    dashboard_value: string;
}

interface EnvConflictModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: (choice: "dashboard" | "repo") => void;
    conflicts: EnvConflictEntry[];
}

export default function EnvConflictModal({
    isOpen,
    onClose,
    onConfirm,
    conflicts,
}: EnvConflictModalProps) {
    if (!isOpen) return null;

    const options = [
        {
            id: "dashboard",
            label: "Use Dashboard Settings",
            description: "Dashboard env values override the repository configuration for this deploy.",
            icon: Settings2,
        },
        {
            id: "repo",
            label: "Use Repository Settings",
            description: "The repo autodeploy.yml values win for any conflicting keys during this deploy.",
            icon: GitBranch,
        },
    ] as const;

    return (
        <div className="fixed inset-0 z-[600] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
            <div className="w-full max-w-xl bg-[#121212] border border-white/10 rounded-[24px] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
                <div className="p-6 border-b border-white/5 bg-amber-500/5">
                    <div className="flex items-center gap-3 mb-2">
                        <AlertTriangle className="w-5 h-5 text-amber-500" />
                        <h3 className="text-sm font-black text-white uppercase tracking-widest">Environment Conflict Detected</h3>
                    </div>
                    <p className="text-xs text-gray-400 font-medium leading-relaxed">
                        The repository and your dashboard define different values for the same environment variables. Choose which version should win for this deployment.
                    </p>
                </div>

                <div className="p-6 space-y-4">
                    {conflicts.map((conflict) => (
                        <div key={conflict.key} className="rounded-2xl border border-white/5 bg-white/5 p-4">
                            <div className="flex items-center justify-between mb-2">
                                <span className="text-[10px] font-black uppercase tracking-[0.2em] text-amber-400">{conflict.key}</span>
                                <CheckCircle2 className="w-4 h-4 text-amber-500" />
                            </div>
                            <div className="grid grid-cols-2 gap-3 text-[10px] text-gray-300">
                                <div>
                                    <p className="text-gray-500 uppercase tracking-widest mb-1">Repo</p>
                                    <p className="font-mono break-all">{conflict.repo_value}</p>
                                </div>
                                <div>
                                    <p className="text-gray-500 uppercase tracking-widest mb-1">Dashboard</p>
                                    <p className="font-mono break-all">{conflict.dashboard_value}</p>
                                </div>
                            </div>
                        </div>
                    ))}

                    <div className="space-y-3 pt-2">
                        {options.map((opt) => (
                            <button
                                key={opt.id}
                                onClick={() => onConfirm(opt.id)}
                                className="w-full p-4 bg-white/5 hover:bg-white/10 border border-white/5 rounded-2xl flex items-center justify-between group transition-all text-left"
                            >
                                <div className="flex items-center gap-4">
                                    <div className="p-2 bg-background rounded-xl border border-white/5 group-hover:border-amber-500/30 transition-all">
                                        <opt.icon className="w-4 h-4 text-amber-500" />
                                    </div>
                                    <div>
                                        <p className="text-xs font-black text-white uppercase tracking-tight">{opt.label}</p>
                                        <p className="text-[10px] text-gray-500 font-medium">{opt.description}</p>
                                    </div>
                                </div>
                            </button>
                        ))}
                    </div>
                </div>

                <div className="p-4 bg-white/5 border-t border-white/5 flex justify-end">
                    <button onClick={onClose} className="px-4 py-2 text-[10px] font-black text-gray-500 hover:text-white uppercase tracking-widest transition-colors">
                        Cancel Deployment
                    </button>
                </div>
            </div>
        </div>
    );
}
