import React, { useEffect } from 'react';
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react';

export default function Toast({ toast, onClose }) {
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => {
      onClose();
    }, 4000);
    return () => clearTimeout(timer);
  }, [toast, onClose]);

  if (!toast) return null;

  const isSuccess = toast.type === 'success';
  const isError = toast.type === 'error';
  const isInfo = toast.type === 'info';

  const borderColor = isSuccess ? '#10b981' : isError ? '#ef4444' : '#06b6d4';
  const bgColor = isSuccess
    ? 'rgba(6, 78, 59, 0.9)'
    : isError
    ? 'rgba(127, 29, 29, 0.9)'
    : 'rgba(12, 74, 96, 0.9)';

  return (
    <div
      style={{
        position: 'fixed',
        bottom: '1.75rem',
        right: '1.75rem',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        gap: '0.75rem',
        padding: '0.85rem 1.25rem',
        borderRadius: '12px',
        background: bgColor,
        backdropFilter: 'blur(16px)',
        border: `1px solid ${borderColor}`,
        boxShadow: '0 10px 30px rgba(0, 0, 0, 0.5)',
        color: '#f8fafc',
        fontSize: '0.85rem',
        fontWeight: '500',
        maxWidth: '420px',
        animation: 'toastSlideIn 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
      }}
    >
      {isSuccess && <CheckCircle2 size={18} color="#34d399" />}
      {isError && <AlertCircle size={18} color="#f87171" />}
      {isInfo && <Info size={18} color="#38bdf8" />}

      <div style={{ flex: 1 }}>{toast.message}</div>

      <button
        onClick={onClose}
        style={{
          background: 'none',
          border: 'none',
          color: '#94a3b8',
          cursor: 'pointer',
          padding: '0.2rem',
          display: 'flex',
          alignItems: 'center',
        }}
      >
        <X size={16} />
      </button>

      <style>{`
        @keyframes toastSlideIn {
          from { opacity: 0; transform: translateY(20px) scale(0.95); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
      `}</style>
    </div>
  );
}
