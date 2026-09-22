import { createHash } from 'node:crypto';
import { mkdir, open, readFile, readdir, unlink } from 'node:fs/promises';
import path from 'node:path';
import { dataDir } from '../config/paths.js';
import { writeJsonAtomic } from '../utils/fsUtils.js';
import { nextPostTimestamp } from '../utils/postVersion.js';

const intentsDir = path.join(dataDir, 'post-deletions');
const intentFileName = (id) => `${createHash('sha256').update(id).digest('hex')}.json`;

// A full snapshot keeps the trash entry and its slug reservation recoverable even
// if posts.json was updated before individual-file cleanup failed.
export async function readPostDeletionIntents() {
    let files;
    try {
        files = await readdir(intentsDir);
    } catch (error) {
        if (error.code === 'ENOENT') return [];
        throw error;
    }
    const intents = [];
    for (const file of files.filter(file => file.endsWith('.json'))) {
        let post;
        try {
            post = JSON.parse(await readFile(path.join(intentsDir, file), 'utf8'));
        } catch (error) {
            // A concurrent successful purge may have just removed this intent.
            if (error.code === 'ENOENT') continue;
            throw error;
        }
        if (!post || typeof post.id !== 'string' || !post.id
            || file !== intentFileName(post.id)
            || typeof post.slug !== 'string' || !post.slug
            || typeof post.title !== 'string'
            // Preserve the exact confirmation token, including legacy malformed
            // string tombstones; those must stay private but still be purgeable.
            || typeof post.deletedAt !== 'string'
            || !Number.isFinite(Date.parse(post.purgeRequestedAt))) {
            throw new Error(`Invalid post deletion intent: ${file}`);
        }
        intents.push({ ...post, status: 'draft' });
    }
    return intents;
}

export async function beginPostDeletion(post) {
    const existing = (await readPostDeletionIntents()).find(intent => intent.id === post.id);
    if (existing) return existing;
    const requestedAt = nextPostTimestamp(post);
    const pending = { ...post, status: 'draft', purgeRequestedAt: requestedAt, updatedAt: requestedAt };
    await mkdir(intentsDir, { recursive: true });
    const intentPath = path.join(intentsDir, intentFileName(post.id));
    await writeJsonAtomic(intentPath, pending);
    // Persist the intent before the first irreversible auxiliary-store cleanup.
    for (const target of [intentPath, intentsDir]) {
        const handle = await open(target, 'r');
        try {
            await handle.sync();
        } finally {
            await handle.close();
        }
    }
    return pending;
}

export async function finishPostDeletion(id) {
    try {
        await unlink(path.join(intentsDir, intentFileName(id)));
    } catch (error) {
        if (error.code !== 'ENOENT') throw error;
    }
}
