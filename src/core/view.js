// View tilt is a unit square: 0 leaves authored coordinates unchanged.
export function clampTilt(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.max(-1, Math.min(1, n));
}

export function viewPoint(x, y, tiltX, tiltY, spanX = 12, spanY = 10) {
  return {
    x: x + clampTilt(tiltX) * spanX,
    y: y + clampTilt(tiltY) * spanY,
  };
}
