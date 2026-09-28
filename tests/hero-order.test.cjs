const { test } = require('node:test');
const assert = require('node:assert/strict');
const C = require('../scripts/core.mjs').default;
const { moveHero, heroSlot, heroAt, heroDropIndex, createHeroMotion, targetHeroMotion, advanceHeroMotion } = require('../scripts/hero-order.mjs');
const group = (ids = [1, 2, 3, 4, 5]) => ({ id: 'heroes', type: 'heroes', x: 80, y: 90, w: 180, h: 220, heroIds: ids });
const center = (g, i) => { const layout = C.heroLayout(g), p = heroSlot(g, layout, i); return { x: p.x + layout.cardW / 2, y: p.y + layout.cardH / 2 }; };

test('hero reorder inserts in either direction, preserves duplicate IDs and rejects invalid slots', () => {
  const ids = [1, 2, 1, 3];
  assert.deepEqual(moveHero(ids, 0, 3), [2, 1, 3, 1]);
  assert.deepEqual(moveHero(ids, 3, 0), [3, 1, 2, 1]);
  assert.deepEqual(moveHero(ids, 1, 1), ids);
  for (const bad of [-1, 4, 1.2, NaN]) assert.deepEqual(moveHero(ids, 0, bad), ids);
  assert.deepEqual(ids, [1, 2, 1, 3]);
});

test('hero picking uses painted portraits; titles, gaps and empty cells stay available to move the group', () => {
  const g = group(), layout = C.heroLayout(g);
  g.heroIds.forEach((_, i) => assert.equal(heroAt(g, center(g, i)), i));
  assert.equal(heroAt(g, { x: g.x + 30, y: g.y + 8 }), -1);
  const first = heroSlot(g, layout, 0);
  assert.equal(heroAt(g, { x: first.x + layout.cardW + layout.gap / 2, y: first.y + 5 }), -1);
  assert.equal(heroAt(group([1]), center(group([1]), 0)), -1);
});

test('drop slots wrap between rows and clamp incomplete rows without accepting an outside drop', () => {
  const g = group(), layout = C.heroLayout(g);
  assert.ok(layout.rows > 1);
  g.heroIds.forEach((_, i) => assert.equal(heroDropIndex(g, center(g, i)), i));
  assert.equal(heroDropIndex(g, { x: g.x + g.w - 1, y: g.y + 20 + g.h - 1 }), 4);
  for (const p of [{ x: g.x - 1, y: g.y + 40 }, { x: g.x + g.w + 1, y: g.y + 40 },
    { x: g.x + 20, y: g.y + 10 }, { x: g.x + 20, y: g.y + 21 + g.h }]) assert.equal(heroDropIndex(g, p), -1);
});

test('live animation moves neighbors without changing document data and settles without an endless frame loop', () => {
  const g = group(), before = structuredClone(g), motion = createHeroMotion(g, 0, 0);
  targetHeroMotion(motion, 4);
  motion.positions[0] = { x: 600, y: 500 };
  assert.equal(advanceHeroMotion(motion, 16), true);
  assert.notDeepEqual(motion.positions[1], motion.slots[1]);
  assert.deepEqual(motion.positions[0], { x: 600, y: 500 }); // Dragged hero follows the pointer directly.
  assert.deepEqual(g, before);
  motion.active = false;
  for (let time = 32; time <= 800; time += 16) advanceHeroMotion(motion, time);
  assert.equal(advanceHeroMotion(motion, 816), false);
  assert.deepEqual(motion.positions[0], motion.slots[4]);
  assert.deepEqual(motion.positions[1], motion.slots[0]);
});

test('cancelling returns every portrait; reduced motion snaps slots but preserves drag feedback', () => {
  const g = group(), motion = createHeroMotion(g, 1, 0);
  targetHeroMotion(motion, 4); motion.positions[1] = { x: 700, y: 400 };
  advanceHeroMotion(motion, 16, true);
  assert.deepEqual(motion.positions[2], motion.slots[1]);
  assert.deepEqual(motion.positions[1], { x: 700, y: 400 });
  targetHeroMotion(motion, 1); motion.active = false;
  assert.equal(advanceHeroMotion(motion, 32, true), false);
  assert.deepEqual(motion.positions, motion.slots);
});

test('one committed reorder round-trips through export and undo/redo without resizing the group', () => {
  const doc = C.importDota({ version: 3, configs: [{ config_name: 'Test', categories: [{
    category_name: 'Heroes', x_position: 80, y_position: 90, width: 180, height: 220, hero_ids: [127, 1, 2, 1]
  }] }] });
  const before = C.clone(doc), history = new C.History(35), g = doc.entities.find(e => e.type === 'heroes');
  g.heroIds = moveHero(g.heroIds, 0, 3); history.push(before);
  const changed = C.clone(doc), exported = C.exportDota(doc).configs[0].categories[0];
  assert.deepEqual(exported.hero_ids, [1, 2, 1, 127]); assert.equal(exported.width, 180); assert.equal(exported.height, 220);
  assert.deepEqual(history.undo(doc), before);
  assert.deepEqual(history.redo(before), changed);
});
