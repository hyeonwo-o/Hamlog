import test, { after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { access, mkdir, mkdtemp, readFile, rm, symlink, utimes, writeFile } from 'node:fs/promises';
import request from 'supertest';
import {
    collectCleanupProtectedFilenames,
    collectUploadFilenames
} from '../../src/utils/uploadReferences.ts';

// Never share stores with development or other tests, including parallel runs.
const fixtureRoot = await mkdtemp(path.join(tmpdir(), 'hamlog-upload-cleanup-'));
process.env.HAMLOG_DATA_DIR = path.join(fixtureRoot, 'data');
process.env.HAMLOG_UPLOAD_DIR = path.join(fixtureRoot, 'uploads');
const { default: app } = await import('../app.js');
const { postsFilePath, profileFilePath, revisionsDir, uploadDir, dataDir } = await import('../config/paths.js');
const { deleteUnusedUploads, scanUnusedUploads, UPLOAD_CLEANUP_GRACE_HOURS } = await import('../services/uploadService.js');
const { createPostService } = await import('../services/postService.js');
const { runWithDataStoreLock } = await import('../utils/storeLock.js');

const writeJson = (file, value) => writeFile(file, JSON.stringify(value));
const oldUpload = async filename => {
    const file = path.join(uploadDir, filename);
    await writeFile(file, `image ${filename}`);
    const old = new Date(Date.now() - (UPLOAD_CLEANUP_GRACE_HOURS + 1) * 3600000);
    await utimes(file, old, old);
};
const trusted = builder => builder.set('Origin', 'http://hamlog.test').set('Host', 'hamlog.test');
const login = async () => {
    const response = await request(app).post('/api/auth/login').send({
        password: process.env.ADMIN_PASSWORD ?? 'test-password'
    });
    assert.equal(response.status, 200);
    return response.headers['set-cookie'];
};
const storageOf = records => ({
    length: Object.keys(records).length,
    key: index => Object.keys(records)[index] ?? null,
    getItem: key => records[key] ?? null
});

beforeEach(async () => {
    await rm(dataDir, { recursive: true, force: true });
    await rm(uploadDir, { recursive: true, force: true });
    await mkdir(revisionsDir, { recursive: true });
    await mkdir(uploadDir, { recursive: true });
    await writeJson(postsFilePath, []);
    await writeJson(profileFilePath, {});
});
after(() => rm(fixtureRoot, { recursive: true, force: true }));

test('cleanup protects saved posts, revisions, profile, current drafts and recent uploads', async () => {
    const protectedNames = ['body.webp', 'cover.webp', 'seo.webp', 'revision.webp', 'profile.webp', 'draft.webp'];
    for (const filename of [...protectedNames, 'unused.webp']) await oldUpload(filename);
    await writeFile(path.join(uploadDir, 'recent.webp'), 'recent image');
    await writeJson(postsFilePath, [{
        status: 'draft',
        contentHtml: '<img src="/uploads/body.webp">',
        cover: '/uploads/cover.webp',
        seo: { ogImage: 'https://blog.example/uploads/seo.webp' }
    }]);
    await writeJson(profileFilePath, { profileImage: '/uploads/profile.webp' });
    await writeJson(path.join(revisionsDir, 'post.json'), [{
        snapshot: { contentJson: { attrs: { src: '/uploads/revision.webp' } } }
    }]);

    const scan = await scanUnusedUploads(['draft.webp']);
    assert.deepEqual(scan.unused.map(file => file.filename), ['unused.webp']);
    assert.equal(scan.referencedFiles, protectedNames.length);
    assert.equal(scan.recentFiles, 1);
    assert.equal(scan.gracePeriodHours, 24);
    assert.equal(scan.totalFiles, 8);

    const result = await deleteUnusedUploads([...protectedNames, 'recent.webp', 'unused.webp', 'unused.webp'], ['draft.webp']);
    assert.deepEqual(result.deleted.map(file => file.filename), ['unused.webp']);
    for (const filename of [...protectedNames, 'recent.webp']) await access(path.join(uploadDir, filename));
});

test('cleanup API requires explicit selection and cannot bypass the server grace period', async () => {
    await oldUpload('old.webp');
    await writeFile(path.join(uploadDir, 'recent.webp'), 'recent image');
    const cookies = await login();
    for (const body of [{}, { filenames: [] }, { filenames: '../old.webp' }, { filenames: ['../old.webp'] }]) {
        const response = await trusted(request(app).delete('/api/uploads/unused').set('Cookie', cookies)).send(body);
        assert.equal(response.status, 400);
        await access(path.join(uploadDir, 'old.webp'));
    }
    const response = await trusted(request(app).delete('/api/uploads/unused').set('Cookie', cookies)).send({
        filenames: ['recent.webp'], gracePeriodHours: 0, force: true
    });
    assert.equal(response.status, 200);
    assert.deepEqual(response.body.deleted, []);
    await access(path.join(uploadDir, 'recent.webp'));
});

test('scan API accepts draft protection only after authentication and a trusted origin', async () => {
    await oldUpload('draft.webp');
    await oldUpload('unused.webp');
    const cookies = await login();
    const anonymous = await trusted(request(app).post('/api/uploads/unused/scan')).send({ protectedFilenames: [] });
    assert.equal(anonymous.status, 401);
    const foreign = await request(app).post('/api/uploads/unused/scan').set('Cookie', cookies)
        .set('Origin', 'http://untrusted.example').set('Host', 'hamlog.test').send({ protectedFilenames: [] });
    assert.equal(foreign.status, 403);
    const protectedScan = await trusted(request(app).post('/api/uploads/unused/scan').set('Cookie', cookies))
        .send({ protectedFilenames: ['draft.webp'] });
    assert.equal(protectedScan.status, 200);
    assert.deepEqual(protectedScan.body.unused.map(file => file.filename), ['unused.webp']);
    const invalidScan = await trusted(request(app).post('/api/uploads/unused/scan').set('Cookie', cookies))
        .send({ protectedFilenames: 'draft.webp' });
    assert.equal(invalidScan.status, 400);
    const invalidDelete = await trusted(request(app).delete('/api/uploads/unused').set('Cookie', cookies))
        .send({ filenames: ['unused.webp'], protectedFilenames: null });
    assert.equal(invalidDelete.status, 400);
    await access(path.join(uploadDir, 'unused.webp'));
});

test('deletion rescans references written since the earlier scan', async () => {
    await oldUpload('later.webp');
    assert.equal((await scanUnusedUploads()).unused.length, 1);
    await writeJson(postsFilePath, [{ cover: '/uploads/later.webp' }]);
    assert.deepEqual((await deleteUnusedUploads(['later.webp'])).deleted, []);
    await access(path.join(uploadDir, 'later.webp'));
});

test('cleanup waits for an in-flight post save using the shared store lock', async () => {
    await oldUpload('saving.webp');
    let release;
    const gate = new Promise(resolve => { release = resolve; });
    const held = runWithDataStoreLock(() => gate);
    const save = createPostService({
        title: 'Image protected by save', slug: 'image-protected-by-save', summary: 'image reference',
        contentHtml: '<p>body</p>', cover: '/uploads/saving.webp', category: 'Testing',
        status: 'draft', publishedAt: '2026-09-12', tags: [], sections: []
    });
    let cleanupFinished = false;
    const cleanup = deleteUnusedUploads(['saving.webp']).then(result => {
        cleanupFinished = true;
        return result;
    });
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(cleanupFinished, false);
    release();
    await held;
    assert.equal((await save).success, true);
    assert.deepEqual((await cleanup).deleted, []);
    await access(path.join(uploadDir, 'saving.webp'));
});

test('profile updates participate in the cleanup store lock', async () => {
    const cookies = await login();
    let release;
    const gate = new Promise(resolve => { release = resolve; });
    const held = runWithDataStoreLock(() => gate);
    let finished = false;
    const responsePromise = trusted(request(app).put('/api/profile').set('Cookie', cookies))
        .send({ profileImage: '/uploads/profile-new.webp' }).then(response => {
            finished = true;
            return response;
        });
    try {
        await new Promise(resolve => setTimeout(resolve, 25));
        assert.equal(finished, false);
        assert.deepEqual(JSON.parse(await readFile(profileFilePath, 'utf8')), {});
    } finally {
        release();
        await held;
    }
    assert.equal((await responsePromise).status, 200);
    assert.equal(JSON.parse(await readFile(profileFilePath, 'utf8')).profileImage, '/uploads/profile-new.webp');
});

test('unreadable reference stores stop deletion without silently repairing or discarding data', async () => {
    await oldUpload('keep.webp');
    const corruptStores = [
        [postsFilePath, '{}', '[]'],
        [profileFilePath, '{invalid json', '{}'],
        [path.join(revisionsDir, 'corrupt.json'), '{invalid json', '[]'],
        [path.join(revisionsDir, 'corrupt.json'), '{}', '[]']
    ];
    for (const [file, malformed, restored] of corruptStores) {
        await writeFile(file, malformed);
        await assert.rejects(() => scanUnusedUploads());
        await assert.rejects(() => deleteUnusedUploads(['keep.webp']));
        assert.equal(await readFile(file, 'utf8'), malformed);
        await access(path.join(uploadDir, 'keep.webp'));
        await writeFile(file, restored);
    }
    await rm(profileFilePath);
    await assert.rejects(() => deleteUnusedUploads(['keep.webp']));
    await access(path.join(uploadDir, 'keep.webp'));
});

test('cleanup skips symlinks and accepts an empty, absent revision directory', async () => {
    await oldUpload('unused.webp');
    await writeFile(path.join(fixtureRoot, 'outside.webp'), 'outside image');
    await symlink(path.join(fixtureRoot, 'outside.webp'), path.join(uploadDir, 'linked.webp'));
    await rm(revisionsDir, { recursive: true });
    const scan = await scanUnusedUploads();
    assert.deepEqual(scan.files.map(file => file.filename), ['unused.webp']);
    const result = await deleteUnusedUploads(['../outside.webp', 'linked.webp', 'unused.webp']);
    assert.deepEqual(result.deleted.map(file => file.filename), ['unused.webp']);
    await access(path.join(fixtureRoot, 'outside.webp'));
});

test('draft reference collection covers structured content, encoded URLs and every browser recovery copy', () => {
    const draft = {
        contentJson: { content: [{ attrs: { src: '/uploads/body.webp?size=100' } }] },
        cover: 'https://blog.example/uploads/cover%20image.webp',
        seoOgImage: '/uploads/seo.webp',
        contentHtml: '<img src="/uploads/body.webp"><img src="/uploads/bad%ZZ.webp">'
    };
    const storage = storageOf({
        hamlog_draft_new: JSON.stringify({ draft: { cover: '/uploads/new.webp' } }),
        hamlog_draft_post123: JSON.stringify({ draft: { contentHtml: '<img src="/uploads/other.webp">' } }),
        unrelated: 'not valid JSON'
    });
    assert.deepEqual(collectCleanupProtectedFilenames(draft, storage).sort(), [
        'bad%ZZ.webp', 'body.webp', 'cover image.webp', 'new.webp', 'other.webp', 'seo.webp'
    ]);
    assert.deepEqual(collectUploadFilenames('/uploads/.. /uploads/../private /uploads/a%2Fb.webp /uploads/a%5Cb.webp'), []);
});

test('draft protection fails closed when storage or a recovery copy cannot be read', () => {
    const blockedStorage = {
        get length() { throw new Error('SecurityError'); },
        key: () => null,
        getItem: () => null
    };
    assert.throws(() => collectCleanupProtectedFilenames({}, blockedStorage), /정리를 중단/);
    assert.throws(() => collectCleanupProtectedFilenames({}, storageOf({ hamlog_draft_new: '{broken' })), /정리를 중단/);
});
