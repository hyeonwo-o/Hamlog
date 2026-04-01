import React from 'react';
import type { ReactNode } from 'react';
import type { PostDraft } from '../../../types/admin';
import type { CategoryTreeResult } from '../../../utils/categoryTree';
import type { PostRevision } from '../../../data/blogData';
import { PostMetadata } from '../PostMetadata';
import PostInspectorSection from './PostInspectorSection';
import { TableOfContents } from '../../TableOfContents';
import type { TocItem } from '../../TableOfContents';

interface PostInspectorProps {
  embedded?: boolean;
  activeId: string | null;
  draft: PostDraft;
  categoryTree: CategoryTreeResult;
  revisions: PostRevision[];
  revisionsLoading?: boolean;
  restoringRevisionId?: string | null;
  contentStats: { chars: number; words: number; readingMinutes: number };
  tagInput: string;
  onTagInputChange: (value: string) => void;
  onTagKeyDown: (event: React.KeyboardEvent<HTMLInputElement>) => void;
  onTagBlur: () => void;
  onRemoveTag: (tag: string) => void;
  onUpdateDraft: (patch: Partial<PostDraft>) => void;
  onCoverUpload?: (file: File) => Promise<void>;
  onRestoreRevision: (revisionId: string) => void;
  tocItems: TocItem[];
  onTocLinkClick: (id: string) => void;
}

const formatRevisionLabel = (savedAt: string) => {
  const timestamp = new Date(savedAt);
  if (Number.isNaN(timestamp.getTime())) return '';
  return timestamp.toLocaleString('ko-KR', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  });
};

const describeRevisionEvent = (event: PostRevision['event']) => {
  switch (event) {
    case 'created':
      return '생성';
    case 'restored':
      return '복구';
    case 'baseline':
      return '이전 상태';
    default:
      return '저장';
  }
};

const StatCard = ({ label, value }: { label: string; value: ReactNode }) => (
  <div className="rounded-lg border border-[color:var(--border)] bg-[var(--surface-muted)] p-3">
    <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--text-muted)]">
      {label}
    </p>
    <p className="mt-2 text-lg font-semibold text-[var(--text)]">{value}</p>
  </div>
);

