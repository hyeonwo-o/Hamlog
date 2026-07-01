import React, { useState } from 'react';

const SEARCH_QUERY_MAX_LENGTH = 120;

interface SearchAndFilterProps {
  onTagFilter: (tag: string | null) => void;
  availableTags: string[];
  currentTag: string | null;
  onCategoryFilter: (category: string | null) => void;
  availableCategories: string[];
  currentCategory: string | null;
  searchQuery: string;
  onSearchChange: (q: string) => void;
}

const SearchAndFilter: React.FC<SearchAndFilterProps> = ({
  onTagFilter,
  availableTags,
  currentTag,
  onCategoryFilter,
  availableCategories,
  currentCategory,
  searchQuery,
  onSearchChange,
}) => {
  const [tagOpen, setTagOpen] = useState(false);
  const [categoryOpen, setCategoryOpen] = useState(false);

  return (
    <div className="rounded-3xl border border-[color:var(--border)] bg-[var(--surface-overlay)] p-4">
      <div className="flex flex-col gap-4 md:flex-row md:items-end">
        <label className="flex-1 text-xs uppercase tracking-[0.2em] text-[var(--text-muted)]">
          검색
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="글, 태그, 시리즈로 검색"
            maxLength={SEARCH_QUERY_MAX_LENGTH}
            className="mt-2 w-full rounded-2xl border border-[color:var(--border)] bg-[var(--surface-muted)] px-4 py-3 text-sm text-[var(--text)] focus:outline-none focus:ring-2 focus:ring-[color:var(--accent-soft)]"
          />
        </label>

        <div className="flex flex-col gap-4 md:flex-row md:items-end">
          <div className="relative w-full md:w-56">
            <span className="text-xs uppercase tracking-[0.2em] text-[var(--text-muted)]">
              카테고리
            </span>
            <button
              type="button"
              onClick={() => {
                setCategoryOpen(prev => !prev);
                setTagOpen(false);
              }}
              className="mt-2 flex w-full items-center justify-between rounded-2xl border border-[color:var(--border)] bg-[var(--surface-muted)] px-4 py-3 text-sm text-[var(--text)]"
              aria-haspopup="listbox"
              aria-expanded={categoryOpen}
            >
              <span>{currentCategory ?? '전체 카테고리'}</span>
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <path d="M6 9l6 6 6-6" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>

            {categoryOpen && (
              <div className="absolute right-0 z-10 mt-2 w-full rounded-2xl border border-[color:var(--border)] bg-[var(--surface)]">
                <ul className="max-h-56 overflow-auto py-2" role="listbox">
                  <li>
                    <button
                      onClick={() => {
                        onCategoryFilter(null);
                        setCategoryOpen(false);
                      }}
                      className={`block w-full px-4 py-2 text-left text-sm ${
                        currentCategory === null
                          ? 'bg-[var(--surface-muted)] text-[var(--text)]'
                          : 'text-[var(--text-muted)] hover:bg-[var(--surface-muted)] hover:text-[var(--text)]'
                      }`}
                    >
                      전체 보기
                    </button>
                  </li>
                  {availableCategories.map(category => (
                    <li key={category}>
                      <button
                        onClick={() => {
                          onCategoryFilter(category === currentCategory ? null : category);
                          setCategoryOpen(false);
                        }}
                        className={`block w-full px-4 py-2 text-left text-sm ${
                          currentCategory === category
                            ? 'bg-[var(--surface-muted)] text-[var(--text)]'
                            : 'text-[var(--text-muted)] hover:bg-[var(--surface-muted)] hover:text-[var(--text)]'
                        }`}
                      >
                        {category}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          <div className="relative w-full md:w-56">
            <span className="text-xs uppercase tracking-[0.2em] text-[var(--text-muted)]">
              태그
            </span>
            <button
              type="button"
              onClick={() => {
                setTagOpen(prev => !prev);
                setCategoryOpen(false);
              }}
              className="mt-2 flex w-full items-center justify-between rounded-2xl border border-[color:var(--border)] bg-[var(--surface-muted)] px-4 py-3 text-sm text-[var(--text)]"
              aria-haspopup="listbox"
              aria-expanded={tagOpen}
            >
              <span>{currentTag ? `#${currentTag}` : '전체 태그'}</span>
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <path d="M6 9l6 6 6-6" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>

            {tagOpen && (
              <div className="absolute right-0 z-10 mt-2 w-full rounded-2xl border border-[color:var(--border)] bg-[var(--surface)]">
                <ul className="max-h-56 overflow-auto py-2" role="listbox">
                  <li>
                    <button
                      onClick={() => {
                        onTagFilter(null);
                        setTagOpen(false);
                      }}
                      className={`block w-full px-4 py-2 text-left text-sm ${
                        currentTag === null
                          ? 'bg-[var(--surface-muted)] text-[var(--text)]'
                          : 'text-[var(--text-muted)] hover:bg-[var(--surface-muted)] hover:text-[var(--text)]'
                      }`}
                    >
                      전체 보기
                    </button>
                  </li>
                  {availableTags.map(tag => (
                    <li key={tag}>
                      <button
                        onClick={() => {
                          onTagFilter(tag === currentTag ? null : tag);
                          setTagOpen(false);
                        }}
                        className={`block w-full px-4 py-2 text-left text-sm ${
                          currentTag === tag
                            ? 'bg-[var(--surface-muted)] text-[var(--text)]'
                            : 'text-[var(--text-muted)] hover:bg-[var(--surface-muted)] hover:text-[var(--text)]'
                        }`}
                      >
                        #{tag}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default SearchAndFilter;
