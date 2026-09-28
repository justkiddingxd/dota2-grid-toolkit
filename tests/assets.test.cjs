const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
test('every catalog hero has a local PNG and all template IDs exist', () => {
  const { heroes } = require('../scripts/data.mjs').default;
  assert.ok(heroes.length >= 126);
  for (const hero of heroes) {
    if (hero.id === 127) {
      assert.equal(hero.attr, 'all');
      assert.equal(heroes.filter((h) => h.attr === 'all')[0].id, 127);
      assert.match(fs.readFileSync(path.join(root, hero.portrait), 'utf8'), /<svg/);
      assert.equal(hero.thumbnail, hero.portrait);
      continue;
    }
    const image = fs.readFileSync(path.join(root, `assets/heroes/${hero.id}.png`));
    assert.equal(image.subarray(1, 4).toString(), 'PNG');
    assert.ok(image.length > 1000);
    assert.match(hero.portrait, /^assets\/portraits\/\d+\.(jpg|png|webp)$/);
    const portrait = fs.readFileSync(path.join(root, hero.portrait));
    assert.ok(portrait.length > 1000);
    assert.ok(
      portrait[0] === 255 ||
        portrait.subarray(1, 4).toString() === 'PNG' ||
        portrait.subarray(0, 4).toString() === 'RIFF'
    );
  }
  const C = require('../scripts/core.mjs').default,
    ids = new Set(heroes.map((h) => h.id));
  for (const kind of ['roles', 'minimal'])
    for (const e of C.demoDocument(kind).entities)
      for (const id of e.heroIds) assert.ok(ids.has(id), `Missing hero ${id}`);
});
