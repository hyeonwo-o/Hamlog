import { mkdir } from 'fs/promises';
import { uploadDir } from '../config/paths.js';
import { ensurePostsFile } from '../models/postModel.js';
import { ensureCategoriesFile } from '../models/categoryModel.js';
import { ensureProfileFile } from '../models/profileModel.js';
import { ensureCommentsFile } from '../models/commentModel.js';
import { ensureRevisionsStorage } from '../models/revisionModel.js';
import { readPosts } from '../models/postModel.js';
import { ensurePostViewsFile } from '../models/postViewModel.js';

export async function initializeDatabase() {
    try {
        await ensurePostsFile();
        await ensurePostViewsFile(await readPosts());
        await ensureCategoriesFile();
        await ensureProfileFile();
        await ensureCommentsFile();
        await ensureRevisionsStorage();
        await mkdir(uploadDir, { recursive: true });
        console.log('Database and directories initialized successfully');
    } catch (error) {
        console.error('Failed to initialize database:', error);
        throw error;
    }
}