const PostInspector: React.FC<PostInspectorProps> = ({
  embedded = false,
  activeId,
  draft,
  categoryTree,
  revisions,
  revisionsLoading,
  restoringRevisionId,
  contentStats,
  tagInput,
  onTagInputChange,
  onTagKeyDown,
  onTagBlur,
  onRemoveTag,
  onUpdateDraft,
  onCoverUpload,
  onRestoreRevision,
  tocItems,
  onTocLinkClick
}) => {
  return (
    <aside className={embedded ? 'space-y-4' : 'space-y-4 xl:sticky xl:top-28 self-start'}>
      <PostInspectorSection
        title="발행과 메타"
        description="카테고리, 일정, 대표 이미지, 요약을 이 패널에서 관리합니다."
        collapsible
        defaultOpen
      >
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-3">
            <StatCard label="상태" value={draft.status === 'draft' ? '초안' : draft.status === 'scheduled' ? '예약' : '발행'} />
            <StatCard label="읽기 시간" value={draft.readingTime || `${contentStats.readingMinutes}분`} />
            <StatCard label="대표 이미지" value={draft.cover ? '설정됨' : '없음'} />
          </div>
          {draft.cover && (
            <div className="overflow-hidden rounded-lg border border-[color:var(--border)] bg-[var(--surface-muted)]">
              <img
                src={draft.cover}
                alt="대표 이미지 미리보기"
                className="h-40 w-full object-cover"
              />
            </div>
          )}
          <PostMetadata
            draft={draft}
            updateDraft={onUpdateDraft}
            categoryTree={categoryTree}
            onCoverUpload={onCoverUpload}
            variant="inspector"
          />
        </div>
      </PostInspectorSection>

      <PostInspectorSection
        title="SEO"
        description="검색/공유에 노출되는 메타데이터를 조정합니다."
        collapsible
        defaultOpen={false}
      >
        <div className="space-y-3">
          <div className="space-y-1">
            <label className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--text-muted)]">
              SEO 제목
            </label>
            <input
              value={draft.seoTitle}
              onChange={(event) => onUpdateDraft({ seoTitle: event.target.value })}
              placeholder="검색 결과 제목"
              className="w-full rounded-lg border border-[color:var(--border)] bg-[var(--surface-muted)] px-3 py-2.5 text-sm text-[var(--text)] outline-none transition focus:border-[color:var(--accent)]"
            />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--text-muted)]">
              설명
            </label>
            <textarea
              value={draft.seoDescription}
              onChange={(event) => onUpdateDraft({ seoDescription: event.target.value })}
              rows={3}
              placeholder="검색 설명"
              className="w-full rounded-lg border border-[color:var(--border)] bg-[var(--surface-muted)] px-3 py-2.5 text-sm text-[var(--text)] outline-none transition focus:border-[color:var(--accent)]"
            />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--text-muted)]">
              OG 이미지
            </label>
            <input
              value={draft.seoOgImage}
              onChange={(event) => onUpdateDraft({ seoOgImage: event.target.value })}
              placeholder="https://..."
              className="w-full rounded-lg border border-[color:var(--border)] bg-[var(--surface-muted)] px-3 py-2.5 text-sm text-[var(--text)] outline-none transition focus:border-[color:var(--accent)]"
            />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--text-muted)]">
              Canonical URL
            </label>
            <input
              value={draft.seoCanonicalUrl}
              onChange={(event) => onUpdateDraft({ seoCanonicalUrl: event.target.value })}
              placeholder="https://example.com/posts/slug"
              className="w-full rounded-lg border border-[color:var(--border)] bg-[var(--surface-muted)] px-3 py-2.5 text-sm text-[var(--text)] outline-none transition focus:border-[color:var(--accent)]"
            />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--text-muted)]">
              키워드
            </label>
            <input
              value={draft.seoKeywords}
              onChange={(event) => onUpdateDraft({ seoKeywords: event.target.value })}
              placeholder="react, vite, cms"
              className="w-full rounded-lg border border-[color:var(--border)] bg-[var(--surface-muted)] px-3 py-2.5 text-sm text-[var(--text)] outline-none transition focus:border-[color:var(--accent)]"
            />
          </div>
        </div>
      </PostInspectorSection>

      <PostInspectorSection
        title="태그와 통계"
        description="태그를 정리하고 문서 분량을 확인합니다."
        collapsible
        defaultOpen={false}
      >
        <div className="grid grid-cols-3 gap-3">
          <StatCard label="문자 수" value={contentStats.chars} />
          <StatCard label="단어 수" value={contentStats.words} />
          <StatCard label="예상 읽기" value={`${contentStats.readingMinutes}분`} />
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          {draft.tags.map(tag => (
            <span
              key={tag}
              className="flex items-center gap-1 rounded-lg border border-[color:var(--border)] bg-[var(--surface-muted)] px-3 py-1 text-[11px] text-[var(--text-muted)]"
            >
              #{tag}
              <button
                type="button"
                onClick={() => onRemoveTag(tag)}
                className="text-[10px] transition hover:text-red-500"
                aria-label="태그 삭제"
              >
                ×
              </button>
            </span>
          ))}
          <input
            value={tagInput}
            onChange={(event) => onTagInputChange(event.target.value)}
            onKeyDown={onTagKeyDown}
            onBlur={onTagBlur}
            placeholder="태그 입력 후 Enter"
            className="min-w-[160px] flex-1 rounded-lg border border-[color:var(--border)] bg-[var(--surface-muted)] px-4 py-2 text-xs text-[var(--text)] outline-none transition focus:border-[color:var(--accent)]"
          />
        </div>
      </PostInspectorSection>

      <PostInspectorSection
        title="리비전"
        description="최근 저장본을 확인하고 원하는 시점으로 복구합니다."
        action={
          activeId ? (
            <span className="rounded-lg bg-[var(--surface-muted)] px-2.5 py-1 text-[10px] font-semibold text-[var(--text-muted)]">
              {revisions.length}개
            </span>
          ) : undefined
        }
        collapsible
        defaultOpen={false}
      >
        {!activeId ? (
          <p className="text-xs text-[var(--text-muted)]">글을 먼저 저장하면 리비전이 생성됩니다.</p>
        ) : revisionsLoading ? (
          <p className="text-xs text-[var(--text-muted)]">리비전을 불러오는 중입니다.</p>
        ) : revisions.length === 0 ? (
          <p className="text-xs text-[var(--text-muted)]">아직 저장된 리비전이 없습니다.</p>
        ) : (
          <div className="space-y-3">
            {revisions.slice(0, 5).map(revision => (
              <div
                key={revision.id}
                className="rounded-lg border border-[color:var(--border)] bg-[var(--surface-muted)] px-3 py-3"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-md bg-[var(--surface)] px-2 py-0.5 text-[10px] font-semibold text-[var(--accent-strong)]">
                    {describeRevisionEvent(revision.event)}
                  </span>
                  <span className="text-[11px] text-[var(--text-muted)]">
                    {formatRevisionLabel(revision.savedAt)}
                  </span>
                </div>
                <p className="mt-2 truncate text-sm font-medium text-[var(--text)]">{revision.title}</p>
                <p className="truncate text-[11px] text-[var(--text-muted)]">/{revision.slug}</p>
                <button
                  type="button"
                  onClick={() => onRestoreRevision(revision.id)}
                  disabled={Boolean(restoringRevisionId)}
                  className="mt-3 rounded-lg border border-[color:var(--border)] px-3 py-1.5 text-[11px] font-semibold text-[var(--text)] transition hover:border-[color:var(--accent)] hover:text-[var(--accent-strong)] disabled:opacity-50"
                >
                  {restoringRevisionId === revision.id ? '복구 중...' : '이 리비전 복구'}
                </button>
              </div>
            ))}
          </div>
        )}
      </PostInspectorSection>

      {tocItems.length > 0 && (
        <PostInspectorSection
          title="목차"
          description="문서 구조를 보면서 원하는 제목으로 빠르게 이동합니다."
        >
          <TableOfContents
            tocItems={tocItems}
            onLinkClick={onTocLinkClick}
            className="rounded-lg border border-[color:var(--border)] bg-[var(--surface-muted)] p-4"
          />
        </PostInspectorSection>
      )}
    </aside>
  );
};

export default PostInspector;
