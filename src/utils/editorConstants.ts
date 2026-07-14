export const EDITOR_HEADING_LEVELS = [1, 2, 3] as const;

export const EDITOR_TEXT_ALIGN_TYPES = ['heading', 'paragraph'];

export const HEADING_OPTIONS = [
    { value: 'paragraph', label: '본문' },
    ...EDITOR_HEADING_LEVELS.map(level => ({ value: `h${level}`, label: `제목 ${level}` }))
];

export const CODE_LANGUAGES = [
    { value: 'plaintext', label: '기본' },
    { value: 'bash', label: 'Bash' },
    { value: 'css', label: 'CSS' },
    { value: 'xml', label: 'HTML' },
    { value: 'javascript', label: 'JavaScript' },
    { value: 'typescript', label: 'TypeScript' },
    { value: 'json', label: 'JSON' },
    { value: 'markdown', label: 'Markdown' },
    { value: 'mermaid', label: 'Mermaid' },
    { value: 'python', label: 'Python' },
    { value: 'sql', label: 'SQL' }
];

export const FONT_SIZES = [
    { value: 'default', label: '본문' },
    { value: '12px', label: '12' },
    { value: '14px', label: '14' },
    { value: '16px', label: '16' },
    { value: '18px', label: '18' },
    { value: '20px', label: '20' },
    { value: '24px', label: '24' },
    { value: '28px', label: '28' },
    { value: '32px', label: '32' }
];

export const TEXT_COLORS = [
    '#1d1916',
    '#0f766e',
    '#2563eb',
    '#6b21a8',
    '#b45309',
    '#b91c1c',
    '#4b5563'
];

export const HIGHLIGHT_COLORS = [
    '#fef3c7',
    '#d1fae5',
    '#dbeafe',
    '#fee2e2',
    '#ede9fe',
    '#fce7f3'
];
