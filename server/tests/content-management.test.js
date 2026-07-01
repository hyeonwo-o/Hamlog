import test, { after, before, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { access, cp, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import request from 'supertest';

import app from '../app.js';
import {
    categoriesFilePath,
    dataDir,
    postsDir,
    postsFilePath,
    profileFilePath,
    uploadDir
} from '../config/paths.js';
import { readCategories, writeCategories } from '../models/categoryModel.js';
import { readComments, writeComments } from '../models/commentModel.js';
import { ensurePostsFile, readPosts, writePosts } from '../models/postModel.js';
import { readProfile, writeProfile } from '../models/profileModel.js';
import { readPostRevisions } from '../models/revisionModel.js';
import { defaultProfile } from '../utils/normalizers/profileNormalizers.js';

const adminPassword = process.env.ADMIN_PASSWORD ?? 'test-password';
const TRUSTED_ORIGIN = 'https://tech.hamwoo.co.kr';
const tinyPngDataUrl =
    'data:image/png;base64,'
    + 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO7Z0mQAAAAASUVORK5CYII=';
const sampleContentJson = {
    type: 'doc',
    content: [
        { type: 'heading', attrs: { level: 1 }, content: [{ type: 'text', text: 'Heading' }] },
        { type: 'paragraph', content: [{ type: 'text', text: 'Body copy' }] }
    ]
};
const parsedHtmlContentJson = {
    type: 'doc',
    content: [
        {
            type: 'heading',
            attrs: { level: 1, textAlign: null },
            content: [{ type: 'text', text: 'Heading' }]
        },
        {
            type: 'paragraph',
            attrs: { textAlign: null },
            content: [{ type: 'text', text: 'Body copy' }]
        }
    ]
};

let backupRoot = '';

const copyIfExists = async (sourcePath, destinationPath) => {
    try {
        await cp(sourcePath, destinationPath, { recursive: true, force: true });
    } catch (error) {
        if (error && error.code !== 'ENOENT') {
            throw error;
        }
    }
};

const clearDirectoryContents = async (directoryPath) => {
    await mkdir(directoryPath, { recursive: true });
    const entries = await import('fs/promises').then(fs => fs.readdir(directoryPath));
    await Promise.all(
        entries.map(entry => rm(path.join(directoryPath, entry), { recursive: true, force: true }))
    );
};

const resetTestState = async () => {
    await clearDirectoryContents(dataDir);
    await clearDirectoryContents(uploadDir);

    await writePosts([]);
    await writeCategories([]);
    await writeProfile(defaultProfile);
    await writeComments([]);
};

const loginAsAdmin = async () => {
    const response = await request(app)
        .post('/api/auth/login')
        .send({ password: adminPassword });

    assert.equal(response.status, 200);
    assert.ok(Array.isArray(response.headers['set-cookie']));

    return response.headers['set-cookie'];
};

const withTrustedOrigin = (requestBuilder, origin = TRUSTED_ORIGIN) => {
    const parsed = new URL(origin);
    return requestBuilder
        .set('Origin', origin)
        .set('X-Forwarded-Host', parsed.host)
        .set('X-Forwarded-Proto', parsed.protocol.replace(':', ''));
};

before(async () => {
    backupRoot = await mkdtemp(path.join(tmpdir(), 'hamlog-tests-'));
    await copyIfExists(dataDir, path.join(backupRoot, 'data'));
    await copyIfExists(uploadDir, path.join(backupRoot, 'uploads'));
    await resetTestState();
});

beforeEach(async () => {
    await resetTestState();
});

after(async () => {
    await clearDirectoryContents(dataDir);
    await clearDirectoryContents(uploadDir);

    await copyIfExists(path.join(backupRoot, 'data'), dataDir);
    await copyIfExists(path.join(backupRoot, 'uploads'), uploadDir);

    if (backupRoot) {
        await rm(backupRoot, { recursive: true, force: true });
    }
});

test('authenticated content routes persist posts and categories', async () => {
    const unauthenticatedCreate = await request(app)
        .post('/api/posts')
        .send({
            slug: 'unauthorized-post',
            title: 'Unauthorized Post',
            summary: 'summary',
            category: 'DevOps',
            contentHtml: '<p>blocked</p>',
            publishedAt: '2026-03-06',
            tags: [],
            status: 'published',
            sections: []
        });

    assert.equal(unauthenticatedCreate.status, 401);

    const cookies = await loginAsAdmin();

    const createCategoryResponse = await withTrustedOrigin(request(app)
        .post('/api/categories')
        .set('Cookie', cookies))
        .send({ name: 'DevOps' });

    assert.equal(createCategoryResponse.status, 201);

    const createdCategory = createCategoryResponse.body.categories.find(
        category => category.name === 'DevOps'
    );
    assert.ok(createdCategory);

    const createPostPayload = {
        slug: 'ci-hardening',
        title: 'CI Hardening',
        summary: 'pipeline hardening summary',
        category: 'DevOps',
        contentJson: sampleContentJson,
        contentHtml: '<p>stale html should not be stored</p>',
        publishedAt: '2026-03-06',
        tags: ['ci', 'deploy'],
        status: 'published',
        sections: []
    };

    const createPostResponse = await withTrustedOrigin(request(app)
        .post('/api/posts')
        .set('Cookie', cookies))
        .send(createPostPayload);

    assert.equal(createPostResponse.status, 201);
    assert.equal(createPostResponse.body.slug, createPostPayload.slug);
    assert.deepEqual(createPostResponse.body.contentJson, sampleContentJson);
    assert.equal(createPostResponse.body.contentHtml, '<h1>Heading</h1><p>Body copy</p>');

    const updateCategoryResponse = await withTrustedOrigin(request(app)
        .patch(`/api/categories/${encodeURIComponent(createdCategory.id)}`)
        .set('Cookie', cookies))
        .send({ name: 'Platform' });

    assert.equal(updateCategoryResponse.status, 200);

    const postsAfterCategoryRename = await readPosts();
    assert.equal(postsAfterCategoryRename.length, 1);
    assert.equal(postsAfterCategoryRename[0].category, 'Platform');
    assert.deepEqual(postsAfterCategoryRename[0].contentJson, sampleContentJson);
    assert.equal(postsAfterCategoryRename[0].contentHtml, '<h1>Heading</h1><p>Body copy</p>');

    const updatePostResponse = await withTrustedOrigin(request(app)
        .put(`/api/posts/${createPostResponse.body.id}`)
        .set('Cookie', cookies))
        .send({
            ...createPostPayload,
            slug: 'ci-hardening-updated',
            title: 'CI Hardening Updated',
            category: 'Platform'
        });

    assert.equal(updatePostResponse.status, 200);
    assert.equal(updatePostResponse.body.slug, 'ci-hardening-updated');

    const revisionsAfterUpdate = await readPostRevisions(createPostResponse.body.id);
    assert.ok(revisionsAfterUpdate.length >= 2);
    assert.equal(revisionsAfterUpdate[0].event, 'updated');

    const deleteCategoryResponse = await withTrustedOrigin(request(app)
        .delete(`/api/categories/${encodeURIComponent(createdCategory.id)}`)
        .set('Cookie', cookies));

    assert.equal(deleteCategoryResponse.status, 200);

    const postsAfterCategoryDelete = await readPosts();
    assert.equal(postsAfterCategoryDelete.length, 1);
    assert.equal(postsAfterCategoryDelete[0].category, '미분류');

    const categoriesAfterDelete = await readCategories();
    assert.ok(!categoriesAfterDelete.some(category => category.name === 'Platform'));

    const deletePostResponse = await withTrustedOrigin(request(app)
        .delete(`/api/posts/${createPostResponse.body.id}`)
        .set('Cookie', cookies));

    assert.equal(deletePostResponse.status, 204);

    const postsAfterDelete = await readPosts();
    assert.equal(postsAfterDelete.length, 0);
    assert.deepEqual(await readPostRevisions(createPostResponse.body.id), []);
});

test('post slugs are normalized before file persistence', async () => {
    const cookies = await loginAsAdmin();
    const originalProfile = JSON.parse(await readFile(profileFilePath, 'utf8'));

    const createResponse = await withTrustedOrigin(request(app)
        .post('/api/posts')
        .set('Cookie', cookies))
        .send({
            slug: '../profile',
            title: 'Path Traversal Post',
            summary: 'slug normalization summary',
            category: 'Security',
            contentJson: sampleContentJson,
            publishedAt: '2026-03-06',
            tags: [],
            status: 'published',
            sections: []
        });

    assert.equal(createResponse.status, 201);
    assert.equal(createResponse.body.slug, 'profile');

    const profileAfterCreate = JSON.parse(await readFile(profileFilePath, 'utf8'));
    assert.equal(profileAfterCreate.title, originalProfile.title);
    assert.equal(profileAfterCreate.favicon, originalProfile.favicon);

    const storedCreatedPost = JSON.parse(await readFile(path.join(postsDir, 'profile.json'), 'utf8'));
    assert.equal(storedCreatedPost.slug, 'profile');
    assert.equal(storedCreatedPost.title, 'Path Traversal Post');

    const updateResponse = await withTrustedOrigin(request(app)
        .put(`/api/posts/${createResponse.body.id}`)
        .set('Cookie', cookies))
        .send({
            ...createResponse.body,
            slug: '../../uploads/evil-post',
            title: 'Normalized Path Traversal Post',
            expectedUpdatedAt: createResponse.body.updatedAt
        });

    assert.equal(updateResponse.status, 200);
    assert.equal(updateResponse.body.slug, 'uploads-evil-post');

    const storedUpdatedPost = JSON.parse(
        await readFile(path.join(postsDir, 'uploads-evil-post.json'), 'utf8')
    );
    assert.equal(storedUpdatedPost.slug, 'uploads-evil-post');

    await assert.rejects(
        () => access(path.join(uploadDir, 'evil-post.json')),
        error => error.code === 'ENOENT'
    );
});

test('ensurePostsFile backfills contentJson for legacy html-only posts', async () => {
    await rm(postsDir, { recursive: true, force: true });

    const legacyPost = {
        id: 'legacy-post-1',
        slug: 'legacy-html-post',
        title: 'Legacy HTML Post',
        summary: 'legacy summary',
        category: 'Legacy',
        contentHtml: '<h1>Heading</h1><p>Body copy</p>',
        publishedAt: '2026-03-06',
        readingTime: '2분 읽기',
        tags: [],
        status: 'published',
        sections: []
    };

    await writeFile(postsFilePath, JSON.stringify([legacyPost], null, 2), 'utf8');

    await ensurePostsFile();

    const posts = await readPosts();
    assert.equal(posts.length, 1);
    assert.deepEqual(posts[0].contentJson, parsedHtmlContentJson);
    assert.equal(posts[0].contentHtml, '<h1>Heading</h1><p>Body copy</p>');
    assert.equal(Object.hasOwn(posts[0], 'readingTime'), false);

    const postFilePath = path.join(postsDir, 'legacy-html-post.json');
    const storedPost = JSON.parse(await readFile(postFilePath, 'utf8'));
    assert.deepEqual(storedPost.contentJson, parsedHtmlContentJson);
    assert.equal(Object.hasOwn(storedPost, 'readingTime'), false);
});

test('post revisions can be listed and restored', async () => {
    const cookies = await loginAsAdmin();

    const createPostResponse = await withTrustedOrigin(request(app)
        .post('/api/posts')
        .set('Cookie', cookies))
        .send({
            slug: 'revision-driven-post',
            title: 'Revision Driven Post',
            summary: 'revision summary',
            category: 'Engineering',
            contentJson: sampleContentJson,
            publishedAt: '2026-03-06',
            tags: ['editor'],
            status: 'published',
            sections: []
        });

    assert.equal(createPostResponse.status, 201);

    const createdPostId = createPostResponse.body.id;

    const initialRevisionsResponse = await request(app)
        .get(`/api/posts/${createdPostId}/revisions`)
        .set('Cookie', cookies);

    assert.equal(initialRevisionsResponse.status, 200);
    assert.equal(initialRevisionsResponse.body.length, 1);
    assert.equal(initialRevisionsResponse.body[0].event, 'created');
    assert.equal(initialRevisionsResponse.body[0].title, 'Revision Driven Post');

    const updatePostResponse = await withTrustedOrigin(request(app)
        .put(`/api/posts/${createdPostId}`)
        .set('Cookie', cookies))
        .send({
            ...createPostResponse.body,
            title: 'Revision Driven Post Updated',
            slug: 'revision-driven-post-updated',
            category: 'Engineering'
        });

    assert.equal(updatePostResponse.status, 200);

    const updatedRevisionsResponse = await request(app)
        .get(`/api/posts/${createdPostId}/revisions`)
        .set('Cookie', cookies);

    assert.equal(updatedRevisionsResponse.status, 200);
    assert.equal(updatedRevisionsResponse.body[0].event, 'updated');
    assert.ok(updatedRevisionsResponse.body.some(revision => revision.event === 'created'));

    const createdRevision = updatedRevisionsResponse.body.find(
        revision => revision.event === 'created'
    );
    assert.ok(createdRevision);

    const restoreResponse = await withTrustedOrigin(request(app)
        .post(`/api/posts/${createdPostId}/revisions/${createdRevision.id}/restore`)
        .set('Cookie', cookies));

    assert.equal(restoreResponse.status, 200);
    assert.equal(restoreResponse.body.title, 'Revision Driven Post');
    assert.equal(restoreResponse.body.slug, 'revision-driven-post');

    const restoredRevisionsResponse = await request(app)
        .get(`/api/posts/${createdPostId}/revisions`)
        .set('Cookie', cookies);

    assert.equal(restoredRevisionsResponse.status, 200);
    assert.equal(restoredRevisionsResponse.body[0].event, 'restored');
    assert.ok(restoredRevisionsResponse.body.some(revision => revision.event === 'updated'));
});

test('post updates reject stale editor saves', async () => {
    const cookies = await loginAsAdmin();

    const createPostResponse = await withTrustedOrigin(request(app)
        .post('/api/posts')
        .set('Cookie', cookies))
        .send({
            slug: 'stale-save-post',
            title: 'Stale Save Post',
            summary: 'stale save summary',
            category: 'Engineering',
            contentJson: sampleContentJson,
            publishedAt: '2026-03-06',
            tags: ['editor'],
            status: 'published',
            sections: []
        });

    assert.equal(createPostResponse.status, 201);

    const firstUpdateResponse = await withTrustedOrigin(request(app)
        .put(`/api/posts/${createPostResponse.body.id}`)
        .set('Cookie', cookies))
        .send({
            ...createPostResponse.body,
            title: 'Fresh Update',
            expectedUpdatedAt: createPostResponse.body.updatedAt
        });

    assert.equal(firstUpdateResponse.status, 200);

    const staleUpdateResponse = await withTrustedOrigin(request(app)
        .put(`/api/posts/${createPostResponse.body.id}`)
        .set('Cookie', cookies))
        .send({
            ...createPostResponse.body,
            title: 'Stale Update',
            expectedUpdatedAt: createPostResponse.body.updatedAt
        });

    assert.equal(staleUpdateResponse.status, 409);
    assert.match(staleUpdateResponse.body.message, /먼저 수정/);

    const posts = await readPosts();
    assert.equal(posts[0].title, 'Fresh Update');
});

test('profile update and uploads require authentication and persist', async () => {
    const unauthenticatedProfileUpdate = await request(app)
        .put('/api/profile')
        .send({ title: 'Should not persist' });

    assert.equal(unauthenticatedProfileUpdate.status, 401);

    const unauthenticatedUpload = await request(app)
        .post('/api/uploads')
        .send({ dataUrl: tinyPngDataUrl });

    assert.equal(unauthenticatedUpload.status, 401);

    const cookies = await loginAsAdmin();

    const updateProfileResponse = await withTrustedOrigin(request(app)
        .put('/api/profile')
        .set('Cookie', cookies))
        .send({
            title: 'HamLog Ops',
            name: 'Hamwoo',
            role: 'Engineer',
            description: 'Operational profile ready for deployment checks.',
            siteUrl: 'https://ops.hamwoo.co.kr/',
            display: {
                showStack: false,
                showLocation: false
            }
        });

    assert.equal(updateProfileResponse.status, 200);

    const savedProfile = await readProfile();
    assert.equal(savedProfile.title, 'HamLog Ops');
    assert.equal(savedProfile.description, 'Operational profile ready for deployment checks.');
    assert.equal(savedProfile.siteUrl, 'https://ops.hamwoo.co.kr');
    assert.equal(savedProfile.display.showStack, false);
    assert.equal(savedProfile.display.showLocation, false);

    const uploadResponse = await withTrustedOrigin(request(app)
        .post('/api/uploads')
        .set('Cookie', cookies))
        .send({ dataUrl: tinyPngDataUrl });

    assert.equal(uploadResponse.status, 201);
    assert.match(uploadResponse.body.url, /^\/uploads\/upload-.*\.webp$/);

    await access(path.join(uploadDir, uploadResponse.body.filename));
});

test('unused upload cleanup keeps referenced images and deletes selected unused files', async () => {
    const cookies = await loginAsAdmin();

    await writeFile(path.join(uploadDir, 'used.webp'), 'used image');
    await writeFile(path.join(uploadDir, 'unused.webp'), 'unused image');
    await writeFile(path.join(uploadDir, 'unused-two.webp'), 'unused image two');
    await writePosts([
        {
            id: 'post-with-upload-reference',
            slug: 'post-with-upload-reference',
            title: 'Post With Upload Reference',
            summary: 'upload reference',
            category: 'Media',
            contentHtml: '<p><img src="/uploads/used.webp" /></p>',
            publishedAt: '2026-03-06',
            tags: [],
            status: 'published',
            sections: []
        }
    ]);

    const scanResponse = await request(app)
        .get('/api/uploads/unused')
        .set('Cookie', cookies);

    assert.equal(scanResponse.status, 200);
    assert.equal(scanResponse.body.totalFiles, 3);
    assert.equal(scanResponse.body.referencedFiles, 1);
    assert.deepEqual(
        scanResponse.body.unused.map(file => file.filename).sort(),
        ['unused-two.webp', 'unused.webp']
    );

    const deleteResponse = await withTrustedOrigin(request(app)
        .delete('/api/uploads/unused')
        .set('Cookie', cookies))
        .send({ filenames: ['unused.webp', '../used.webp'] });

    assert.equal(deleteResponse.status, 200);
    assert.deepEqual(deleteResponse.body.deleted.map(file => file.filename), ['unused.webp']);

    await access(path.join(uploadDir, 'used.webp'));
    await access(path.join(uploadDir, 'unused-two.webp'));
    await assert.rejects(
        () => access(path.join(uploadDir, 'unused.webp')),
        error => error.code === 'ENOENT'
    );
});

test('profile route recreates a default profile when the profile file is corrupted', async () => {
    await writeFile(profileFilePath, '{ invalid json');

    const response = await request(app).get('/api/profile');

    assert.equal(response.status, 200);
    assert.equal(response.body.profile.title, defaultProfile.title);
    assert.equal(response.body.profile.favicon, defaultProfile.favicon);

    const savedProfile = await readProfile();
    assert.equal(savedProfile.title, defaultProfile.title);
    assert.equal(savedProfile.favicon, defaultProfile.favicon);
});

test('categories are rebuilt from posts when the category file is missing', async () => {
    await writePosts([
        {
            id: 'post-category-rebuild-1',
            slug: 'category-rebuild-1',
            title: 'Category Rebuild 1',
            summary: 'category rebuild',
            category: 'Infra',
            contentHtml: '<p>Infra body</p>',
            publishedAt: '2026-03-06',
            tags: [],
            status: 'published',
            sections: []
        },
        {
            id: 'post-category-rebuild-2',
            slug: 'category-rebuild-2',
            title: 'Category Rebuild 2',
            summary: 'category rebuild',
            category: 'Kubernetes',
            contentHtml: '<p>Kubernetes body</p>',
            publishedAt: '2026-03-06',
            tags: [],
            status: 'published',
            sections: []
        }
    ]);

    await rm(categoriesFilePath, { force: true });

    const response = await request(app).get('/api/categories');

    assert.equal(response.status, 200);
    assert.ok(response.body.categories.some(category => category.name === 'Infra'));
    assert.ok(response.body.categories.some(category => category.name === 'Kubernetes'));
    assert.ok(response.body.categories.some(category => category.name === '미분류'));
});

test('comments respect password verification on deletion', async () => {
    await writePosts([
        {
            id: 'post-1',
            slug: 'verified-comment-post',
            title: 'Verified Comment Post',
            summary: 'comment target',
            category: 'Testing',
            contentHtml: '<p>Hello comments</p>',
            publishedAt: '2026-03-06',
            tags: [],
            status: 'published',
            sections: []
        }
    ]);

    const createCommentResponse = await request(app)
        .post('/api/comments')
        .send({
            postId: 'post-1',
            author: 'Reader',
            password: 'secret-password',
            content: 'Nice post'
        });

    assert.equal(createCommentResponse.status, 201);
    assert.equal(createCommentResponse.body.comment.author, 'Reader');
    assert.ok(!('password' in createCommentResponse.body.comment));

    const listCommentsResponse = await request(app).get('/api/comments?postId=post-1');
    assert.equal(listCommentsResponse.status, 200);
    assert.equal(listCommentsResponse.body.comments.length, 1);

    const storedComments = await readComments();
    assert.equal(storedComments.length, 1);
    assert.notEqual(storedComments[0].password, 'secret-password');

    const failedDeleteResponse = await request(app)
        .delete(`/api/comments/${createCommentResponse.body.comment.id}`)
        .send({ password: 'wrong-password' });

    assert.equal(failedDeleteResponse.status, 403);

    const successfulDeleteResponse = await request(app)
        .delete(`/api/comments/${createCommentResponse.body.comment.id}`)
        .send({ password: 'secret-password' });

    assert.equal(successfulDeleteResponse.status, 200);

    const remainingComments = await readComments();
    assert.equal(remainingComments.length, 0);
});

test('authenticated write routes reject untrusted origins', async () => {
    const cookies = await loginAsAdmin();

    const response = await request(app)
        .post('/api/posts')
        .set('Cookie', cookies)
        .set('Origin', 'https://evil.example.com')
        .set('X-Forwarded-Host', 'tech.hamwoo.co.kr')
        .set('X-Forwarded-Proto', 'https')
        .send({
            slug: 'blocked-by-origin',
            title: 'Blocked by origin',
            summary: 'summary',
            category: 'Security',
            contentHtml: '<p>blocked</p>',
            publishedAt: '2026-03-06',
            tags: [],
            status: 'published',
            sections: []
        });

    assert.equal(response.status, 403);
    assert.equal(response.body.message, '유효하지 않은 요청 출처입니다.');
});

test('public post endpoints hide drafts and future scheduled posts from unauthenticated users', async () => {
    const now = Date.now();
    const pastScheduledAt = new Date(now - 60_000).toISOString();
    const futureScheduledAt = new Date(now + 60 * 60 * 1000).toISOString();

    await writePosts([
        {
            id: 'post-public',
            slug: 'public-post',
            title: 'Public Post',
            summary: 'Visible to everyone',
            category: 'Testing',
            contentHtml: '<p>public body</p>',
            publishedAt: '2026-03-06',
            tags: ['visible'],
            status: 'published',
            sections: []
        },
        {
            id: 'post-scheduled-visible',
            slug: 'scheduled-visible-post',
            title: 'Scheduled Visible Post',
            summary: 'Already visible scheduled content',
            category: 'Testing',
            contentHtml: '<p>scheduled visible body</p>',
            publishedAt: pastScheduledAt.slice(0, 10),
            tags: ['scheduled'],
            status: 'scheduled',
            scheduledAt: pastScheduledAt,
            sections: []
        },
        {
            id: 'post-scheduled-hidden',
            slug: 'scheduled-hidden-post',
            title: 'Scheduled Hidden Post',
            summary: 'Should stay hidden',
            category: 'Testing',
            contentHtml: '<p>scheduled hidden body</p>',
            publishedAt: futureScheduledAt.slice(0, 10),
            tags: ['hidden'],
            status: 'scheduled',
            scheduledAt: futureScheduledAt,
            sections: []
        },
        {
            id: 'post-draft',
            slug: 'draft-post',
            title: 'Draft Post',
            summary: 'Should never be public',
            category: 'Testing',
            contentHtml: '<p>draft body</p>',
            publishedAt: '2026-03-06',
            tags: ['draft'],
            status: 'draft',
            sections: []
        }
    ]);

    const publicPostsResponse = await request(app).get('/api/posts');
    assert.equal(publicPostsResponse.status, 200);
    assert.deepEqual(
        publicPostsResponse.body.posts.map(post => post.slug).sort(),
        ['public-post', 'scheduled-visible-post']
    );

    const cookies = await loginAsAdmin();
    const adminPostsResponse = await request(app)
        .get('/api/posts')
        .set('Cookie', cookies);

    assert.equal(adminPostsResponse.status, 200);
    assert.deepEqual(
        adminPostsResponse.body.posts.map(post => post.slug).sort(),
        ['draft-post', 'public-post', 'scheduled-hidden-post', 'scheduled-visible-post']
    );
});

test('public post views increment only for visible posts', async () => {
    const now = Date.now();
    const futureScheduledAt = new Date(now + 60 * 60 * 1000).toISOString();

    await writePosts([
        {
            id: 'post-public',
            slug: 'public-post',
            title: 'Public Post',
            summary: 'Visible to everyone',
            category: 'Testing',
            contentHtml: '<p>public body</p>',
            publishedAt: '2026-03-06',
            updatedAt: '2026-03-06T00:00:00.000Z',
            tags: ['visible'],
            status: 'published',
            views: 2,
            sections: []
        },
        {
            id: 'post-scheduled-hidden',
            slug: 'scheduled-hidden-post',
            title: 'Scheduled Hidden Post',
            summary: 'Should stay hidden',
            category: 'Testing',
            contentHtml: '<p>scheduled hidden body</p>',
            publishedAt: futureScheduledAt.slice(0, 10),
            tags: ['hidden'],
            status: 'scheduled',
            scheduledAt: futureScheduledAt,
            views: 5,
            sections: []
        },
        {
            id: 'post-draft',
            slug: 'draft-post',
            title: 'Draft Post',
            summary: 'Should never be public',
            category: 'Testing',
            contentHtml: '<p>draft body</p>',
            publishedAt: '2026-03-06',
            tags: ['draft'],
            status: 'draft',
            views: 7,
            sections: []
        }
    ]);

    const firstViewResponse = await request(app).post('/api/posts/public-post/view');
    assert.equal(firstViewResponse.status, 200);
    assert.deepEqual(firstViewResponse.body, { slug: 'public-post', views: 3 });

    const secondViewResponse = await request(app).post('/api/posts/public-post/view');
    assert.equal(secondViewResponse.status, 200);
    assert.deepEqual(secondViewResponse.body, { slug: 'public-post', views: 4 });

    const hiddenScheduledResponse = await request(app).post('/api/posts/scheduled-hidden-post/view');
    assert.equal(hiddenScheduledResponse.status, 404);

    const draftResponse = await request(app).post('/api/posts/draft-post/view');
    assert.equal(draftResponse.status, 404);

    const storedPosts = await readPosts();
    const publicPost = storedPosts.find(post => post.slug === 'public-post');
    const scheduledPost = storedPosts.find(post => post.slug === 'scheduled-hidden-post');
    const draftPost = storedPosts.find(post => post.slug === 'draft-post');

    assert.equal(publicPost.views, 4);
    assert.equal(publicPost.updatedAt, '2026-03-06T00:00:00.000Z');
    assert.equal(scheduledPost.views, 5);
    assert.equal(draftPost.views, 7);

    const publicPostsResponse = await request(app).get('/api/posts');
    assert.equal(publicPostsResponse.status, 200);
    assert.deepEqual(
        publicPostsResponse.body.posts.map(post => ({ slug: post.slug, views: post.views })),
        [{ slug: 'public-post', views: 4 }]
    );
});

test('seo routes ignore non-public posts, escape meta values, and include visible scheduled posts in feeds', async () => {
    const now = Date.now();
    const pastScheduledAt = new Date(now - 60_000).toISOString();
    const futureScheduledAt = new Date(now + 60 * 60 * 1000).toISOString();

    await writePosts([
        {
            id: 'post-visible',
            slug: 'meta-visible-post',
            title: 'A "quoted" <title>',
            summary: 'desc with "quotes" & <tags>',
            category: 'Testing',
            contentHtml: '<p>Visible body</p>',
            publishedAt: '2026-03-06',
            updatedAt: '2026-03-08T04:05:06.000Z',
            tags: ['meta'],
            status: 'published',
            seo: {
                keywords: ['openclaw', '기여']
            },
            sections: []
        },
        {
            id: 'post-scheduled-visible',
            slug: 'meta-scheduled-visible',
            title: 'Meta Scheduled Visible',
            summary: 'scheduled summary',
            category: 'Testing',
            contentHtml: '<p>visible scheduled body</p>',
            publishedAt: pastScheduledAt.slice(0, 10),
            tags: ['meta'],
            status: 'scheduled',
            scheduledAt: pastScheduledAt,
            sections: []
        },
        {
            id: 'post-draft',
            slug: 'meta-draft-post',
            title: 'Draft Meta Title',
            summary: 'draft meta summary',
            category: 'Testing',
            contentHtml: '<p>draft body</p>',
            publishedAt: '2026-03-06',
            tags: ['draft'],
            status: 'draft',
            sections: []
        },
        {
            id: 'post-future',
            slug: 'meta-future-post',
            title: 'Future Meta Title',
            summary: 'future meta summary',
            category: 'Testing',
            contentHtml: '<p>future body</p>',
            publishedAt: futureScheduledAt.slice(0, 10),
            tags: ['future'],
            status: 'scheduled',
            scheduledAt: futureScheduledAt,
            sections: []
        }
    ]);

    const visibleMetaResponse = await request(app).get('/posts/meta-visible-post');
    assert.equal(visibleMetaResponse.status, 200);
    assert.match(visibleMetaResponse.text, /<title>A &quot;quoted&quot; &lt;title&gt;<\/title>/);
    assert.match(visibleMetaResponse.text, /<meta name="description" content="desc with &quot;quotes&quot; &amp; &lt;tags&gt;" \/>/);
    assert.match(
        visibleMetaResponse.text,
        /<link rel="canonical" href="https:\/\/tech\.hamwoo\.co\.kr\/posts\/meta-visible-post" \/>/
    );
    assert.match(
        visibleMetaResponse.text,
        /<meta property="og:type" content="article" \/>/
    );
    assert.match(
        visibleMetaResponse.text,
        /<meta name="keywords" content="openclaw, 기여" \/>/
    );
    assert.match(
        visibleMetaResponse.text,
        /"@type":"BlogPosting"/
    );
    assert.match(
        visibleMetaResponse.text,
        /"mainEntityOfPage":"https:\/\/tech\.hamwoo\.co\.kr\/posts\/meta-visible-post"/
    );

    const draftMetaResponse = await request(app).get('/posts/meta-draft-post');
    assert.equal(draftMetaResponse.status, 404);
    assert.doesNotMatch(draftMetaResponse.text, /Draft Meta Title/);
    assert.match(draftMetaResponse.text, /<meta name="robots" content="noindex, nofollow" \/>/);
    assert.equal(draftMetaResponse.headers['x-robots-tag'], 'noindex, nofollow');

    const missingPostResponse = await request(app).get('/posts/does-not-exist');
    assert.equal(missingPostResponse.status, 404);
    assert.match(missingPostResponse.text, /<meta name="robots" content="noindex, nofollow" \/>/);
    assert.equal(missingPostResponse.headers['x-robots-tag'], 'noindex, nofollow');

    const adminResponse = await request(app).get('/admin');
    assert.equal(adminResponse.status, 200);
    assert.match(adminResponse.text, /<meta name="robots" content="noindex, nofollow" \/>/);
    assert.equal(adminResponse.headers['x-robots-tag'], 'noindex, nofollow');

    const rssResponse = await request(app).get('/rss.xml');
    assert.equal(rssResponse.status, 200);
    assert.match(rssResponse.text, /<!\[CDATA\[A "quoted" <title>\]\]>/);
    assert.match(rssResponse.text, /meta-visible-post/);
    assert.match(rssResponse.text, /meta-scheduled-visible/);
    assert.doesNotMatch(rssResponse.text, /meta-future-post/);
    assert.doesNotMatch(rssResponse.text, /meta-draft-post/);
    assert.match(
        rssResponse.text,
        new RegExp(new Date('2026-03-08T04:05:06.000Z').toUTCString())
    );

    const sitemapResponse = await request(app).get('/sitemap.xml');
    assert.equal(sitemapResponse.status, 200);
    assert.match(sitemapResponse.text, /meta-visible-post/);
    assert.match(sitemapResponse.text, /<lastmod>2026-03-08<\/lastmod>/);
    assert.match(sitemapResponse.text, /meta-scheduled-visible/);
    assert.doesNotMatch(sitemapResponse.text, /meta-future-post/);
    assert.doesNotMatch(sitemapResponse.text, /meta-draft-post/);

    const searchResponse = await request(app).get('/api/search?q=scheduled');
    assert.equal(searchResponse.status, 200);
    assert.deepEqual(searchResponse.body.map(post => post.slug), ['meta-scheduled-visible']);
});

test('home page reflects profile SEO metadata and search engine verification', async () => {
    const previousGoogleVerification = process.env.GOOGLE_SITE_VERIFICATION;
    const previousNaverVerification = process.env.NAVER_SITE_VERIFICATION;
    const previousDaumVerification = process.env.DAUM_SITE_VERIFICATION;
    const previousDaumPin = process.env.DAUM_WEBMASTER_PIN;
    process.env.GOOGLE_SITE_VERIFICATION = 'google-verification-token';
    process.env.NAVER_SITE_VERIFICATION = 'naver-verification-token';
    process.env.DAUM_SITE_VERIFICATION = 'daum-verification-token';
    process.env.DAUM_WEBMASTER_PIN = 'daum-pin-token';

    try {
        await writeProfile({
            ...defaultProfile,
            title: 'HamLog Ops',
            name: 'Hamwoo',
            description: '운영 관점의 클라우드 엔지니어링 기록입니다.',
            favicon: '/uploads/favicon-home.png',
            profileImage: '/uploads/profile-home.png',
            stack: ['Terraform', 'AWS']
        });

        const response = await request(app).get('/');

        assert.equal(response.status, 200);
        assert.match(response.headers['content-security-policy'], /default-src 'self'/);
        assert.match(response.headers['content-security-policy'], /object-src 'none'/);
        assert.match(response.headers['content-security-policy'], /frame-ancestors 'self'/);
        assert.match(response.text, /<title>HamLog Ops \| 클라우드 엔지니어링과 개발 기록<\/title>/);
        assert.match(
            response.text,
            /<meta name="description" content="운영 관점의 클라우드 엔지니어링 기록입니다\." \/>/
        );
        assert.match(
            response.text,
            /<meta property="og:image" content="https:\/\/tech\.hamwoo\.co\.kr\/uploads\/profile-home\.png" \/>/
        );
        assert.match(
            response.text,
            /<link rel="icon" href="https:\/\/tech\.hamwoo\.co\.kr\/uploads\/favicon-home\.png" \/>/
        );
        assert.match(
            response.text,
            /<link rel="canonical" href="https:\/\/tech\.hamwoo\.co\.kr" \/>/
        );
        assert.match(response.text, /Terraform/);
        assert.match(
            response.text,
            /<meta name="google-site-verification" content="google-verification-token" \/>/
        );
        assert.match(
            response.text,
            /<meta name="naver-site-verification" content="naver-verification-token" \/>/
        );
        assert.match(
            response.text,
            /<meta name="daum-site-verification" content="daum-verification-token" \/>/
        );

        const robotsResponse = await request(app).get('/robots.txt');
        assert.equal(robotsResponse.status, 200);
        assert.match(robotsResponse.headers['content-type'], /text\/plain/);
        assert.match(robotsResponse.text, /User-agent: \*/);
        assert.match(robotsResponse.text, /Allow: \//);
        assert.match(robotsResponse.text, /DaumWebMasterTool: daum-pin-token/);
        assert.match(robotsResponse.text, /Sitemap: https:\/\/tech\.hamwoo\.co\.kr\/sitemap\.xml/);
    } finally {
        if (previousGoogleVerification === undefined) {
            delete process.env.GOOGLE_SITE_VERIFICATION;
        } else {
            process.env.GOOGLE_SITE_VERIFICATION = previousGoogleVerification;
        }

        if (previousNaverVerification === undefined) {
            delete process.env.NAVER_SITE_VERIFICATION;
        } else {
            process.env.NAVER_SITE_VERIFICATION = previousNaverVerification;
        }

        if (previousDaumVerification === undefined) {
            delete process.env.DAUM_SITE_VERIFICATION;
        } else {
            process.env.DAUM_SITE_VERIFICATION = previousDaumVerification;
        }

        if (previousDaumPin === undefined) {
            delete process.env.DAUM_WEBMASTER_PIN;
        } else {
            process.env.DAUM_WEBMASTER_PIN = previousDaumPin;
        }
    }
});
