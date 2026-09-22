import { useCallback, useRef, useState, type SetStateAction } from 'react';
import { fetchProfile, updateProfile } from '../api/profileApi';
import { siteMeta, type SiteMeta } from '../data/blogData';

const PROFILE_DRAFT_STORAGE_KEY = 'hamlog-admin-profile-draft';
const PROFILE_SAVED_NOTICE = '자기소개 정보가 저장되었습니다.';

const equalValues = (left: unknown, right: unknown) => JSON.stringify(left) === JSON.stringify(right);

// Apply server normalization only to fields that still match the submitted draft.
// Collections such as stack are one field; social/display are merged per setting.
const mergeSavedFields = <T extends object>(submitted: T, current: T, saved: T): T => {
  const merged = { ...saved };
  for (const key of Object.keys(current) as (keyof T)[]) {
    if (!equalValues(current[key], submitted[key])) merged[key] = current[key];
  }
  return merged;
};

const mergeSavedProfile = (submitted: SiteMeta, current: SiteMeta, saved: SiteMeta): SiteMeta => ({
  ...mergeSavedFields(submitted, current, saved),
  social: mergeSavedFields(submitted.social, current.social, saved.social),
  display: mergeSavedFields(submitted.display, current.display, saved.display)
});

const normalizeProfileDraft = (profile: SiteMeta): SiteMeta => ({
  ...profile,
  favicon: profile.favicon ?? siteMeta.favicon ?? '/avatar.jpg',
  siteUrl: profile.siteUrl ?? siteMeta.siteUrl,
  social: {
    github: profile.social?.github ?? '',
    linkedin: profile.social?.linkedin ?? '',
    twitter: profile.social?.twitter ?? '',
    instagram: profile.social?.instagram ?? '',
    threads: profile.social?.threads ?? '',
    telegram: profile.social?.telegram ?? ''
  },
  stack: profile.stack ?? [],
  display: {
    ...siteMeta.display,
    ...(profile.display ?? {})
  }
});

const canUseStorage = () => typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';

const writeCachedProfileDraft = (profile: SiteMeta) => {
  if (!canUseStorage()) return;
  try {
    window.localStorage.setItem(PROFILE_DRAFT_STORAGE_KEY, JSON.stringify(profile));
  } catch (error) {
    console.error('Failed to cache temporary profile draft', error);
  }
};

const readCachedProfileDraft = (): SiteMeta | null => {
  if (!canUseStorage()) return null;
  try {
    const raw = window.localStorage.getItem(PROFILE_DRAFT_STORAGE_KEY);
    if (!raw) return null;
    return normalizeProfileDraft(JSON.parse(raw) as SiteMeta);
  } catch (error) {
    console.error('Failed to read cached temporary profile draft', error);
    return null;
  }
};

const createTemporaryProfileDraft = (seed?: Partial<SiteMeta>): SiteMeta =>
  normalizeProfileDraft({
    ...siteMeta,
    ...seed,
    favicon: seed?.favicon ?? siteMeta.favicon ?? '/avatar.jpg',
    siteUrl: seed?.siteUrl ?? siteMeta.siteUrl,
    social: {
      ...siteMeta.social,
      ...(seed?.social ?? {})
    },
    stack: seed?.stack ?? siteMeta.stack ?? []
  });

