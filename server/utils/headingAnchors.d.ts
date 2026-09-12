export function createHeadingIdAllocator(
  authoredIds?: string[],
  otherIds?: string[]
): (text: string, authoredId?: string) => string;
