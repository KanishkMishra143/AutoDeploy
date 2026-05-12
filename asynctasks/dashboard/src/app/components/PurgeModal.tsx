"use client";
import { useState, useEffect } from "react";
import { X, AlertTriangle, Loader2 } from "lucide-react";

interface PurgeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

export default function PurgeModal({ isOpen, onClose, onConfirm }: PurgeModalProps) {
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

  if (!isOpen) return null;

  const handleFinalConfirm = async () => {
    if (confirmText !== "PURGE") return;
    setLoading(true);
    await onConfirm();
    setLoading(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="fixed inset-0 bg-black/80 backdrop-blur-md" onClick={onClose} />
      
      <div className="relative w-full max-w-md bg-card border border-red-500/20 rounded-[32px] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
        <div className="p-8">
           <div className="w-16 h-16 bg-red-500/10 rounded-2xl flex items-center justify-center mb-6 mx-auto">
              <AlertTriangle className="w-8 h-8 text-red-500" />
           </div>

           {step === 1 ? (
             <div className="text-center animate-in fade-in slide-in-from-bottom-2">
                <h3 className="text-xl font-black text-white uppercase tracking-tight mb-2">Initial Warning</h3>
                <p className="text-sm text-gray-500 mb-8">You are about to purge the entire cluster. This will delete all applications and stop all running containers. Continue?</p>
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
                <p className="text-sm text-gray-500 mb-6">This action is 100% irreversible. To proceed, please type <span className="text-white font-mono font-bold bg-white/10 px-2 py-0.5 rounded">PURGE</span> below.</p>
                
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
                     {loading ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : "PURGE ALL"}
                   </button>
                </div>
             </div>
           )}
        </div>
      </div>
    </div>
  );
}
