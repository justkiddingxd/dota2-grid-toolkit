export const MIN_ZOOM = 0.01;
export const MAX_ZOOM = 8;
export function clampZoom(value) {
  return Number.isFinite(value) ? Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, value)) : 1;
}
// Logarithmic travel gives useful precision around 100%, without fixed stops.
export function sliderToZoom(value) {
  return clampZoom(MIN_ZOOM * (MAX_ZOOM / MIN_ZOOM) ** (value / 1000));
}
export function zoomToSlider(value) {
  return Math.log(clampZoom(value) / MIN_ZOOM) / Math.log(MAX_ZOOM / MIN_ZOOM) * 1000;
}
export function wheelZoom(current, delta, mode = 0, pageHeight = 600) {
  const pixels = delta * (mode === 1 ? 16 : mode === 2 ? pageHeight : 1);
  return clampZoom(current * Math.exp(-Math.max(-500, Math.min(500, pixels)) * 0.002));
}
