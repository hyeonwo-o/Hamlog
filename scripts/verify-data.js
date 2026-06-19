import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const dataDir = path.join(rootDir, 'server', 'data');
const postsFilePath = path.join(dataDir, 'posts.json');
const postsDir = path.join(dataDir, 'posts');

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

  try {
    indexPosts = await readJsonFile(postsFilePath);
  } catch (error) {
    errors.push(`posts.json을 읽을 수 없습니다: ${error.message}`);
  }

  if (!Array.isArray(indexPosts)) {
    errors.push('posts.json 최상위 값은 배열이어야 합니다.');
    indexPosts = [];
  }

  try {
    postFiles = (await fs.readdir(postsDir))
      .filter(fileName => fileName.endsWith('.json'))
      .sort();
  } catch (error) {
    errors.push(`개별 글 디렉터리를 읽을 수 없습니다: ${error.message}`);
  }

  addDuplicateErrors(indexPosts, 'id', '글 ID', errors);
  addDuplicateErrors(indexPosts, 'slug', '글 slug', errors);

  const postsBySlug = new Map(indexPosts.map(post => [String(post?.slug ?? '').trim(), post]));
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
