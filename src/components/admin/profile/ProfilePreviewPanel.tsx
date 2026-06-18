import { ImagePlus, Mail, MapPin, Sparkles } from 'lucide-react';
import type { SiteMeta } from '../../../data/blogData';
import type { ProfileStats, SocialPreviewItem } from './types';

interface ProfilePreviewPanelProps {
  profileDraft: SiteMeta;
  profileStats: ProfileStats;
  socialPreviewItems: SocialPreviewItem[];
  identityFallback: string;
}

const ProfilePreviewPanel = ({
  profileDraft,
  profileStats,
  socialPreviewItems,
  identityFallback
}: ProfilePreviewPanelProps) => (
  <aside className="space-y-6 xl:sticky xl:top-24 xl:self-start">
    <div className="overflow-hidden rounded-xl border border-[color:var(--border)] bg-[var(--surface)]">
      <div className="border-b border-[color:var(--border)] bg-[radial-gradient(circle_at_top_left,rgba(19,144,116,0.18),transparent_48%),linear-gradient(180deg,var(--surface-muted),var(--surface))] px-6 py-6">
        <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--text-muted)]">
          라이브 미리보기
        </p>
        <div className="mt-4 flex items-start gap-4">
          {profileDraft.display.showProfileImage && profileDraft.profileImage ? (
            <img
              src={profileDraft.profileImage}
              alt={`${profileDraft.name || profileDraft.title} 프로필 이미지`}
              className="h-20 w-20 rounded-lg border border-white/40 object-cover"
            />
          ) : (
            <div className="flex h-20 w-20 items-center justify-center rounded-lg border border-dashed border-[color:var(--border)] bg-[var(--surface)] font-display text-lg font-semibold text-[var(--text-muted)]">
              {identityFallback}
            </div>
          )}

          <div className="min-w-0">
            <p className="text-[11px] uppercase tracking-[0.18em] text-[var(--text-muted)]">
              {profileDraft.title || '블로그 제목'}
            </p>
            <h2 className="mt-2 font-display text-2xl font-semibold leading-tight text-[var(--text)]">
              {profileDraft.name || '이름을 입력하세요'}
            </h2>
            <p className="mt-1 text-sm text-[var(--text-muted)]">
              {profileDraft.role || '역할을 입력하면 여기에서 바로 보입니다.'}
            </p>
          </div>
        </div>

        <div className="mt-5 flex flex-wrap gap-2">
          {profileDraft.display.showLocation && profileDraft.location && (
            <span className="inline-flex items-center gap-1.5 rounded-lg border border-[color:var(--border)] bg-[var(--surface)]/80 px-3 py-1 text-[11px] text-[var(--text-muted)]">
              <MapPin size={12} />
              {profileDraft.location}
            </span>
          )}
          {profileDraft.display.showEmail && profileDraft.email && (
            <span className="inline-flex items-center gap-1.5 rounded-lg border border-[color:var(--border)] bg-[var(--surface)]/80 px-3 py-1 text-[11px] text-[var(--text-muted)]">
              <Mail size={12} />
              {profileDraft.email}
            </span>
          )}
        </div>
      </div>

      <div className="space-y-6 px-6 py-6">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--text-muted)]">
            카피
          </p>
          <p className="mt-2 font-display text-xl font-semibold leading-snug text-[var(--text)]">
            {profileDraft.tagline || '태그라인을 입력해 홈 헤더의 첫 인상을 정리하세요.'}
          </p>
          <p className="mt-3 text-sm leading-6 text-[var(--text-muted)]">
            {profileDraft.description || '소개 문장은 방문자에게 무엇을 쓰는 블로그인지 빠르게 설명해 줍니다.'}
          </p>
        </div>

        <div>
          <div className="flex items-center justify-between text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--text-muted)]">
            <span>완성도</span>
            <span>{profileStats.completionRate}%</span>
          </div>
          <div className="mt-2 h-2 overflow-hidden rounded-sm bg-[var(--surface-muted)]">
            <div
              className="h-full rounded-sm bg-[var(--accent)] transition-all"
              style={{ width: `${profileStats.completionRate}%` }}
            />
          </div>
          <div className="mt-4 grid grid-cols-3 gap-3 text-center">
            <div className="rounded-lg border border-[color:var(--border)] bg-[var(--surface-muted)] px-3 py-3">
              <p className="font-display text-lg font-semibold text-[var(--text)]">
                {profileStats.completedBaseFields}/{profileStats.totalBaseFields}
              </p>
              <p className="mt-1 text-[10px] uppercase tracking-[0.16em] text-[var(--text-muted)]">
                기본 정보
              </p>
            </div>
            <div className="rounded-lg border border-[color:var(--border)] bg-[var(--surface-muted)] px-3 py-3">
              <p className="font-display text-lg font-semibold text-[var(--text)]">
                {profileDraft.stack.length}
              </p>
              <p className="mt-1 text-[10px] uppercase tracking-[0.16em] text-[var(--text-muted)]">
                스택
              </p>
            </div>
            <div className="rounded-lg border border-[color:var(--border)] bg-[var(--surface-muted)] px-3 py-3">
              <p className="font-display text-lg font-semibold text-[var(--text)]">
                {profileStats.socialCount}
              </p>
              <p className="mt-1 text-[10px] uppercase tracking-[0.16em] text-[var(--text-muted)]">
                소셜
              </p>
            </div>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
          {profileDraft.display.showNow && (
            <div className="rounded-lg border border-[color:var(--border)] bg-[var(--surface-muted)] p-4">
              <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--text-muted)]">
                <Sparkles size={14} />
                지금
              </div>
              <p className="mt-3 text-sm leading-6 text-[var(--text)]">
                {profileDraft.now || '현재 집중하고 있는 일이나 관심사를 적어 보세요.'}
              </p>
            </div>
          )}
          <div className="rounded-lg border border-[color:var(--border)] bg-[var(--surface-muted)] p-4">
            <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--text-muted)]">
              <ImagePlus size={14} />
              자산
            </div>
            <p className="mt-3 text-sm text-[var(--text)]">
              프로필/파비콘 {profileStats.assetCount}/2 설정됨
            </p>
          </div>
        </div>

        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--text-muted)]">
            연결된 채널
          </p>
          {profileDraft.display.showSocialLinks && socialPreviewItems.length ? (
            <div className="mt-3 flex flex-wrap gap-2">
              {socialPreviewItems.map(item => {
                const Icon = item.icon;
                return (
                  <span
                    key={item.key}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-[color:var(--border)] bg-[var(--surface-muted)] px-3 py-1 text-[11px] text-[var(--text-muted)]"
                  >
                    <Icon size={12} />
                    {item.label}
                  </span>
                );
              })}
            </div>
          ) : (
            <p className="mt-3 text-sm text-[var(--text-muted)]">
              {profileDraft.display.showSocialLinks
                ? '아직 연결된 외부 채널이 없습니다.'
                : '소셜 링크 노출이 꺼져 있습니다.'}
            </p>
          )}
        </div>

        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--text-muted)]">
            주력 스택
          </p>
          {profileDraft.display.showStack && profileDraft.stack.length ? (
            <div className="mt-3 flex flex-wrap gap-2">
              {profileDraft.stack.map(item => (
                <span
                  key={item}
                  className="rounded-lg border border-[color:var(--border)] bg-[var(--surface-muted)] px-3 py-1 text-[11px] text-[var(--text-muted)]"
                >
                  {item}
                </span>
              ))}
            </div>
          ) : (
            <p className="mt-3 text-sm text-[var(--text-muted)]">
              {profileDraft.display.showStack
                ? '스택 태그를 추가하면 소개 카드와 홈 헤더에 노출할 준비가 됩니다.'
                : '주력 스택 노출이 꺼져 있습니다.'}
            </p>
          )}
        </div>
      </div>
    </div>

    <div className="rounded-xl border border-[color:var(--border)] bg-[var(--surface)] p-5">
      <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--text-muted)]">
        작성 팁
      </p>
      <ul className="mt-3 space-y-2 text-sm leading-6 text-[var(--text-muted)]">
        <li>태그라인은 방문자가 첫 5초 안에 이해할 수 있는 한 문장으로 유지하는 편이 좋습니다.</li>
        <li>`지금` 필드는 최신 관심사나 진행 중인 프로젝트를 적으면 홈 화면이 덜 정적으로 보입니다.</li>
        <li>소셜 링크는 많이 넣기보다 실제로 응답 가능한 채널 위주로 남기는 게 좋습니다.</li>
      </ul>
    </div>
  </aside>
);

export default ProfilePreviewPanel;
