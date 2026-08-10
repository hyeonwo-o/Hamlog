import React from 'react';
import type { Post } from '../../../data/blogData';
import type { DashboardStats } from '../../../types/admin';
import { formatDate } from '../../../utils/formatDate';
import { formatScheduleLabel } from '../../../utils/adminDate';
import AnalyticsSummaryPanel from '../dashboard/AnalyticsSummaryPanel';
import type { AnalyticsSummary } from '../../../types/analytics';

interface DashboardSectionProps {
  stats: DashboardStats;
  totalPosts: number;
  onSelectPost: (post: Post) => void;
  analyticsSummary: AnalyticsSummary | null;
  analyticsLoading: boolean;
  analyticsError: string;
  onRefreshAnalytics: () => void;
}

const DashboardSection: React.FC<DashboardSectionProps> = ({
  stats,
  totalPosts,
  onSelectPost,
  analyticsSummary,
  analyticsLoading,
  analyticsError,
  onRefreshAnalytics
}) => (
  <div className="space-y-4">
    <AnalyticsSummaryPanel
      summary={analyticsSummary}
      loading={analyticsLoading}
      error={analyticsError}
      onRefresh={onRefreshAnalytics}
    />

    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <div className="rounded-lg border border-[color:var(--border)] bg-[var(--surface)] px-4 py-3">
        <p className="text-[10px] uppercase tracking-[0.22em] text-[var(--text-muted)]">
          전체 글
        </p>
        <p className="mt-1 font-display text-xl font-semibold">{totalPosts}</p>
        <p className="text-xs text-[var(--text-muted)]">전체 기준</p>
      </div>
      <div className="rounded-lg border border-[color:var(--border)] bg-[var(--surface)] px-4 py-3">
        <p className="text-[10px] uppercase tracking-[0.22em] text-[var(--text-muted)]">
          발행
        </p>
        <p className="mt-1 font-display text-xl font-semibold">
          {stats.statusCount.published}
        </p>
        <p className="text-xs text-[var(--text-muted)]">
          현재 공개 {stats.visibleCount}
        </p>
      </div>
      <div className="rounded-lg border border-[color:var(--border)] bg-[var(--surface)] px-4 py-3">
        <p className="text-[10px] uppercase tracking-[0.22em] text-[var(--text-muted)]">
          예약
        </p>
        <p className="mt-1 font-display text-xl font-semibold">
          {stats.statusCount.scheduled}
        </p>
        <p className="text-xs text-[var(--text-muted)]">예약 대기 포함</p>
      </div>
      <div className="rounded-lg border border-[color:var(--border)] bg-[var(--surface)] px-4 py-3">
        <p className="text-[10px] uppercase tracking-[0.22em] text-[var(--text-muted)]">
          초안
        </p>
        <p className="mt-1 font-display text-xl font-semibold">
          {stats.statusCount.draft}
        </p>
        <p className="text-xs text-[var(--text-muted)]">작성 중 포함</p>
      </div>
    </div>

    <div className="grid gap-4 lg:grid-cols-[1.5fr_1fr]">
      <div className="rounded-lg border border-[color:var(--border)] bg-[var(--surface)] p-4">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-lg font-semibold">최근 발행</h2>
          <span className="text-xs text-[var(--text-muted)]">
            {stats.recentPublished.length}건
          </span>
        </div>
        {stats.recentPublished.length > 0 ? (
          <ul className="mt-3 space-y-2">
            {stats.recentPublished.map(post => (
              <li key={post.id}>
                <button
                  type="button"
                  onClick={() => onSelectPost(post)}
                  className="w-full rounded-lg border border-[color:var(--border)] bg-[var(--surface-muted)] px-3 py-2 text-left transition hover:border-[color:var(--accent)]"
                >
                  <p className="text-sm font-semibold text-[var(--text)]">
                    {post.title}
                  </p>
                  <p className="text-xs text-[var(--text-muted)]">
                    {formatDate(post.publishedAt)}
                  </p>
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-3 text-sm text-[var(--text-muted)]">
            아직 발행된 글이 없습니다.
          </p>
        )}
      </div>

      <div className="rounded-lg border border-[color:var(--border)] bg-[var(--surface)] p-4">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-lg font-semibold">예약 대기</h2>
          <span className="text-xs text-[var(--text-muted)]">
            {stats.upcomingScheduled.length}건
          </span>
        </div>
        {stats.upcomingScheduled.length > 0 ? (
          <ul className="mt-3 space-y-2">
            {stats.upcomingScheduled.map(post => (
              <li key={post.id}>
                <button
                  type="button"
                  onClick={() => onSelectPost(post)}
                  className="w-full rounded-lg border border-[color:var(--border)] bg-[var(--surface-muted)] px-3 py-2 text-left transition hover:border-[color:var(--accent)]"
                >
                  <p className="text-sm font-semibold text-[var(--text)]">
                    {post.title}
                  </p>
                  <p className="text-xs text-[var(--text-muted)]">
                    {formatScheduleLabel(post.scheduledAt) || '예약 시간 없음'}
                  </p>
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-3 text-sm text-[var(--text-muted)]">
            예약된 글이 없습니다.
          </p>
        )}
      </div>
    </div>

    <div className="grid gap-4 lg:grid-cols-[1.2fr_1fr]">
      <div className="rounded-lg border border-[color:var(--border)] bg-[var(--surface)] p-4">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-lg font-semibold">카테고리 분포</h2>
          <span className="text-xs text-[var(--text-muted)]">
            총 {stats.categoriesCount}개
          </span>
        </div>
        {stats.topCategories.length > 0 ? (
          <div className="mt-3 space-y-2">
            {stats.topCategories.map(category => (
              <div
                key={category.name}
                className="flex items-center justify-between rounded-lg border border-[color:var(--border)] bg-[var(--surface-muted)] px-3 py-2 text-sm text-[var(--text)]"
              >
                <span>{category.name}</span>
                <span className="text-xs text-[var(--text-muted)]">
                  {category.count}편
                </span>
              </div>
            ))}
          </div>
        ) : (
          <p className="mt-3 text-sm text-[var(--text-muted)]">
            카테고리가 아직 없습니다.
          </p>
        )}
      </div>

      <div className="rounded-lg border border-[color:var(--border)] bg-[var(--surface)] p-4">
        <h2 className="font-display text-lg font-semibold">콘텐츠 구조</h2>
        <div className="mt-3 space-y-2 text-sm text-[var(--text-muted)]">
          <div className="flex items-center justify-between">
            <span>태그 수</span>
            <span className="font-semibold text-[var(--text)]">{stats.tagsCount}</span>
          </div>
          <div className="flex items-center justify-between">
            <span>카테고리 수</span>
            <span className="font-semibold text-[var(--text)]">
              {stats.categoriesCount}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span>시리즈 수</span>
            <span className="font-semibold text-[var(--text)]">{stats.seriesCount}</span>
          </div>
        </div>
      </div>
    </div>
  </div>
);

export default DashboardSection;
