interface ImageVariantOptions {
  width?: number;
  height?: number;
}

interface ImageVariantCandidate extends ImageVariantOptions {
  descriptor: string;
}

const IMAGE_DIMENSION_BUCKETS = [
  48, 96, 160, 171, 192, 256, 320, 341, 384, 480, 576, 640, 720, 800, 960, 1200, 1920
];
const MIN_IMAGE_DIMENSION = IMAGE_DIMENSION_BUCKETS[0];
const MAX_IMAGE_DIMENSION = IMAGE_DIMENSION_BUCKETS[IMAGE_DIMENSION_BUCKETS.length - 1];
const SAFE_IMAGE_FILENAME = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;
const SAFE_IMAGE_EXTENSION = /\.(?:avif|gif|jpe?g|png|webp)$/i;

const normalizeDimension = (value?: number) => {
  if (!Number.isFinite(value)) return undefined;
  const rounded = Math.round(Number(value));
  if (rounded <= 0) return undefined;
  const clamped = Math.min(MAX_IMAGE_DIMENSION, Math.max(MIN_IMAGE_DIMENSION, rounded));
  return IMAGE_DIMENSION_BUCKETS.reduce((closest, candidate) => (
    Math.abs(candidate - clamped) < Math.abs(closest - clamped) ? candidate : closest
  ));
};

const getOptimizableFilename = (value = '') => {
  const source = String(value).trim();
  if (source === '/avatar.jpg') return 'avatar.jpg';

  const match = source.match(/^\/uploads\/([^/?#]+)$/);
  if (!match) return '';

  try {
    const filename = decodeURIComponent(match[1]);
    if (
      filename === 'avatar.jpg'
      || !SAFE_IMAGE_FILENAME.test(filename)
      || !SAFE_IMAGE_EXTENSION.test(filename)
    ) return '';
    return filename;
  } catch {
    return '';
  }
};

export const canOptimizeImageUrl = (value?: string) => Boolean(getOptimizableFilename(value));

export const buildImageVariantUrl = (
  value: string | undefined,
  { width, height }: ImageVariantOptions
) => {
  const source = String(value ?? '').trim();
  const filename = getOptimizableFilename(source);
  if (!filename) return source;

  const normalizedWidth = normalizeDimension(width);
  const normalizedHeight = normalizeDimension(height);
  if (!normalizedWidth && !normalizedHeight) return source;

  const params = new URLSearchParams();
  if (normalizedWidth) params.set('width', String(normalizedWidth));
  if (normalizedHeight) params.set('height', String(normalizedHeight));
  return `/api/images/${encodeURIComponent(filename)}?${params.toString()}`;
};

export const buildImageVariantSrcSet = (
  value: string | undefined,
  candidates: ImageVariantCandidate[]
) => {
  if (!canOptimizeImageUrl(value)) return undefined;

  const entries = candidates
    .map(candidate => {
      const url = buildImageVariantUrl(value, candidate);
      return url ? `${url} ${candidate.descriptor}` : '';
    })
    .filter(Boolean);

  return entries.length > 0 ? entries.join(', ') : undefined;
};
