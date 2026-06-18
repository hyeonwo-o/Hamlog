import type { SiteMeta, TopicHighlight } from '../types/blog';

export * from '../types/blog';

export const siteMeta: SiteMeta = {
  title: 'Ham_Tech_Log',
  name: 'Author Name',
  role: 'Role',
  tagline: 'Tagline',
  description: '클라우드 엔지니어링, 인프라, DevOps, 개발 경험을 기록하는 기술 블로그입니다.',
  location: 'Location',
  profileImage: '/avatar.jpg',
  favicon: '/avatar.jpg',
  email: '',
  siteUrl: 'https://tech.hamwoo.co.kr',
  social: {
    github: '',
    linkedin: '',
    twitter: '',
    instagram: ''
  },
  stack: [],
  now: '',
  display: {
    showProfileImage: true,
    showLocation: true,
    showEmail: true,
    showSocialLinks: true,
    showNow: true,
    showStack: true
  }
};

export const topicHighlights: TopicHighlight[] = [];
