import { readFile, mkdir } from 'fs/promises';
import { categoriesFilePath, dataDir } from '../config/paths.js';
import { writeJsonAtomic } from '../utils/fsUtils.js';
import {
    normalizeCategory,
    normalizeCategoryList
} from '../utils/normalizers/categoryNormalizers.js';
import { readPosts } from './postModel.js';

async function deriveCategoriesFromPosts() {
    const posts = await readPosts();
    const names = [];
    const seen = new Set();

    posts.forEach((post) => {
        const category = normalizeCategory(post.category);
        if (seen.has(category)) return;
        seen.add(category);
        names.push(category);
    });

    return names;
}

export async function readCategories() {
    try {
        const raw = await readFile(categoriesFilePath, 'utf8');
        const parsed = JSON.parse(raw);
        return normalizeCategoryList(parsed);
    } catch (error) {
        if (error?.code !== 'ENOENT' && !(error instanceof SyntaxError)) {
            throw error;
        }

        const derived = await deriveCategoriesFromPosts();
        return writeCategories(derived);
    }
}

export async function writeCategories(categories) {
    const normalized = normalizeCategoryList(categories);
    await writeJsonAtomic(categoriesFilePath, normalized);
    return normalized;
}

export async function ensureCategoriesFile() {
    await mkdir(dataDir, { recursive: true });
    try {
        const existing = await readCategories();
        await writeCategories(existing);
    } catch {
        const derived = await deriveCategoriesFromPosts();
        await writeCategories(derived);
    }
}
