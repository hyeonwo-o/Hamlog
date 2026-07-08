import { useCallback, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import type { AdminSection } from '../types/admin';
import { parseAdminSection } from '../utils/adminSections';

interface AdminLocationUpdates {
  section?: AdminSection;
  post?: string | null;
}

interface AdminLocationOptions {
  replace?: boolean;
}

export const useAdminRouteState = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const sectionParam = searchParams.get('section');
  const activeSection = parseAdminSection(sectionParam);
  const activeId = searchParams.get('post');

  const updateAdminLocation = useCallback((
    updates: AdminLocationUpdates,
    options?: AdminLocationOptions
  ) => {
    setSearchParams(current => {
      const next = new URLSearchParams(current);

      if (updates.section !== undefined) {
        next.set('section', updates.section);
      }

      if (updates.post !== undefined) {
        if (updates.post) {
          next.set('post', updates.post);
        } else {
          next.delete('post');
        }
      }

      return next;
    }, options);
  }, [setSearchParams]);

  useEffect(() => {
    if (!sectionParam) {
      updateAdminLocation({ section: activeSection }, { replace: true });
    }
  }, [activeSection, sectionParam, updateAdminLocation]);

  return {
    activeId,
    activeSection,
    updateAdminLocation
  };
};
