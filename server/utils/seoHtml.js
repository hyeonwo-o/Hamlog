export const escapeHtml = (value = '') => String(value)
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#39;');

export const escapeXml = (value = '') => String(value)
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&apos;');

export const wrapCdata = (value = '') => `<![CDATA[${String(value).replace(/]]>/g, ']]]]><![CDATA[>')}]]>`;

export const replaceHeadTag = (html, pattern, replacement) => (
  pattern.test(html)
    ? html.replace(pattern, replacement)
    : html.replace('</head>', `  ${replacement}\n</head>`)
);

export const removeHeadTag = (html, pattern) => html.replace(pattern, '');

export const normalizeBaseUrl = (value, fallback) => {
  const candidate = String(value || fallback).trim().replace(/\/+$/, '');
  return /^https?:\/\//i.test(candidate) ? candidate : fallback;
};

export const toAbsoluteUrl = (baseUrl, value = '', fallbackPath = '/avatar.jpg') => {
  if (!value) return `${baseUrl}${fallbackPath.startsWith('/') ? '' : '/'}${fallbackPath}`;
  if (/^https?:\/\//i.test(value)) return value;
  return `${baseUrl}${value.startsWith('/') ? '' : '/'}${value}`;
};
