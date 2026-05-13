"use client";
import { X, AlertCircle } from "lucide-react";
import { useEffect } from "react";

interface ConfirmationModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmLabel: string;
  confirmVariant?: "danger" | "accent";
  onConfirm: () => void;
  onCancel: () => void;
}

export default function ConfirmationModal({ 
  isOpen, 
  title, 
  message, 
  confirmLabel, 
  confirmVariant = "accent",
  onConfirm, 
  onCancel 
}: ConfirmationModalProps) {
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

        const myWrapper = document.getElementById('confirmation-modal-wrapper');
        if (topModal === myWrapper) {
          e.stopImmediatePropagation();
          onCancel();
        }
      }
    };
    window.addEventListener("keydown", handleEsc, true);
    return () => window.removeEventListener("keydown", handleEsc, true);
  }, [isOpen, onCancel]);

  if (!isOpen) return null;

  return (
    <div 
      id="confirmation-modal-wrapper"
      onClick={(e) => e.target === e.currentTarget && onCancel()}
      className="fixed inset-0 z-[2000] flex items-center justify-center bg-black/90 backdrop-blur-sm p-4 animate-in fade-in duration-200"
    >
      <div className="bg-card border border-card-border w-full max-w-sm rounded-[24px] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
        <div className="p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className={`p-2 rounded-lg ${confirmVariant === 'danger' ? 'bg-red-500/10 text-red-500' : 'bg-accent/10 text-accent'}`}>
              <AlertCircle className="w-5 h-5" />
            </div>
            <h3 className="text-lg font-bold text-white">{title}</h3>
          </div>
          
          <p className="text-gray-400 text-sm leading-relaxed mb-8">
            {message}
          </p>

          <div className="flex gap-3">
            <button 
              onClick={onCancel}
              className="flex-1 px-4 py-2.5 bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white rounded-xl text-xs font-bold transition-all uppercase tracking-widest"
            >
              Cancel
            </button>
            <button 
              onClick={onConfirm}
              className={`flex-1 px-4 py-2.5 rounded-xl text-xs font-black text-white transition-all uppercase tracking-widest shadow-lg ${
                confirmVariant === 'danger' 
                ? 'bg-red-500 hover:bg-red-600 shadow-red-500/20' 
                : 'bg-accent hover:bg-accent/90 shadow-accent/20'
              }`}
            >
              {confirmLabel}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