export const useProfile = () => {
  const [profileDraft, setProfileDraftState] = useState<SiteMeta | null>(null);
  const profileDraftRef = useRef<SiteMeta | null>(null);
  const saveInFlightRef = useRef(false);
  const [savedProfile, setSavedProfile] = useState<SiteMeta | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  // Keep request completions and repeated same-turn actions in sync with the
  // newest input, without putting cache writes inside React state updaters.
  const setProfileDraft = useCallback((value: SetStateAction<SiteMeta | null>) => {
    const next = typeof value === 'function' ? value(profileDraftRef.current) : value;
    profileDraftRef.current = next;
    setProfileDraftState(next);
    if (next) writeCachedProfileDraft(next);
  }, []);

  const loadProfile = useCallback(async () => {
    setLoading(true);
    setError('');
    setNotice('');
    try {
      const profile = await fetchProfile();
      const normalized = normalizeProfileDraft(profile);
      setProfileDraft(normalized);
      setSavedProfile(normalized);
    } catch (err) {
      const message =
        err instanceof Error && err.message
          ? err.message
          : '소개 정보를 불러오지 못했습니다.';
      const cachedDraft = readCachedProfileDraft();
      const temporaryDraft = cachedDraft ?? createTemporaryProfileDraft();
      setProfileDraft(temporaryDraft);
      setSavedProfile(null);
      setError(message);
      setNotice(
        cachedDraft
          ? '프로필을 불러오지 못해 마지막 임시 프로필 초안을 열었습니다. 저장하면 서버에 다시 반영됩니다.'
          : '프로필을 불러오지 못해 임시 프로필 초안을 생성했습니다. 저장하면 서버에 반영됩니다.'
      );
    } finally {
      setLoading(false);
    }
  }, [setProfileDraft]);

  const updateProfileField = useCallback(
    <K extends keyof SiteMeta>(key: K, value: SiteMeta[K]) => {
      setProfileDraft(prev => {
        if (!prev) return prev;
        return { ...prev, [key]: value };
      });
    },
    [setProfileDraft]
  );

  const updateProfileSocial = useCallback(
    (key: keyof SiteMeta['social'], value: string) => {
      setProfileDraft(prev => {
        if (!prev) return prev;
        return { ...prev, social: { ...prev.social, [key]: value } };
      });
    },
    [setProfileDraft]
  );

  const saveProfile = useCallback(async () => {
    const submitted = profileDraftRef.current;
    if (!submitted || saveInFlightRef.current) return;
    const requiredFields = [
      { key: 'title', label: '블로그 이름' },
      { key: 'name', label: '이름' },
      { key: 'role', label: '역할' },
      { key: 'description', label: '소개 문장' }
    ] as const;
    for (const field of requiredFields) {
      const value = String(submitted[field.key] ?? '').trim();
      if (!value) {
        setError(`${field.label}을(를) 입력하세요.`);
        return;
      }
    }
    saveInFlightRef.current = true;
    setSaving(true);
    setError('');
    setNotice('');
    try {
      const payload: SiteMeta = {
        ...submitted,
        title: submitted.title.trim(),
        name: submitted.name.trim(),
        role: submitted.role.trim(),
        tagline: submitted.tagline.trim(),
        description: submitted.description.trim(),
        location: submitted.location.trim(),
        profileImage: submitted.profileImage.trim(),
        favicon: submitted.favicon?.trim() || '/avatar.jpg',
        email: submitted.email.trim(),
        siteUrl: submitted.siteUrl.trim(),
        now: submitted.now.trim(),
        stack: submitted.stack,
        social: {
          github: submitted.social.github?.trim() ?? '',
          linkedin: submitted.social.linkedin?.trim() ?? '',
          twitter: submitted.social.twitter?.trim() ?? '',
          instagram: submitted.social.instagram?.trim() ?? '',
          threads: submitted.social.threads?.trim() ?? '',
          telegram: submitted.social.telegram?.trim() ?? ''
        },
        display: submitted.display
      };
      const saved = await updateProfile(payload);
      const normalized = normalizeProfileDraft(saved);
      setSavedProfile(normalized);
      setProfileDraft(current => current ? mergeSavedProfile(submitted, current, normalized) : current);
      setNotice(PROFILE_SAVED_NOTICE);
    } catch (err) {
      const message =
        err instanceof Error && err.message ? err.message : '저장에 실패했습니다.';
      setError(message);
    } finally {
      saveInFlightRef.current = false;
      setSaving(false);
    }
  }, [setProfileDraft]);

  const currentNotice = notice === PROFILE_SAVED_NOTICE && savedProfile && !equalValues(profileDraft, savedProfile)
    ? '자기소개 정보가 저장되었습니다. 저장되지 않은 변경이 남아 있습니다.'
    : notice;

  return {
    profileDraft,
    setProfileDraft,
    loading,
    saving,
    error,
    notice: currentNotice,
    loadProfile,
    saveProfile,
    updateProfileField,
    updateProfileSocial
  };
};
