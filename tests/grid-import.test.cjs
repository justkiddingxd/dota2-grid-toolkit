const test = require('node:test');
const assert = require('node:assert/strict');
const C = require('../scripts/core.mjs').default;
const { readGridFiles } = require('../scripts/grid-import.mjs');
const fixture = (prefix, n = 3) => ({
  version: 3, owner: prefix,
  configs: Array.from({ length: n }, (_, i) => ({
    config_name: `${prefix} ${i + 1}`, custom: i,
    categories: [{ category_name: '*', x_position: i * 30, y_position: 40,
      width: 30, height: 30, hero_ids: [], custom: prefix }]
  }))
});
const file = (name, data, type = '') => ({ name, type,
  size: JSON.stringify(data).length,
  text: async () => '\uFEFF' + JSON.stringify(data)
});

test('two files with three grids become six, preserving active edits and unknown metadata', () => {
  const a = C.importDota(fixture('A'), 1), b = C.importDota(fixture('B'), 2);
  a.name = 'Edited'; a.entities[0].x = 88; a.fileName = 'anything.json';
  b.entities[0].y = 99;
  const beforeA = C.clone(a), beforeB = C.clone(b);
  const merged = C.appendConfigs(a, [b]);
  assert.equal(merged.configIndex, 1);
  assert.equal(merged.name, 'Edited');
  assert.equal(merged.entities[0].x, 88);
  assert.equal(merged.fileName, 'anything.json');
  assert.equal(C.exportDota(merged).configs.length, 6);
  assert.equal(C.exportDota(merged).configs[5].categories[0].y_position, 99);
  assert.equal(C.exportDota(merged).configs[4].custom, 1);
  assert.equal(C.exportDota(merged).configs[4].categories[0].custom, 'B');
  assert.equal(C.exportDota(merged).owner, 'A');
  assert.deepEqual(a, beforeA); assert.deepEqual(b, beforeB);
});

test('append preserves native drafts, hidden layers, backgrounds and canvas dimensions', () => {
  let incoming = C.importDota(fixture('Old'));
  const art = C.addArtwork(incoming, [{ type: 'symbol', text: '#' }], 'Hidden');
  art.layer.visible = false; art.layer.locked = true;
  incoming.canvas = { w: 1800, h: 800 };
  incoming.reference = { src: 'data:image/png;base64,AAAA', name: 'reference', x: 0, y: 0,
    w: 100, h: 100, opacity: .1, visible: true };
  incoming = C.switchConfig(incoming, 1);
  incoming.name = 'Renamed draft';
  const current = C.createDocument('From scratch');
  current.entities.push(C.entity(current, { text: 'Current' }));
  const merged = C.appendConfigs(current, [incoming]);
  const restored = C.switchConfig(C.importProject(C.clone(merged)), 1);
  assert.equal(merged.source.configs.length, 4);
  assert.equal(merged.entities[0].text, 'Current');
  assert.equal(restored.layers.find((layer) => layer.id === art.layer.id).visible, false);
  assert.equal(restored.layers.find((layer) => layer.id === art.layer.id).locked, true);
  assert.deepEqual(restored.canvas, { w: 1800, h: 800 });
  assert.equal(restored.reference.name, 'reference');
  assert.equal(C.switchConfig(merged, 2).name, 'Renamed draft');
});

test('duplicate grid names get suffixes without losing grids and merge can be undone', () => {
  const a = C.importDota(fixture('Same')), before = C.clone(a);
  const history = new C.History(5); history.push(a);
  const merged = C.appendConfigs(a, [C.importDota(fixture('Same'))]);
  assert.deepEqual(C.configurations(merged).map((c) => c.name),
    ['Same 1', 'Same 2', 'Same 3', 'Same 1 (2)', 'Same 2 (2)', 'Same 3 (2)']);
  assert.deepEqual(history.undo(merged), before);
  assert.deepEqual(history.redo(before), merged);
});

test('import uses contents with arbitrary filenames, extensions, MIME types and BOM', async () => {
  const result = await readGridFiles([
    file('мой пул.backup', fixture('A'), 'text/plain'),
    file('renamed', fixture('B'), 'application/octet-stream'),
    file('looks-like-an-image.png', fixture('C'), 'image/png'),
    file('native.custom', C.createDocument('Native'))
  ]);
  assert.equal(result.length, 4);
  assert.equal(result[0].doc.fileName, 'мой пул.backup');
  assert.equal(result[3].doc.name, 'Native');
});

test('invalid batches and the grid limit reject atomically with a useful filename', async () => {
  await assert.rejects(readGridFiles([file('ok.json', fixture('A')),
    { name: 'broken.txt', size: 10, text: async () => '{bad' }]), /broken.txt.*JSON/);
  await assert.rejects(readGridFiles([file('wrong.json', null)]), /wrong.json/);
  await assert.rejects(readGridFiles([{ name: 'huge', size: 21 * 1024 * 1024 }]), /20 МБ/);
  const current = C.importDota(fixture('Full', 99)), before = C.clone(current);
  assert.throws(() => C.appendConfigs(current, [C.importDota(fixture('More'))]), /100/);
  assert.deepEqual(current, before);
});
