"use client";
import { X, AlertCircle, Terminal, Settings2, CheckCircle2 } from "lucide-react";

interface PortCollisionModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: (port: number) => void;
    detectedPort: number | null;
    source: string | null;
    currentPort: number;
}

export default function PortCollisionModal({ 
    isOpen, 
    onClose, 
    onConfirm, 
    detectedPort, 
    source, 
    currentPort 
}: PortCollisionModalProps) {
    if (!isOpen) return null;

    const options = [
        {
            id: 'detected',
            label: `Use Port from ${source || 'Repo'}`,
            port: detectedPort,
            description: "Recommended: Matches your source code configuration.",
            icon: CheckCircle2,
            active: detectedPort !== null && detectedPort !== currentPort
        },
        {
            id: 'current',
            label: "Keep Dashboard Port",
            port: currentPort,
            description: "Uses the port currently saved in your app settings.",
            icon: Settings2,
            active: true
        },
        {
            id: 'default',
            label: "Reset to Default",
            port: 8000,
            description: "Standard default port for most web applications.",
            icon: Terminal,
            active: detectedPort !== 8000 && currentPort !== 8000
        }
    ].filter(opt => opt.active && opt.port !== null);

    return (
        <div className="fixed inset-0 z-[600] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
            <div className="w-full max-w-md bg-[#121212] border border-white/10 rounded-[24px] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
                <div className="p-6 border-b border-white/5 bg-accent/5">
                    <div className="flex items-center gap-3 mb-2">
                        <AlertCircle className="w-5 h-5 text-accent" />
                        <h3 className="text-sm font-black text-white uppercase tracking-widest">Port Discrepancy Detected</h3>
                    </div>
                    <p className="text-xs text-gray-400 font-medium leading-relaxed">
                        We found a port configuration in your repository that differs from your current dashboard settings. Which one should we use?
                    </p>
                </div>

                <div className="p-6 space-y-3">
                    {options.map((opt) => (
                        <button
                            key={opt.id}
                            onClick={() => onConfirm(opt.port!)}
                            className="w-full p-4 bg-white/5 hover:bg-white/10 border border-white/5 rounded-2xl flex items-center justify-between group transition-all text-left"
                        >
                            <div className="flex items-center gap-4">
                                <div className="p-2 bg-background rounded-xl border border-white/5 group-hover:border-accent/30 transition-all">
                                    <opt.icon className={`w-4 h-4 ${opt.id === 'detected' ? 'text-accent' : 'text-gray-500'}`} />
                                </div>
                                <div>
                                    <p className="text-xs font-black text-white uppercase tracking-tight">{opt.label}</p>
                                    <p className="text-[10px] text-gray-500 font-medium">{opt.description}</p>
                                </div>
                            </div>
                            <span className="text-base font-black text-accent font-mono">{opt.port}</span>
                        </button>
                    ))}
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
