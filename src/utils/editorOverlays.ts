export const EDITOR_CLOSE_OVERLAYS_EVENT = 'hamlog:editor-close-overlays';

export const closeEditorOverlays = () => {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new Event(EDITOR_CLOSE_OVERLAYS_EVENT));
};
