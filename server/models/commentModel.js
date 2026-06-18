import { readFile, access, mkdir } from 'fs/promises';
import { writeJsonAtomic } from '../utils/fsUtils.js';
import { randomUUID } from 'crypto';
import { dataDir } from '../config/paths.js';
import path from 'path';
import bcrypt from 'bcryptjs';
import { runWithDataStoreLock } from '../utils/storeLock.js';

const commentsFilePath = path.join(dataDir, 'comments.json');
const BCRYPT_SALT_ROUNDS = 10;


export async function ensureCommentsFile() {
    await mkdir(dataDir, { recursive: true });
    try {
        await access(commentsFilePath);
    } catch {
        await writeComments([]);
    }
}

export async function readComments() {
    try {
        const raw = await readFile(commentsFilePath, 'utf8');
        return JSON.parse(raw);
    } catch (error) {
        if (error.code === 'ENOENT') {
            await ensureCommentsFile();
            return [];
        }
        throw error;
    }
}

export async function writeComments(comments) {
    await writeJsonAtomic(commentsFilePath, comments);
}

export async function getCommentsByPostId(postId) {
    const all = await readComments();
    return all
        .filter(c => c.postId === postId)
        .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
}

export async function createComment(data) {
    return runWithDataStoreLock(async () => {
        const all = await readComments();
        const passwordHash = await bcrypt.hash(String(data.password), BCRYPT_SALT_ROUNDS);
        const newComment = {
            id: randomUUID(),
            postId: data.postId,
            author: data.author || 'Anonymous',
            password: passwordHash,
            content: data.content,
            createdAt: new Date().toISOString()
        };
        await writeComments([...all, newComment]);
        return newComment;
    });
}

export async function deleteComment(id, password) {
    return runWithDataStoreLock(async () => {
        const all = await readComments();
        const target = all.find(c => c.id === id);

        if (!target) return { success: false, reason: 'not_found' };
        const inputPassword = String(password ?? '');
        const storedPassword = String(target.password ?? '');

        let isPasswordMatched = false;
        if (
            storedPassword.startsWith('$2a$')
            || storedPassword.startsWith('$2b$')
            || storedPassword.startsWith('$2y$')
        ) {
            isPasswordMatched = await bcrypt.compare(inputPassword, storedPassword);
        } else {
            // Legacy compatibility for pre-hash comments.
            isPasswordMatched = storedPassword === inputPassword;
        }

        if (!isPasswordMatched) return { success: false, reason: 'wrong_password' };

        const next = all.filter(c => c.id !== id);
        await writeComments(next);
        return { success: true };
    });
}
