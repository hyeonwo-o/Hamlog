import { useEffect, useState } from 'react';

export const usePrefersReducedMotion = () => {
    const [prefersReducedMotion, setPrefersReducedMotion] = useState(() => (
        typeof window !== 'undefined'
            && typeof window.matchMedia === 'function'
            && window.matchMedia('(prefers-reduced-motion: reduce)').matches
    ));

    useEffect(() => {
        if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return undefined;

        const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
        const handleChange = () => setPrefersReducedMotion(mediaQuery.matches);

        handleChange();
        mediaQuery.addEventListener('change', handleChange);
        return () => mediaQuery.removeEventListener('change', handleChange);
    }, []);

    return prefersReducedMotion;
};
