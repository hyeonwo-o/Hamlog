import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const dataDir = path.join(rootDir, 'server', 'data');
const postsFilePath = path.join(dataDir, 'posts.json');
const postsDir = path.join(dataDir, 'posts');
const postViewsFilePath = path.join(dataDir, 'post-views.json');
const categoriesFilePath = path.join(dataDir, 'categories.json');
const commentsFilePath = path.join(dataDir, 'comments.json');
const profileFilePath = path.join(dataDir, 'profile.json');
const revisionsDir = path.join(dataDir, 'revisions');

const pathExists = async (targetPath) => {
  try {
    await fs.access(targetPath);
    return true;
  } catch (error) {
    if (error?.code === 'ENOENT') {
      return false;
    }
    throw error;
  }
};

const readJsonFile = async (filePath) => {
  const raw = await fs.readFile(filePath, 'utf-8');
  return JSON.parse(raw);
};

const addDuplicateErrors = (items, key, label, errors) => {
  const seen = new Map();

  for (const item of items) {
    const value = String(item?.[key] ?? '').trim();

    if (!value) {
      errors.push(`${label} 값이 비어 있습니다.`);
      continue;
    }

    if (seen.has(value)) {
      errors.push(`${label} 중복: ${value}`);
    }

    seen.set(value, true);
  }
};

