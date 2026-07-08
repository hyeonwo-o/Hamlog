import type { CSSProperties } from 'react';

export const graphStageStyle: CSSProperties = {
    backgroundColor: 'var(--surface-muted)',
    backgroundImage: [
        'linear-gradient(rgba(17, 17, 17, 0.035) 1px, transparent 1px)',
        'linear-gradient(90deg, rgba(17, 17, 17, 0.035) 1px, transparent 1px)'
    ].join(', '),
    backgroundSize: '40px 40px'
};
