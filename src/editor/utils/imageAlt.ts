const GENERIC_IMAGE_ALT_PATTERN = /^(?:image|img|photo|picture|screenshot|이미지|사진|스크린샷)(?:[\s_-]*\d+)*$/i;
const GENERATED_UPLOAD_PATTERN = /^upload[\s_-]*\d{8,}/i;

const decodePathSegment = (value: string) => {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
};

export const createDefaultImageAlt = (source = '') => {
  const cleanSource = String(source).split(/[?#]/, 1)[0];
  const lastSegment = decodePathSegment(cleanSource.split(/[\\/]/).pop() ?? '');
  const withoutExtension = lastSegment.replace(/\.(?:avif|gif|jpe?g|png|svg|webp)$/i, '');
  const normalized = withoutExtension
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (!normalized || GENERIC_IMAGE_ALT_PATTERN.test(normalized) || GENERATED_UPLOAD_PATTERN.test(normalized)) {
    return '';
  }

  return normalized.slice(0, 180);
};

export const isGenericImageAlt = (value = '') => {
  const normalized = String(value).trim();
  if (!normalized) return true;
  if (GENERIC_IMAGE_ALT_PATTERN.test(normalized) || GENERATED_UPLOAD_PATTERN.test(normalized)) return true;
  return /\.(?:avif|gif|jpe?g|png|svg|webp)$/i.test(normalized);
};

interface MeaningfulImageAltCandidates {
  existingAlt?: string;
  caption?: string;
  context?: string;
  src?: string;
}

export const resolveMeaningfulImageAlt = ({
  existingAlt = '',
  caption = '',
  context = '',
  src = ''
}: MeaningfulImageAltCandidates) => {
  for (const candidate of [existingAlt, caption, context]) {
    const normalized = String(candidate).replace(/\s+/g, ' ').trim().slice(0, 180);
    if (normalized && !isGenericImageAlt(normalized)) return normalized;
  }

  return createDefaultImageAlt(src);
};
