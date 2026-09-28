import C from './core.mjs';

// CSS pixels, browser zoom and canvas backing pixels are independent.
export function canvasPoint(event, rect, size) {
  return { x: (event.clientX - rect.left) * size.w / rect.width,
    y: (event.clientY - rect.top) * size.h / rect.height };
}
export function snapPoint(point, enabled, step = 8) {
  return enabled ? { x: Math.round(point.x / step) * step, y: Math.round(point.y / step) * step } : point;
}
// Selection owns its entire visible frame, including gaps between glyphs.
// Use the frame's coordinates, not its axis-aligned bounding box after rotation.
export function hitSelectionFrame(frame, point) {
  if (!frame) return false;
  const local = C.rotatePoint(point, C.frameCenter(frame), -(frame.rotation || 0));
  const epsilon = 1e-7;
  return local.x >= frame.x - epsilon && local.x <= frame.x + frame.w + epsilon &&
    local.y >= frame.y - epsilon && local.y <= frame.y + frame.h + epsilon;
}
export function itemInkRects(item, measure) {
  if (item.type === 'heroes') return [{ x: item.x, y: item.y, w: item.w, h: C.visualHeight(item) }];
  return C.textGlyphs(item).map((glyph) => {
    const ink = measure(glyph.text);
    return { x: glyph.x + ink.x, y: glyph.y + ink.y, w: ink.w, h: ink.h };
  });
}
export function hitItem(doc, point, measure, tolerance = 3) {
  for (const layer of [...doc.layers].reverse()) {
    if (!layer.visible || layer.locked) continue;
    let best = null, distance = Infinity;
    for (let i = doc.entities.length - 1; i >= 0; i--) {
      const item = doc.entities[i];
      if (item.layer !== layer.id) continue;
      for (const r of itemInkRects(item, measure)) {
        if (point.x < r.x - tolerance || point.x > r.x + r.w + tolerance ||
            point.y < r.y - tolerance || point.y > r.y + r.h + tolerance) continue;
        // In dense art, select the closest visible glyph, not the last 30px box.
        const d = item.type === 'heroes' ? 0 : Math.hypot(point.x - r.x - r.w / 2, point.y - r.y - r.h / 2);
        if (d < distance) { best = item; distance = d; }
      }
    }
    if (best) return best;
  }
  return null;
}
export function intersectsInk(item, box, measure) {
  return itemInkRects(item, measure).some((r) =>
    r.x <= box.x + box.w && r.x + r.w >= box.x && r.y <= box.y + box.h && r.y + r.h >= box.y);
}
export function selectionOnClick(current, id, additive = false) {
  if (!additive) return current.has(id) ? new Set(current) : new Set([id]);
  const next = new Set(current);
  if (next.has(id)) next.delete(id); else next.add(id);
  return next;
}
export function centerBrushPoints(points, measure) {
  return points.map((p) => {
    const ink = measure(p.ch);
    return { ...p, x: Math.max(0, p.x - ink.x - ink.w / 2),
      y: Math.max(0, p.y - ink.y - ink.h / 2) };
  });
}
