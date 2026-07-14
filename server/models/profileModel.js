import { readFile, mkdir, rename } from 'fs/promises';
import { profileFilePath, dataDir } from '../config/paths.js';
import { writeJsonAtomic } from '../utils/fsUtils.js';
import {
    normalizeProfile,
    defaultProfile
} from '../utils/normalizers/profileNormalizers.js';

export async function readProfile() {
    let raw = '';
    try {
        raw = await readFile(profileFilePath, 'utf8');
    } catch (error) {
        if (error && error.code === 'ENOENT') {
            return await writeProfile(defaultProfile);
        }
        throw error;
    }

    try {
        const parsed = JSON.parse(raw);
        return normalizeProfile(parsed);
    } catch (error) {
        const backupPath = `${profileFilePath}.corrupt-${Date.now()}`;
        await rename(profileFilePath, backupPath);
        console.error(`Failed to parse profile file. Corrupt data moved to ${backupPath}.`, error);
        return await writeProfile(defaultProfile);
    }
}

export async function writeProfile(profile) {
    const normalized = normalizeProfile(profile);
    await writeJsonAtomic(profileFilePath, normalized);
    return normalized;
}

export async function ensureProfileFile() {
    await mkdir(dataDir, { recursive: true });
    try {
        await import('fs/promises').then(fs => fs.access(profileFilePath));
        const existing = await readProfile();
        await writeProfile(existing);
    } catch {
        await writeProfile(defaultProfile);
    }
}
