const YOUTUBE_EMBED_ORIGINS = new Set([
  'https://www.youtube.com',
  'https://www.youtube-nocookie.com'
]);

const VIDEO_ID = /^[A-Za-z0-9_-]{11}$/;
const PLAYLIST_ID = /^[A-Za-z0-9_-]{10,100}$/;
const BOOLEAN_PARAMETERS = new Set([
  'autoplay', 'controls', 'fs', 'mute', 'loop', 'rel', 'playsinline',
  'cc_load_policy', 'disablekb', 'modestbranding'
]);

/** Only embeddable YouTube documents may become public iframes. */
export const normalizeYoutubeEmbedUrl = (value = ''): string | null => {
  try {
    const url = new URL(value);
    if (!YOUTUBE_EMBED_ORIGINS.has(url.origin) || url.username || url.password) return null;
    const id = url.pathname.match(/^\/embed\/([A-Za-z0-9_-]+)$/)?.[1];
    if (!id) return null;
    const playlist = id === 'videoseries';
    const list = url.searchParams.get('list');
    if (playlist ? !list || !PLAYLIST_ID.test(list) : !VIDEO_ID.test(id)) return null;

    // Rebuild the URL so unrelated parameters cannot enable the iframe API or
    // carry an arbitrary origin. Preserve the player's normal display options.
    const safeUrl = new URL(url.pathname, url.origin);
    if (playlist && list) safeUrl.searchParams.set('list', list);
    for (const [key, parameter] of url.searchParams) {
      if (BOOLEAN_PARAMETERS.has(key) && /^[01]$/.test(parameter)) {
        safeUrl.searchParams.set(key, parameter);
      } else if (['start', 'end'].includes(key) && /^\d{1,7}$/.test(parameter)) {
        safeUrl.searchParams.set(key, parameter);
      } else if (key === 'iv_load_policy' && /^[13]$/.test(parameter)) {
        safeUrl.searchParams.set(key, parameter);
      } else if (['hl', 'cc_lang_pref'].includes(key) && /^[A-Za-z]{2,3}(?:-[A-Za-z0-9]{2,8})*$/.test(parameter)) {
        safeUrl.searchParams.set(key, parameter);
      } else if (key === 'color' && ['red', 'white'].includes(parameter)) {
        safeUrl.searchParams.set(key, parameter);
      } else if (key === 'playlist' && parameter.split(',').every(video => VIDEO_ID.test(video))) {
        safeUrl.searchParams.set(key, parameter);
      }
    }
    return safeUrl.href;
  } catch {
    return null;
  }
};
