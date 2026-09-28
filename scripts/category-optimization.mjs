import C from './core.mjs';
import { simplifiableItems } from './artwork-optimization.mjs';
import { planCategoryRows, compactCategoryRows } from './export-rows.mjs';

// Local covariance distinguishes thin contours from dense fills. Bucket moments
// make the analysis linear even for thousands of overlapping points.
function importance(items) {
  if (!items.length) return new Map();
  const xs = items.map((e) => e.x), ys = items.map((e) => e.y);
  const area = (Math.max(...xs) - Math.min(...xs)) * (Math.max(...ys) - Math.min(...ys));
  const cell = Math.max(3, Math.min(36, Math.sqrt(area / items.length) * 1.5));
  const buckets = new Map(), weights = new Map();
  for (const item of items) {
    const key = `${Math.floor(item.x / cell)},${Math.floor(item.y / cell)}`;
    if (!buckets.has(key)) buckets.set(key, { n: 0, x: 0, y: 0, xx: 0, yy: 0, xy: 0 });
    const b = buckets.get(key);
    b.n++; b.x += item.x; b.y += item.y;
    b.xx += item.x * item.x; b.yy += item.y * item.y; b.xy += item.x * item.y;
  }
  for (const item of items) {
    const x = Math.floor(item.x / cell), y = Math.floor(item.y / cell);
    const sum = { n: 0, x: 0, y: 0, xx: 0, yy: 0, xy: 0 };
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      const b = buckets.get(`${x + dx},${y + dy}`);
      if (b) for (const key of Object.keys(sum)) sum[key] += b[key];
    }
    const vx = Math.max(0, sum.xx / sum.n - (sum.x / sum.n) ** 2);
    const vy = Math.max(0, sum.yy / sum.n - (sum.y / sum.n) ** 2);
    const cov = sum.xy / sum.n - sum.x * sum.y / sum.n ** 2;
    const direction = vx + vy > 1e-8 ? Math.min(1, Math.hypot(vx - vy, 2 * cov) / (vx + vy)) : 0;
    weights.set(item.id, 0.5 + 3 / Math.sqrt(sum.n) + 2 * direction);
  }
  return weights;
}

function buildTree(items) {
  if (!items.length) return null;
  const node = { count: items.length, weight: items.reduce((n, e) => n + e.weight, 0) };
  if (items.length <= 8) return { ...node, items: [...items].sort((a, b) => b.weight - a.weight || a.index - b.index) };
  const xs = items.map((e) => e.x), ys = items.map((e) => e.y);
  const axis = Math.max(...xs) - Math.min(...xs) >= Math.max(...ys) - Math.min(...ys) ? 'x' : 'y';
  const ordered = [...items].sort((a, b) => a[axis] - b[axis] || a.index - b.index);
  const middle = Math.ceil(ordered.length / 2);
  return { ...node, left: buildTree(ordered.slice(0, middle)), right: buildTree(ordered.slice(middle)) };
}
function choose(tree, count, output) {
  if (!tree || count <= 0) return;
  if (tree.items) { output.push(...tree.items.slice(0, count)); return; }
  let left = Math.round(count * tree.left.weight / tree.weight);
  left = Math.max(count - tree.right.count, Math.min(tree.left.count, left));
  // Keep both spatial regions represented whenever the budget permits.
  if (count > 1) left = Math.max(1, Math.min(count - 1, left));
  choose(tree.left, left, output); choose(tree.right, count - left, output);
}

export function planOptimization(doc, measure) {
  const candidates = simplifiableItems(doc), eligible = new Map(candidates.map((e) => [e.id, e]));
  const entries = C.categoryEntries(doc), packed = planCategoryRows(entries, measure);
  const byLayer = new Map();
  for (const e of candidates) {
    if (!byLayer.has(e.layer)) byLayer.set(e.layer, []);
    byLayer.get(e.layer).push(e);
  }
  const weights = new Map();
  for (const items of byLayer.values()) for (const [id, weight] of importance(items)) weights.set(id, weight);
  const units = [];
  packed.groups.forEach((indices, index) => {
    const ids = [...new Set(indices.map((i) => entries[i].entityId))];
    // A row containing a protected object stays intact, including its symbols.
    if (!ids.every((id) => eligible.has(id))) return;
    const items = ids.map((id) => eligible.get(id));
    units.push({ index, ids, layer: items[0].layer,
      x: items.reduce((n, e) => n + e.x, 0) / items.length,
      y: items.reduce((n, e) => n + e.y, 0) / items.length,
      weight: Math.max(...items.map((e) => weights.get(e.id))) * Math.sqrt(items.length) });
  });
  const layers = new Map();
  for (const unit of units) {
    if (!layers.has(unit.layer)) layers.set(unit.layer, []);
    layers.get(unit.layer).push(unit);
  }
  const primary = [], edges = new Set();
  for (const layer of layers.values()) {
    primary.push(layer.reduce((a, b) => a.weight >= b.weight ? a : b));
    for (const [axis, sign] of [['x', 1], ['x', -1], ['y', 1], ['y', -1]])
      edges.add(layer.reduce((a, b) => a[axis] * sign <= b[axis] * sign ? a : b));
  }
  const anchors = [...new Set([...primary, ...edges])];
  const protectedCount = packed.categories.length - units.length;
  return { doc, measure, units, anchors, primaryCount: primary.length, protectedCount,
    rawCount: entries.length, losslessCount: packed.categories.length,
    minimum: protectedCount + primary.length,
    tree: buildTree(units.filter((unit) => !anchors.includes(unit))) };
}

export function optimizeCategories(plan, target = plan.losslessCount) {
  if (!Number.isFinite(target)) throw new Error('Укажи число категорий.');
  const budget = Math.max(plan.minimum, Math.min(plan.losslessCount, Math.round(target)));
  const available = budget - plan.protectedCount;
  const kept = plan.anchors.slice(0, available);
  if (available >= plan.anchors.length) choose(plan.tree, available - kept.length, kept);
  const keep = new Set(kept.flatMap((unit) => unit.ids));
  const remove = new Set(plan.units.flatMap((unit) => unit.ids).filter((id) => !keep.has(id)));
  const doc = C.clone(plan.doc);
  doc.entities = doc.entities.filter((e) => !remove.has(e.id));
  const count = compactCategoryRows(C.categoryEntries(doc), plan.measure).length;
  return { doc, count, budget, removed: remove.size, remaining: keep.size };
}
