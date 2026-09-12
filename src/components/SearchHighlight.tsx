import { Fragment } from 'react';

export default function SearchHighlight({ text, query = '' }: { text: string; query?: string }) {
  if (!query) return <>{text}</>;
  const lowerText = text.toLowerCase();
  const lowerQuery = query.toLowerCase();
  // Case expansion can shift UTF-16 offsets. Prefer intact copy over marking
  // unrelated characters; the server still returns the matching result.
  if (lowerText.length !== text.length || lowerQuery.length !== query.length) return <>{text}</>;
  const segments = [];
  let cursor = 0;
  let match = lowerText.indexOf(lowerQuery);
  while (match !== -1) {
    segments.push(
      <Fragment key={match}>
        {text.slice(cursor, match)}
        <mark className="rounded-sm bg-[var(--accent-soft)] text-[var(--accent-strong)]">
          {text.slice(match, match + query.length)}
        </mark>
      </Fragment>
    );
    cursor = match + query.length;
    match = lowerText.indexOf(lowerQuery, cursor);
  }
  return <>{segments}{text.slice(cursor)}</>;
}
