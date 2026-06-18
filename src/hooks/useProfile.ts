import { useCallback, useState } from 'react';
import { fetchProfile, updateProfile } from '../api/profileApi';
import { siteMeta, type SiteMeta } from '../data/blogData';

const PROFILE_DRAFT_STORAGE_KEY = 'hamlog-admin-profile-draft';

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
  const [profileDraft, setProfileDraft] = useState<SiteMeta | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const loadProfile = useCallback(async () => {
    setLoading(true);
    setError('');
    setNotice('');
    try {
      const profile = await fetchProfile();
      const normalized = normalizeProfileDraft(profile);
      setProfileDraft(normalized);
      writeCachedProfileDraft(normalized);
    } catch (err) {
      const message =
        err instanceof Error && err.message
          ? err.message
          : '소개 정보를 불러오지 못했습니다.';
      const cachedDraft = readCachedProfileDraft();
      const temporaryDraft = cachedDraft ?? createTemporaryProfileDraft();
      setProfileDraft(temporaryDraft);
      setError(message);
      setNotice(
        cachedDraft
          ? '프로필을 불러오지 못해 마지막 임시 프로필 초안을 열었습니다. 저장하면 서버에 다시 반영됩니다.'
          : '프로필을 불러오지 못해 임시 프로필 초안을 생성했습니다. 저장하면 서버에 반영됩니다.'
      );
    } finally {
      setLoading(false);
    }
  }, []);

  const updateProfileField = useCallback(
    <K extends keyof SiteMeta>(key: K, value: SiteMeta[K]) => {
      setProfileDraft(prev => {
        if (!prev) return prev;
        const next = { ...prev, [key]: value };
        writeCachedProfileDraft(next);
        return next;
      });
    },
    []
  );

  const updateProfileSocial = useCallback(
    (key: keyof SiteMeta['social'], value: string) => {
      setProfileDraft(prev => {
        if (!prev) return prev;
        const next = { ...prev, social: { ...prev.social, [key]: value } };
        writeCachedProfileDraft(next);
        return next;
      });
    },
    []
  );

  const saveProfile = useCallback(async () => {
    if (!profileDraft || saving) return;
    const requiredFields = [
      { key: 'title', label: '블로그 이름' },
      { key: 'name', label: '이름' },
      { key: 'role', label: '역할' },
      { key: 'description', label: '소개 문장' }
    ] as const;
    for (const field of requiredFields) {
      const value = String(profileDraft[field.key] ?? '').trim();
      if (!value) {
        setError(`${field.label}을(를) 입력하세요.`);
        return;
      }
    }
    setSaving(true);
    setError('');
    setNotice('');
    try {
      const payload: SiteMeta = {
        ...profileDraft,
        title: profileDraft.title.trim(),
        name: profileDraft.name.trim(),
        role: profileDraft.role.trim(),
        tagline: profileDraft.tagline.trim(),
        description: profileDraft.description.trim(),
        location: profileDraft.location.trim(),
        profileImage: profileDraft.profileImage.trim(),
        favicon: profileDraft.favicon?.trim() || '/avatar.jpg',
        email: profileDraft.email.trim(),
        siteUrl: profileDraft.siteUrl.trim(),
        now: profileDraft.now.trim(),
        stack: profileDraft.stack, // Use array directly
        social: {
          github: profileDraft.social.github?.trim() ?? '',
          linkedin: profileDraft.social.linkedin?.trim() ?? '',
          twitter: profileDraft.social.twitter?.trim() ?? '',
          instagram: profileDraft.social.instagram?.trim() ?? '',
          threads: profileDraft.social.threads?.trim() ?? '',
          telegram: profileDraft.social.telegram?.trim() ?? ''
        },
        display: profileDraft.display
      };
      const saved = await updateProfile(payload);
      const normalized = normalizeProfileDraft(saved);
      setProfileDraft(normalized);
      writeCachedProfileDraft(normalized);
      setNotice('자기소개 정보가 저장되었습니다.');
    } catch (err) {
      const message =
        err instanceof Error && err.message ? err.message : '저장에 실패했습니다.';
      setError(message);
    } finally {
      setSaving(false);
    }
  }, [profileDraft, saving]);

  return {
    profileDraft,
    setProfileDraft,
    loading,
    saving,
    error,
    notice,
    loadProfile,
    saveProfile,
    updateProfileField,
    updateProfileSocial
  };
};
