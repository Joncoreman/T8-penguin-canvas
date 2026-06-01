export type ImagePreviewSize = {
  width: number;
  height: number;
};

export type ImagePreviewRect = ImagePreviewSize & {
  left: number;
  top: number;
  right: number;
  bottom: number;
};

const DEFAULT_PREVIEW_SIZE: ImagePreviewSize = { width: 320, height: 240 };
const MAX_VIEWPORT_RATIO = 0.8;
const PREVIEW_MARGIN = 12;
const PREVIEW_GAP = 12;

function safeDimension(value: number, fallback: number) {
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

function clamp(value: number, min: number, max: number) {
  if (max < min) return min;
  return Math.min(Math.max(value, min), max);
}

export function fitImagePreviewSize(
  naturalSize: Partial<ImagePreviewSize> | null | undefined,
  viewport: ImagePreviewSize,
): ImagePreviewSize {
  const naturalWidth = safeDimension(naturalSize?.width ?? 0, DEFAULT_PREVIEW_SIZE.width);
  const naturalHeight = safeDimension(naturalSize?.height ?? 0, DEFAULT_PREVIEW_SIZE.height);
  const maxWidth = Math.max(80, Math.floor(safeDimension(viewport.width, DEFAULT_PREVIEW_SIZE.width) * MAX_VIEWPORT_RATIO));
  const maxHeight = Math.max(80, Math.floor(safeDimension(viewport.height, DEFAULT_PREVIEW_SIZE.height) * MAX_VIEWPORT_RATIO));
  const scale = Math.min(1, maxWidth / naturalWidth, maxHeight / naturalHeight);

  return {
    width: Math.max(1, Math.round(naturalWidth * scale)),
    height: Math.max(1, Math.round(naturalHeight * scale)),
  };
}

export function placeImagePreviewPanel(
  anchor: ImagePreviewRect,
  naturalSize: Partial<ImagePreviewSize> | null | undefined,
  viewport: ImagePreviewSize,
): ImagePreviewSize & { left: number; top: number } {
  const size = fitImagePreviewSize(naturalSize, viewport);
  const viewportWidth = safeDimension(viewport.width, DEFAULT_PREVIEW_SIZE.width);
  const viewportHeight = safeDimension(viewport.height, DEFAULT_PREVIEW_SIZE.height);
  const maxLeft = viewportWidth - PREVIEW_MARGIN - size.width;
  const maxTop = viewportHeight - PREVIEW_MARGIN - size.height;
  const rightSideLeft = anchor.right + PREVIEW_GAP;
  const leftSideLeft = anchor.left - PREVIEW_GAP - size.width;
  const hasRightRoom = rightSideLeft + size.width <= viewportWidth - PREVIEW_MARGIN;
  const preferredLeft = hasRightRoom ? rightSideLeft : leftSideLeft;

  return {
    left: clamp(preferredLeft, PREVIEW_MARGIN, maxLeft),
    top: clamp(anchor.top, PREVIEW_MARGIN, maxTop),
    width: size.width,
    height: size.height,
  };
}
