import { writeFile, mkdir, readdir, readFile, lstat, unlink } from 'fs/promises';
import path from 'path';
import { randomUUID } from 'crypto';
import sharp from 'sharp';
import { postsFilePath, profileFilePath, revisionsDir, uploadDir } from '../config/paths.js';
import { parseDataUrl, allowedImageTypes } from '../utils/normalizers/uploadNormalizers.js';
import { runWithDataStoreLock } from '../utils/storeLock.js';

const MAX_UPLOAD_BYTES = 8 * 1024 * 1024;
const UPLOAD_URL_PATTERN = /\/uploads\/([^"')\s<>?#]+)/g;
export const UPLOAD_CLEANUP_GRACE_HOURS = 24;
const UPLOAD_CLEANUP_GRACE_MS = UPLOAD_CLEANUP_GRACE_HOURS * 60 * 60 * 1000;

const normalizeFilenames = (filenames) => Array.isArray(filenames)
    ? [...new Set(filenames.filter(filename => (
        typeof filename === 'string'
        && filename.length > 0
        && filename !== '.'
        && filename !== '..'
        && !filename.includes('\\')
        && !filename.includes('\0')
        && filename === path.basename(filename)
    )))]
    : [];

const invalidCleanupRequest = (message) => Object.assign(new Error(message), { status: 400 });

const validateProtectedFilenames = (filenames) => {
    if (!Array.isArray(filenames) || filenames.some(filename => typeof filename !== 'string')) {
        throw invalidCleanupRequest('보호할 이미지 목록이 올바르지 않습니다.');
    }
    return normalizeFilenames(filenames);
};

export async function processImageUpload(dataUrl) {
    const parsed = parseDataUrl(dataUrl);

    if (!parsed) {
        return { success: false, error: '이미지 데이터가 올바르지 않습니다.', code: 'invalid_data' };
    }

    const extension = allowedImageTypes.get(parsed.mime);
    if (!extension) {
        return { success: false, error: '지원하지 않는 이미지 형식입니다.', code: 'invalid_type' };
    }

    if (!parsed.buffer.length) {
        return { success: false, error: '빈 파일은 업로드할 수 없습니다.', code: 'empty_file' };
    }

    if (parsed.buffer.length > MAX_UPLOAD_BYTES) {
        return { success: false, error: '이미지 용량이 너무 큽니다.', code: 'too_large' };
    }

    try {
        await mkdir(uploadDir, { recursive: true });

        // Image Optimization
        const filename = `upload-${Date.now()}-${randomUUID()}.webp`;
        let sharpInstance = sharp(parsed.buffer, { animated: true }); // Enable animation support

        // Only resize if not animated (resizing animated GIFs can be expensive/tricky) or if explicitly handled
        // For simplicity, we'll skip resizing for animated images to preserve quality/speed, 
        // or we can resize but must ensure 'animated: true' is passed.
        // Let's try to resize but keep animation.

        const metadata = await sharpInstance.metadata();

        if (metadata.width > 1200) {
            sharpInstance = sharpInstance.resize({ width: 1200, withoutEnlargement: true });
        }

        const { data: optimizedBuffer, info } = await sharpInstance
            .webp({ quality: 80, animated: true }) // Ensure animated: true for WebP
            .toBuffer({ resolveWithObject: true });

        await writeFile(path.join(uploadDir, filename), optimizedBuffer);

        return {
            success: true,
            data: {
                url: `/uploads/${filename}`,
                filename,
                width: info.width,
                height: info.height
            }
        };
    } catch (error) {
        console.error('Image processing error:', error);
        return { success: false, error: '이미지 처리 중 오류가 발생했습니다.', code: 'processing_error' };
    }
}

const addUploadReferencesFromString = (value, references) => {
    if (typeof value !== 'string' || !value.includes('/uploads/')) return;

    for (const match of value.matchAll(UPLOAD_URL_PATTERN)) {
        let filename = match[1] || '';
        try {
            filename = decodeURIComponent(filename);
        } catch {
            // A malformed URL must not prevent scanning other valid references.
        }
        if (filename && filename === path.basename(filename)) {
            references.add(filename);
        }
    }
};

const addUploadReferences = (value, references) => {
    if (!value) return;

    if (typeof value === 'string') {
        addUploadReferencesFromString(value, references);
        return;
    }

    if (Array.isArray(value)) {
        value.forEach(item => addUploadReferences(item, references));
        return;
    }

    if (typeof value === 'object') {
        Object.values(value).forEach(item => addUploadReferences(item, references));
    }
};

const readRevisionSnapshots = async () => {
    try {
        const files = await readdir(revisionsDir);
        const snapshots = [];

        for (const file of files) {
            if (!file.endsWith('.json')) continue;
            const raw = await readFile(path.join(revisionsDir, file), 'utf8');
            const parsed = JSON.parse(raw);
            if (!Array.isArray(parsed)) throw new Error(`Invalid revision store: ${file}`);
            snapshots.push(parsed);
        }

        return snapshots;
    } catch (error) {
        // Only a missing directory is an empty revision store. A disappearing
        // or unreadable snapshot must stop cleanup, not hide its references.
        if (error.code === 'ENOENT' && error.path === revisionsDir) return [];
        throw error;
    }
};

async function collectReferencedUploadFilenames() {
    const references = new Set();
    const [postsRaw, profileRaw, revisions] = await Promise.all([
        readFile(postsFilePath, 'utf8'),
        readFile(profileFilePath, 'utf8'),
        readRevisionSnapshots()
    ]);
    // Cleanup must not use forgiving model readers: malformed or missing
    // metadata is not proof that an uploaded image is unused.
    const posts = JSON.parse(postsRaw);
    const profile = JSON.parse(profileRaw);
    if (!Array.isArray(posts) || !profile || typeof profile !== 'object' || Array.isArray(profile)) {
        throw new Error('Invalid upload reference store');
    }

    addUploadReferences(posts, references);
    addUploadReferences(profile, references);
    addUploadReferences(revisions, references);

    return references;
}

async function listUploadFiles() {
    await mkdir(uploadDir, { recursive: true });
    const entries = await readdir(uploadDir);
    const files = [];

    for (const entry of entries) {
        if (entry !== path.basename(entry)) continue;
        const filePath = path.join(uploadDir, entry);
        const fileStat = await lstat(filePath).catch(error => {
            if (error.code === 'ENOENT') return null;
            throw error;
        });
        if (!fileStat?.isFile()) continue;

        files.push({
            filename: entry,
            url: `/uploads/${entry}`,
            size: fileStat.size,
            modifiedAt: fileStat.mtime.toISOString()
        });
    }

    return files.sort((left, right) => left.filename.localeCompare(right.filename));
}

async function scanUnusedUploadsUnlocked(protectedFilenames) {
    const [files, references] = await Promise.all([
        listUploadFiles(),
        collectReferencedUploadFilenames()
    ]);

    protectedFilenames.forEach(filename => references.add(filename));
    const cutoff = Date.now() - UPLOAD_CLEANUP_GRACE_MS;
    const unreferenced = files.filter(file => !references.has(file.filename));
    const unused = unreferenced.filter(file => Date.parse(file.modifiedAt) <= cutoff);

    return {
        files,
        totalFiles: files.length,
        totalBytes: files.reduce((sum, file) => sum + file.size, 0),
        referencedFiles: files.filter(file => references.has(file.filename)).length,
        recentFiles: unreferenced.length - unused.length,
        gracePeriodHours: UPLOAD_CLEANUP_GRACE_HOURS,
        unused,
        unusedBytes: unused.reduce((sum, file) => sum + file.size, 0)
    };
}

export async function scanUnusedUploads(protectedFilenames = []) {
    const protectedNames = validateProtectedFilenames(protectedFilenames);
    return runWithDataStoreLock(() => scanUnusedUploadsUnlocked(protectedNames));
}

export async function deleteUnusedUploads(filenames, protectedFilenames = []) {
    const requestedNames = normalizeFilenames(filenames);
    if (!requestedNames.length) {
        throw invalidCleanupRequest('삭제할 이미지를 명시적으로 선택해 주세요.');
    }
    const protectedNames = validateProtectedFilenames(protectedFilenames);

    // Scan again at deletion time and hold the same lock used by post/profile
    // saves until unlink finishes, so a completed save cannot be overlooked.
    return runWithDataStoreLock(async () => {
        const scan = await scanUnusedUploadsUnlocked(protectedNames);
        const unusedByName = new Map(scan.unused.map(file => [file.filename, file]));
        const targets = requestedNames
            .map(filename => unusedByName.get(filename))
            .filter(Boolean);
        const deleted = [];

        for (const file of targets) {
            await unlink(path.join(uploadDir, file.filename));
            deleted.push(file);
        }

        return {
            deleted,
            deletedBytes: deleted.reduce((sum, file) => sum + file.size, 0),
            remainingUnused: scan.unused.filter(
                file => !deleted.some(deletedFile => deletedFile.filename === file.filename)
            )
        };
    });
}
