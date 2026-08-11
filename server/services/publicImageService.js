import { realpath, stat } from 'fs/promises';
import path from 'path';
import sharp from 'sharp';
import { distDir, publicDir, uploadDir } from '../config/paths.js';

export const IMAGE_DIMENSION_MIN = 48;
export const IMAGE_DIMENSION_MAX = 1920;
export const DEFAULT_IMAGE_WIDTH = 800;
const ALLOWED_IMAGE_DIMENSIONS = [
  48, 96, 160, 171, 192, 256, 320, 341, 384, 480, 576, 640, 720, 800, 960, 1200, 1920
];
const MAX_CACHE_ENTRIES = 128;
const MAX_CACHE_BYTES = 64 * 1024 * 1024;
const imageCache = new Map();
let imageCacheBytes = 0;
const STATIC_IMAGE_ALLOWLIST = new Map([
  ['avatar.jpg', [path.join(distDir, 'avatar.jpg'), path.join(publicDir, 'avatar.jpg')]]
]);
const ALLOWED_IMAGE_EXTENSION = /\.(?:avif|gif|jpe?g|png|webp)$/i;
const SAFE_FILENAME = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;

const snapDimension = (value) => ALLOWED_IMAGE_DIMENSIONS.reduce((closest, candidate) => (
  Math.abs(candidate - value) < Math.abs(closest - value) ? candidate : closest
));

const readCachedImage = (key) => {
  const cached = imageCache.get(key);
  if (!cached) return null;
  imageCache.delete(key);
  imageCache.set(key, cached);
  return cached;
};

const cacheImage = (key, value) => {
  if (value.data.length > MAX_CACHE_BYTES) return;

  const existing = imageCache.get(key);
  if (existing) {
    imageCacheBytes -= existing.data.length;
    imageCache.delete(key);
  }
  imageCache.set(key, value);
  imageCacheBytes += value.data.length;

  while (imageCache.size > MAX_CACHE_ENTRIES || imageCacheBytes > MAX_CACHE_BYTES) {
    const oldestKey = imageCache.keys().next().value;
    if (oldestKey === undefined) break;
    const oldest = imageCache.get(oldestKey);
    imageCache.delete(oldestKey);
    imageCacheBytes -= oldest.data.length;
  }
};

const parseDimension = (value) => {
  if (value === undefined || value === null || value === '') {
    return { value: null };
  }

  const normalized = String(value).trim();
  if (!/^\d+$/.test(normalized)) {
    return { error: '이미지 크기는 양의 정수여야 합니다.' };
  }

  const parsed = Number.parseInt(normalized, 10);
  if (!Number.isSafeInteger(parsed) || parsed <= 0) {
    return { error: '이미지 크기는 양의 정수여야 합니다.' };
  }

  return {
    value: snapDimension(Math.min(IMAGE_DIMENSION_MAX, Math.max(IMAGE_DIMENSION_MIN, parsed)))
  };
};

export const normalizeImageDimensions = (widthValue, heightValue) => {
  const width = parseDimension(widthValue);
  const height = parseDimension(heightValue);
  if (width.error || height.error) {
    return { error: width.error || height.error };
  }

  if (width.value === null && height.value === null) {
    return { width: DEFAULT_IMAGE_WIDTH, height: null };
  }

  return { width: width.value, height: height.value };
};

const isPathInside = (rootPath, candidatePath) => (
  candidatePath === rootPath || candidatePath.startsWith(`${rootPath}${path.sep}`)
);

const resolveImageSource = async (filename) => {
  const staticPaths = STATIC_IMAGE_ALLOWLIST.get(filename);
  if (staticPaths) {
    for (const staticPath of staticPaths) {
      try {
        const fileStat = await stat(staticPath);
        if (fileStat.isFile()) return { sourcePath: staticPath, fileStat };
      } catch (error) {
        if (error?.code !== 'ENOENT') throw error;
      }
    }
    return null;
  }

  if (
    !SAFE_FILENAME.test(filename)
    || filename !== path.basename(filename)
    || !ALLOWED_IMAGE_EXTENSION.test(filename)
  ) {
    return null;
  }

  const [realUploadDir, realSourcePath] = await Promise.all([
    realpath(uploadDir),
    realpath(path.join(uploadDir, filename))
  ]);
  if (!isPathInside(realUploadDir, realSourcePath)) return null;

  const fileStat = await stat(realSourcePath);
  return fileStat.isFile() ? { sourcePath: realSourcePath, fileStat } : null;
};

export const renderPublicImage = async ({ filename, width, height }) => {
  const normalizedFilename = String(filename ?? '').trim();
  const dimensions = normalizeImageDimensions(width, height);
  if (dimensions.error) {
    return { success: false, status: 400, error: dimensions.error };
  }

  if (!normalizedFilename || normalizedFilename !== path.basename(normalizedFilename)) {
    return { success: false, status: 400, error: '이미지 파일명이 올바르지 않습니다.' };
  }

  let source;
  try {
    source = await resolveImageSource(normalizedFilename);
  } catch (error) {
    if (error?.code === 'ENOENT') {
      return { success: false, status: 404, error: '이미지를 찾을 수 없습니다.' };
    }
    throw error;
  }

  if (!source) {
    const invalidFilename = !SAFE_FILENAME.test(normalizedFilename)
      || !ALLOWED_IMAGE_EXTENSION.test(normalizedFilename);
    return {
      success: false,
      status: invalidFilename ? 400 : 404,
      error: invalidFilename ? '이미지 파일명이 올바르지 않습니다.' : '이미지를 찾을 수 없습니다.'
    };
  }

  try {
    const cacheKey = [
      source.sourcePath,
      source.fileStat.size,
      source.fileStat.mtimeMs,
      dimensions.width ?? 'auto',
      dimensions.height ?? 'auto'
    ].join(':');
    const cached = readCachedImage(cacheKey);
    if (cached) return { success: true, ...cached };

    const image = sharp(source.sourcePath, {
      animated: true,
      failOn: 'error',
      limitInputPixels: 40_000_000
    }).rotate();
    const resizeOptions = {
      width: dimensions.width ?? undefined,
      height: dimensions.height ?? undefined,
      fit: dimensions.width && dimensions.height ? 'cover' : 'inside',
      position: 'centre',
      withoutEnlargement: true
    };
    const { data, info } = await image
      .resize(resizeOptions)
      .webp({ quality: 78, effort: 4, animated: true })
      .toBuffer({ resolveWithObject: true });

    const result = {
      data,
      width: info.width,
      height: info.height
    };
    cacheImage(cacheKey, result);

    return { success: true, ...result };
  } catch (error) {
    if (error?.code === 'ENOENT') {
      return { success: false, status: 404, error: '이미지를 찾을 수 없습니다.' };
    }
    return { success: false, status: 400, error: '이미지를 변환할 수 없습니다.' };
  }
};
