import { writeFile, mkdir, readdir, readFile, stat, unlink } from 'fs/promises';
import path from 'path';
import { randomUUID } from 'crypto';
import sharp from 'sharp';
import { revisionsDir, uploadDir } from '../config/paths.js';
import { readPosts } from '../models/postModel.js';
import { readProfile } from '../models/profileModel.js';
import { parseDataUrl, allowedImageTypes } from '../utils/normalizers/uploadNormalizers.js';

const MAX_UPLOAD_BYTES = 8 * 1024 * 1024;
const UPLOAD_URL_PATTERN = /\/uploads\/([^"')\s<>?#]+)/g;

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

        const optimizedBuffer = await sharpInstance
            .webp({ quality: 80, animated: true }) // Ensure animated: true for WebP
            .toBuffer();

        await writeFile(path.join(uploadDir, filename), optimizedBuffer);

        return {
            success: true,
            data: {
                url: `/uploads/${filename}`,
                filename
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
        const filename = decodeURIComponent(match[1] || '').trim();
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
            try {
                const raw = await readFile(path.join(revisionsDir, file), 'utf8');
                snapshots.push(JSON.parse(raw));
            } catch (error) {
                console.error(`Failed to scan upload references from revision ${file}:`, error);
            }
        }

        return snapshots;
    } catch (error) {
        if (error.code === 'ENOENT') return [];
        throw error;
    }
};

async function collectReferencedUploadFilenames() {
    const references = new Set();
    const [posts, profile, revisions] = await Promise.all([
        readPosts(),
        readProfile(),
        readRevisionSnapshots()
    ]);

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
        const fileStat = await stat(filePath).catch(() => null);
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

export async function scanUnusedUploads() {
    const [files, references] = await Promise.all([
        listUploadFiles(),
        collectReferencedUploadFilenames()
    ]);

    const unused = files.filter(file => !references.has(file.filename));

    return {
        files,
        totalFiles: files.length,
        totalBytes: files.reduce((sum, file) => sum + file.size, 0),
        referencedFiles: files.filter(file => references.has(file.filename)).length,
        unused,
        unusedBytes: unused.reduce((sum, file) => sum + file.size, 0)
    };
}

export async function deleteUnusedUploads(filenames = []) {
    const scan = await scanUnusedUploads();
    const unusedByName = new Map(scan.unused.map(file => [file.filename, file]));
    const requestedNames = Array.isArray(filenames)
        ? filenames.map(filename => String(filename ?? '').trim()).filter(Boolean)
        : [];
    const targets = requestedNames.length > 0
        ? requestedNames
            .filter(filename => filename === path.basename(filename))
            .map(filename => unusedByName.get(filename))
            .filter(Boolean)
        : scan.unused;
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
}
