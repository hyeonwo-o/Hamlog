import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Resolves to server/ directory since we are in server/config/
const serverDir = path.resolve(__dirname, '..');
const resolveStoragePath = (environmentKey, fallbackDirectory) => {
    const configuredPath = process.env[environmentKey]?.trim();
    return configuredPath
        ? path.resolve(configuredPath)
        : path.join(serverDir, fallbackDirectory);
};

export const dataDir = resolveStoragePath('HAMLOG_DATA_DIR', 'data');
export const postsFilePath = path.join(dataDir, 'posts.json');
export const categoriesFilePath = path.join(dataDir, 'categories.json');
export const profileFilePath = path.join(dataDir, 'profile.json');
export const postViewsFilePath = path.join(dataDir, 'post-views.json');
export const postsDir = path.join(dataDir, 'posts');
export const revisionsDir = path.join(dataDir, 'revisions');
export const uploadDir = resolveStoragePath('HAMLOG_UPLOAD_DIR', 'uploads');
