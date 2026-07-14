import { mkdir, readFile } from 'fs/promises';
import { dataDir, postViewsFilePath } from '../config/paths.js';
import { writeJsonAtomic } from '../utils/fsUtils.js';
import { normalizePostViews } from '../utils/normalizers/postNormalizers.js';

const normalizeViewMap = (value) => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return {};

    return Object.fromEntries(
        Object.entries(value)
            .map(([postId, views]) => [String(postId).trim(), normalizePostViews(views)])
            .filter(([postId]) => Boolean(postId))
    );
};

export async function readPostViews() {
    try {
        const raw = await readFile(postViewsFilePath, 'utf8');
        return normalizeViewMap(JSON.parse(raw));
    } catch (error) {
        if (error?.code === 'ENOENT') return {};
        throw error;
    }
}

export async function writePostViews(views) {
    await mkdir(dataDir, { recursive: true });
    const normalized = normalizeViewMap(views);
    await writeJsonAtomic(postViewsFilePath, normalized);
    return normalized;
}

export async function ensurePostViewsFile(posts = []) {
    const current = await readPostViews();
    const next = { ...current };

    for (const post of posts) {
        const postId = String(post?.id ?? '').trim();
        if (!postId) continue;
        next[postId] = Math.max(
            normalizePostViews(current[postId]),
            normalizePostViews(post.views)
        );
    }

    await writePostViews(next);
}

export function applyPostViews(posts, views) {
    const normalizedViews = normalizeViewMap(views);
    return posts.map(post => ({
        ...post,
        views: Object.hasOwn(normalizedViews, post.id)
            ? normalizedViews[post.id]
            : normalizePostViews(post.views)
    }));
}

export async function incrementPostView(postId, fallbackViews = 0) {
    const views = await readPostViews();
    const currentViews = Object.hasOwn(views, postId)
        ? normalizePostViews(views[postId])
        : normalizePostViews(fallbackViews);
    const nextViews = currentViews + 1;
    await writePostViews({ ...views, [postId]: nextViews });
    return nextViews;
}

export async function deletePostView(postId) {
    const views = await readPostViews();
    if (!Object.hasOwn(views, postId)) return;
    delete views[postId];
    await writePostViews(views);
}
