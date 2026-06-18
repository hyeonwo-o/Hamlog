import { RefreshCw, Save } from 'lucide-react';

interface ProfileWorkspaceHeaderProps {
  profileNotice: string;
  profileError: string;
  profileSaving: boolean;
  profileLoading: boolean;
  onReload: () => void;
  onSave: () => void;
}

const ProfileWorkspaceHeader = ({
  profileNotice,
  profileError,
  profileSaving,
  profileLoading,
  onReload,
  onSave
}: ProfileWorkspaceHeaderProps) => (
  <div className="rounded-xl border border-[color:var(--border)] bg-[var(--surface)] p-6">
    <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--text-muted)]">
          자기소개 워크스페이스
        </p>
        <h2 className="mt-2 font-display text-2xl font-semibold text-[var(--text)]">
          방문자가 보는 소개와 브랜드 정보를 한 번에 관리합니다.
        </h2>
        <p className="mt-2 text-sm text-[var(--text-muted)]">
          홈 헤더와 소개 영역에 바로 반영되는 핵심 정보만 모아 놓았습니다.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {profileNotice && (
          <span className="rounded-lg border border-[color:var(--border)] bg-[var(--surface-muted)] px-3 py-1 text-[11px] text-[var(--text-muted)]">
            {profileNotice}
          </span>
        )}
        {profileError && (
          <span className="rounded-lg border border-red-200 bg-red-50 px-3 py-1 text-[11px] text-red-600">
            {profileError}
          </span>
        )}
        <button
          type="button"
          onClick={onReload}
          disabled={profileSaving || profileLoading}
          className="inline-flex items-center gap-2 rounded-lg border border-[color:var(--border)] bg-[var(--surface)] px-4 py-2 text-xs font-semibold text-[var(--text)] transition hover:border-[color:var(--accent)] hover:text-[var(--accent-strong)] disabled:opacity-50"
        >
          <RefreshCw size={14} />
          되돌리기
        </button>
        <button
          type="button"
          onClick={onSave}
          disabled={profileSaving}
          className="inline-flex items-center gap-2 rounded-lg bg-[var(--text)] px-4 py-2 text-xs font-semibold text-[var(--bg)] transition hover:opacity-90 disabled:opacity-50"
        >
          <Save size={14} />
          {profileSaving ? '저장 중...' : '소개 저장'}
        </button>
      </div>
    </div>
  </div>
);

export default ProfileWorkspaceHeader;
