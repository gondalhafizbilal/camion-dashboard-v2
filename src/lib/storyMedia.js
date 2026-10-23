export const STORY_MEDIA_TYPE_OPTIONS = ['image', 'video'];
const VIDEO_EXTENSIONS = ['mp4', 'mov', 'webm', 'm4v', 'avi', 'mkv', 'wmv', 'flv'];
const IMAGE_EXTENSIONS = ['jpg', 'jpeg', 'png', 'webp', 'gif', 'bmp', 'svg', 'avif'];

export function normalizeStoryMediaType(value) {
  const normalized = String(value || '').trim().toLowerCase();
  return STORY_MEDIA_TYPE_OPTIONS.includes(normalized) ? normalized : 'image';
}

export function getFrameMediaType(frame) {
  return normalizeStoryMediaType(frame?.mediaType || frame?.media_type);
}

export function getMediaTypeFromUrl(url, fallback = 'image') {
  const source = String(url || '').trim();
  if (!source) return normalizeStoryMediaType(fallback);

  const noQuery = source.split('?')[0].split('#')[0];
  const extension = noQuery.includes('.') ? noQuery.split('.').pop().toLowerCase() : '';

  if (VIDEO_EXTENSIONS.includes(extension)) return 'video';
  if (IMAGE_EXTENSIONS.includes(extension)) return 'image';

  return normalizeStoryMediaType(fallback);
}

export function getResolvedFrameMediaType(frame) {
  return getMediaTypeFromUrl(frame?.mediaUrl, getFrameMediaType(frame));
}
