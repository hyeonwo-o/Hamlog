export const SEARCH_QUERY_MAX_LENGTH = 120;

export const normalizeSearchQuery = (value: string) => Array.from(value)
  .filter(character => {
    const code = character.codePointAt(0) ?? 0;
    return code >= 0x20 && code !== 0x7f;
  })
  .join('')
  .replace(/\s+/g, ' ')
  .trim()
  .slice(0, SEARCH_QUERY_MAX_LENGTH);
