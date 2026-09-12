// Shared by the initial HTML renderer and the browser. Reserve authored IDs
// before generating anchors, so a later custom anchor is never taken by a title.
export const createHeadingIdAllocator = (authoredIds = [], otherIds = []) => {
  const reserved = new Set([...authoredIds, ...otherIds].filter(Boolean));
  const used = new Set(otherIds.filter(Boolean));

  return (text, authoredId = '') => {
    if (authoredId && !used.has(authoredId)) {
      used.add(authoredId);
      return authoredId;
    }

    const slug = String(text ?? '').trim().toLowerCase()
      .replace(/[^a-z0-9가-힣\s-]/g, '')
      .replace(/\s+/g, '-')
      .slice(0, 30) || 'heading';
    // Preserve the existing first-heading URL format for already shared links.
    const base = authoredId || `heading--${slug}`;
    let candidate = base;
    let suffix = 2;
    while (used.has(candidate) || reserved.has(candidate)) {
      candidate = `${base}-${suffix}`;
      suffix += 1;
    }
    used.add(candidate);
    return candidate;
  };
};
