import React from 'react';
import type { AdminNoticeTone } from '../../hooks/useAdminNotice';

interface AdminNoticeProps {
  message: string;
  tone: AdminNoticeTone;
  onClose: () => void;
}

const AdminNotice: React.FC<AdminNoticeProps> = ({ message, tone, onClose }) => {
  if (!message) return null;

  return (
    <div className="fixed right-4 top-[76px] z-30 max-w-sm rounded-lg border border-[color:var(--border)] bg-[var(--surface)] px-4 py-3 text-sm shadow-lg">
      <div className="flex items-start justify-between gap-3">
        <p className={tone === 'error' ? 'text-red-600' : 'text-[var(--text)]'}>
          {message}
        </p>
        <button
          type="button"
          onClick={onClose}
          className="text-xs font-semibold text-[var(--text-muted)] transition hover:text-[var(--text)]"
        >
          닫기
        </button>
      </div>
    </div>
  );
};

export default AdminNotice;
