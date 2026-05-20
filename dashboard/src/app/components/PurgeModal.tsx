"use client";
import { useState, useEffect } from "react";
import { X, AlertTriangle, Loader2, Box } from "lucide-react";

interface PurgeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  apps: any[];
}

export default function PurgeModal({ isOpen, onClose, onConfirm, apps }: PurgeModalProps) {
  const [step, setStep] = useState(1);
  const [confirmText, setConfirmText] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setStep(1);
      setConfirmText("");
      setLoading(false);
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        const allModals = Array.from(document.querySelectorAll('.fixed.inset-0'));
        const topModal = allModals.reduce((prev, curr) => {
          const prevZ = parseInt(window.getComputedStyle(prev).zIndex) || 0;
          const currZ = parseInt(window.getComputedStyle(curr).zIndex) || 0;
          return currZ > prevZ ? curr : prev;
        }, allModals[0]);

        const myWrapper = document.getElementById('purge-modal-wrapper');
        if (topModal === myWrapper) {
          e.stopImmediatePropagation();
          onClose();
        }
      }
    };
    window.addEventListener("keydown", handleEsc, true);
    return () => window.removeEventListener("keydown", handleEsc, true);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleFinalConfirm = async () => {
    if (confirmText !== "PURGE") return;
    setLoading(true);
    await onConfirm();
    setLoading(false);
    onClose();
  };

  const AppList = () => (
    <div className="bg-black/20 border border-white/5 rounded-2xl p-4 my-6 text-left">
       <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-3 flex items-center gap-2">
          <Box className="w-3 h-3" /> Target Applications ({apps.length})
       </p>
       <div className="max-h-32 overflow-y-auto pr-2 space-y-1 custom-scrollbar">
          {apps.map(app => (
            <div key={app.id} className="flex items-center gap-2 text-[11px] font-mono text-gray-300">
               <span className="w-1 h-1 bg-red-500 rounded-full" />
               {app.name}
            </div>
          ))}
          {apps.length === 0 && (
            <p className="text-[10px] text-gray-600 italic">No applications found in cluster.</p>
          )}
       </div>
    </div>
  );

  return (
    <div 
      id="purge-modal-wrapper"
      className="fixed inset-0 z-[1000] flex items-center justify-center p-4 animate-in fade-in duration-200"
    >
      <div className="fixed inset-0 bg-black/80 backdrop-blur-md" onClick={onClose} />
      
      <div className="relative w-full max-w-md bg-card border border-red-500/20 rounded-[32px] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
        <div className="p-8">
           <div className="w-16 h-16 bg-red-500/10 rounded-2xl flex items-center justify-center mb-6 mx-auto">
              <AlertTriangle className="w-8 h-8 text-red-500" />
           </div>

           {step === 1 ? (
             <div className="text-center animate-in fade-in slide-in-from-bottom-2">
                <h3 className="text-xl font-black text-white uppercase tracking-tight mb-2">Initial Warning</h3>
                <p className="text-sm text-gray-500">You are about to purge the entire cluster. This will delete all applications listed below and stop all running containers. Continue?</p>
                
                <AppList />

                <div className="flex gap-3">
                   <button 
                     onClick={onClose}
                     className="flex-1 px-6 py-3 bg-white/5 hover:bg-white/10 text-white text-xs font-black rounded-xl transition-all uppercase tracking-widest"
                   >
                     Cancel
                   </button>
                   <button 
                     onClick={() => setStep(2)}
                     className="flex-1 px-6 py-3 bg-red-500 text-white text-xs font-black rounded-xl transition-all uppercase tracking-widest shadow-lg shadow-red-500/20"
                   >
                     I Understand
                   </button>
                </div>
             </div>
           ) : (
             <div className="text-center animate-in fade-in slide-in-from-bottom-2">
                <h3 className="text-xl font-black text-red-500 uppercase tracking-tight mb-2">Final Confirmation</h3>
                <p className="text-sm text-gray-500">This action is 100% irreversible. To proceed, please type <span className="text-white font-mono font-bold bg-white/10 px-2 py-0.5 rounded">PURGE</span> below to delete all the listed apps.</p>
                
                <AppList />

                <input 
                  type="text"
                  placeholder="Type PURGE to confirm"
                  className="w-full bg-background border border-red-500/30 rounded-xl px-4 py-4 text-center text-sm font-mono text-white mb-6 outline-none focus:border-red-500 transition-all uppercase"
                  value={confirmText}
                  onChange={(e) => setConfirmText(e.target.value)}
                />

                <div className="flex gap-3">
                   <button 
                     onClick={() => setStep(1)}
                     disabled={loading}
                     className="flex-1 px-6 py-3 bg-white/5 hover:bg-white/10 text-white text-xs font-black rounded-xl transition-all uppercase tracking-widest disabled:opacity-50"
                   >
                     Back
                   </button>
                   <button 
                     onClick={handleFinalConfirm}
                     disabled={confirmText !== "PURGE" || loading}
                     className="flex-1 px-6 py-3 bg-red-500 text-white text-xs font-black rounded-xl transition-all uppercase tracking-widest shadow-lg shadow-red-500/20 disabled:opacity-20 disabled:grayscale"
                   >
                     {loading ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : "PURGE CLUSTER"}
                   </button>
                </div>
             </div>
           )}
        </div>
      </div>
    </div>
  );
}
