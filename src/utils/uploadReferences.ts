const UPLOAD_URL_PATTERN = /\/uploads\/([^"')\s<>?#]+)/g;

/** Collect only names, keeping draft text out of cleanup requests. */
export function collectUploadFilenames(value: unknown): string[] {
  const filenames = new Set<string>();
  const visit = (item: unknown) => {
    if (typeof item === 'string') {
      for (const match of item.matchAll(UPLOAD_URL_PATTERN)) {
        let filename = match[1];
        try {
          filename = decodeURIComponent(filename);
        } catch {
          // Keep literal names when percent encoding is malformed.
        }
        if (filename && filename !== '.' && filename !== '..'
          && !filename.includes('/') && !filename.includes('\\') && !filename.includes('\0')) {
          filenames.add(filename);
        }
      }
    } else if (Array.isArray(item)) {
      item.forEach(visit);
    } else if (item && typeof item === 'object') {
      Object.values(item).forEach(visit);
    }
  };
  visit(value);
  return [...filenames];
}

type DraftStorage = Pick<Storage, 'length' | 'key' | 'getItem'>;

export function collectCleanupProtectedFilenames(draft: unknown, storage?: DraftStorage): string[] {
  try {
    const draftStorage = storage ?? window.localStorage;
    const filenames = new Set(collectUploadFilenames(draft));
    for (let index = 0; index < draftStorage.length; index += 1) {
      const key = draftStorage.key(index);
      if (!key?.startsWith('hamlog_draft_')) continue;
      const raw = draftStorage.getItem(key);
      if (raw === null) continue;
      collectUploadFilenames(JSON.parse(raw)).forEach(filename => filenames.add(filename));
    }
    return [...filenames];
  } catch {
    throw new Error('브라우저 임시 저장본의 이미지 보호를 확인하지 못해 정리를 중단했습니다. 임시 저장 상태를 확인해 주세요.');
  }
}
