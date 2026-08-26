export const IMAGE_MIN_WIDTH_PERCENT = 25;
export const IMAGE_MAX_WIDTH_PERCENT = 100;
export const IMAGE_WIDTH_STEP_PERCENT = 5;

export const clampImageWidthPercent = (value: number) => {
  if (!Number.isFinite(value)) return IMAGE_MAX_WIDTH_PERCENT;
  return Math.min(
    IMAGE_MAX_WIDTH_PERCENT,
    Math.max(IMAGE_MIN_WIDTH_PERCENT, Math.round(value))
  );
};

export const parseImageWidthPercent = (value: unknown) => {
  if (typeof value !== 'string') return IMAGE_MAX_WIDTH_PERCENT;
  const match = value.trim().match(/^(\d+(?:\.\d+)?)%$/);
  if (!match) return IMAGE_MAX_WIDTH_PERCENT;
  return clampImageWidthPercent(Number(match[1]));
};

export const getKeyboardImageWidthPercent = (
  currentPercent: number,
  key: string,
  shiftKey = false
) => {
  const step = shiftKey ? 10 : IMAGE_WIDTH_STEP_PERCENT;
  if (key === 'ArrowRight' || key === 'ArrowUp') {
    return clampImageWidthPercent(currentPercent + step);
  }
  if (key === 'ArrowLeft' || key === 'ArrowDown') {
    return clampImageWidthPercent(currentPercent - step);
  }
  if (key === 'Home') return IMAGE_MIN_WIDTH_PERCENT;
  if (key === 'End') return IMAGE_MAX_WIDTH_PERCENT;
  return null;
};

interface ImageResizeCalculation {
  startWidthPx: number;
  deltaX: number;
  containerWidthPx: number;
  centered?: boolean;
}

export const calculateImageWidthPercent = ({
  startWidthPx,
  deltaX,
  containerWidthPx,
  centered = true
}: ImageResizeCalculation) => {
  if (!Number.isFinite(containerWidthPx) || containerWidthPx <= 0) {
    return IMAGE_MAX_WIDTH_PERCENT;
  }

  const widthDelta = centered ? deltaX * 2 : deltaX;
  return clampImageWidthPercent(((startWidthPx + widthDelta) / containerWidthPx) * 100);
};
