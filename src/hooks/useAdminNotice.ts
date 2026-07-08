import { useCallback, useEffect, useState } from 'react';

export type AdminNoticeTone = 'success' | 'error';

export const useAdminNotice = (durationMs = 3200) => {
  const [adminNotice, setAdminNotice] = useState('');
  const [adminNoticeTone, setAdminNoticeTone] = useState<AdminNoticeTone>('success');

  const showAdminNotice = useCallback((
    message: string,
    tone: AdminNoticeTone = 'success'
  ) => {
    setAdminNotice(message);
    setAdminNoticeTone(tone);
  }, []);

  const clearAdminNotice = useCallback(() => {
    setAdminNotice('');
  }, []);

  useEffect(() => {
    if (!adminNotice) return;
    const timeoutId = window.setTimeout(clearAdminNotice, durationMs);

    return () => window.clearTimeout(timeoutId);
  }, [adminNotice, clearAdminNotice, durationMs]);

  return {
    adminNotice,
    adminNoticeTone,
    clearAdminNotice,
    showAdminNotice
  };
};