const verify = async () => {
  const errors = [];
  let indexPosts = [];
  let postFiles = [];
  const hasPostsIndex = await pathExists(postsFilePath);
  const hasPostsDirectory = await pathExists(postsDir);

  if (!hasPostsIndex && !hasPostsDirectory) {
    console.log('데이터 파일이 없어 무결성 점검을 건너뜁니다.');
    return;
  }

  try {
    indexPosts = await readJsonFile(postsFilePath);
  } catch (error) {
    errors.push(`posts.json을 읽을 수 없습니다: ${error.message}`);
  }

  if (!Array.isArray(indexPosts)) {
    errors.push('posts.json 최상위 값은 배열이어야 합니다.');
    indexPosts = [];
  }

  if (hasPostsDirectory) {
    try {
      postFiles = (await fs.readdir(postsDir))
        .filter(fileName => fileName.endsWith('.json'))
        .sort();
    } catch (error) {
      errors.push(`개별 글 디렉터리를 읽을 수 없습니다: ${error.message}`);
    }
  } else {
    errors.push('개별 글 디렉터리를 찾을 수 없습니다.');
  }

  addDuplicateErrors(indexPosts, 'id', '글 ID', errors);
  addDuplicateErrors(indexPosts, 'slug', '글 slug', errors);

  const postsBySlug = new Map(indexPosts.map(post => [String(post?.slug ?? '').trim(), post]));
  const postIds = new Set(indexPosts.map(post => String(post?.id ?? '').trim()).filter(Boolean));
  const fileSlugs = new Set(postFiles.map(fileName => fileName.replace(/\.json$/, '')));

  for (const post of indexPosts) {
    const slug = String(post?.slug ?? '').trim();

    if (!slug) {
      continue;
    }

    if (!fileSlugs.has(slug)) {
      errors.push(`개별 글 파일 누락: ${slug}.json`);
    }
  }

  for (const fileName of postFiles) {
    const filePath = path.join(postsDir, fileName);
    const fileSlug = fileName.replace(/\.json$/, '');
    let filePost;

    try {
      filePost = await readJsonFile(filePath);
    } catch (error) {
      errors.push(`${fileName}을 읽을 수 없습니다: ${error.message}`);
      continue;
    }

    if (!filePost || typeof filePost !== 'object' || Array.isArray(filePost)) {
      errors.push(`${fileName} 최상위 값은 객체여야 합니다.`);
      continue;
    }

    if (filePost.slug !== fileSlug) {
      errors.push(`${fileName}의 slug가 파일명과 다릅니다: ${filePost.slug ?? '(없음)'}`);
    }

    const indexPost = postsBySlug.get(fileSlug);

    if (!indexPost) {
      errors.push(`posts.json에 없는 개별 글 파일: ${fileName}`);
      continue;
    }

    if (String(indexPost.id) !== String(filePost.id)) {
      errors.push(`${fileName}의 id가 posts.json과 다릅니다.`);
    }

    if (JSON.stringify(indexPost) !== JSON.stringify(filePost)) {
      errors.push(`${fileName}의 내용이 posts.json 인덱스와 다릅니다.`);
    }
  }

  if (await pathExists(postViewsFilePath)) {
    try {
      const views = await readJsonFile(postViewsFilePath);
      if (!views || typeof views !== 'object' || Array.isArray(views)) {
        errors.push('post-views.json 최상위 값은 객체여야 합니다.');
      } else {
        for (const [postId, count] of Object.entries(views)) {
          if (!postIds.has(postId)) errors.push(`삭제된 글의 조회수 데이터가 남아 있습니다: ${postId}`);
          if (!Number.isInteger(count) || count < 0) errors.push(`유효하지 않은 조회수: ${postId}`);
        }
      }
    } catch (error) {
      errors.push(`post-views.json을 읽을 수 없습니다: ${error.message}`);
    }
  }

  if (await pathExists(categoriesFilePath)) {
    try {
      const categories = await readJsonFile(categoriesFilePath);
      if (!Array.isArray(categories)) {
        errors.push('categories.json 최상위 값은 배열이어야 합니다.');
      } else {
        const categoryIds = new Set(categories.map(category => String(category?.id ?? '')).filter(Boolean));
        addDuplicateErrors(categories, 'id', '카테고리 ID', errors);
        addDuplicateErrors(categories, 'name', '카테고리 이름', errors);
        for (const category of categories) {
          if (category?.parentId && !categoryIds.has(String(category.parentId))) {
            errors.push(`존재하지 않는 상위 카테고리 참조: ${category.name ?? category.id}`);
          }
        }
      }
    } catch (error) {
      errors.push(`categories.json을 읽을 수 없습니다: ${error.message}`);
    }
  }

  if (await pathExists(commentsFilePath)) {
    try {
      const comments = await readJsonFile(commentsFilePath);
      if (!Array.isArray(comments)) {
        errors.push('comments.json 최상위 값은 배열이어야 합니다.');
      } else {
        addDuplicateErrors(comments, 'id', '댓글 ID', errors);
        for (const comment of comments) {
          if (!postIds.has(String(comment?.postId ?? ''))) {
            errors.push(`존재하지 않는 글을 참조하는 댓글: ${comment?.id ?? '(ID 없음)'}`);
          }
        }
      }
    } catch (error) {
      errors.push(`comments.json을 읽을 수 없습니다: ${error.message}`);
    }
  }

  if (await pathExists(profileFilePath)) {
    try {
      const profile = await readJsonFile(profileFilePath);
      if (!profile || typeof profile !== 'object' || Array.isArray(profile)) {
        errors.push('profile.json 최상위 값은 객체여야 합니다.');
      }
    } catch (error) {
      errors.push(`profile.json을 읽을 수 없습니다: ${error.message}`);
    }
  }

  if (await pathExists(revisionsDir)) {
    const revisionFiles = (await fs.readdir(revisionsDir)).filter(file => file.endsWith('.json'));
    for (const fileName of revisionFiles) {
      const postId = fileName.replace(/\.json$/, '');
      if (!postIds.has(postId)) errors.push(`삭제된 글의 리비전 파일이 남아 있습니다: ${fileName}`);
      try {
        const revisions = await readJsonFile(path.join(revisionsDir, fileName));
        if (!Array.isArray(revisions)) errors.push(`${fileName} 리비전 최상위 값은 배열이어야 합니다.`);
      } catch (error) {
        errors.push(`${fileName} 리비전을 읽을 수 없습니다: ${error.message}`);
      }
    }
  }

  if (errors.length > 0) {
    console.error('데이터 무결성 점검 실패');
    for (const error of errors) {
      console.error(`- ${error}`);
    }
    process.exitCode = 1;
    return;
  }

  console.log(`데이터 무결성 점검 통과: 글 ${indexPosts.length}개, 개별 파일 ${postFiles.length}개`);
};

verify().catch((error) => {
  console.error(`데이터 무결성 점검 중 오류가 발생했습니다: ${error.message}`);
  process.exitCode = 1;
});
