const test = require('node:test');
const assert = require('node:assert/strict');
const C = require('../scripts/core.mjs').default;
const { hitSelectionFrame, hitItem, snapPoint } = require('../scripts/canvas-input.mjs');
const { drawingPoints, BRUSH_DEFAULTS, setDrawingShift, advanceDrawingStroke } = require('../scripts/drawing.mjs');
const settings = { ...BRUSH_DEFAULTS, chars: '.+@', order: 'random' };
const frameStyle = { tl:'A', tr:'B', bl:'C', br:'D', h:'-', v:'|' };
const render = s => drawingPoints(s.tool, s.path, settings, 78, s.shift && !s.repositioning, frameStyle);
const near = (a,b) => assert.ok(Math.abs(a-b) < 1e-7, `${a} != ${b}`);

test('the empty interior of a sparse selected artwork is draggable, even without a glyph hit', () => {
  const doc = C.createDocument();
  doc.entities = [[100,100],[400,100],[100,300],[400,300]].map(([x,y]) =>
    C.entity(doc, { type:'symbol', text:'+', x,y,w:30,h:30,layer:'decor' }));
  const point = {x:250,y:220};
  assert.equal(hitItem(doc, point, () => ({x:0,y:0,w:10,h:10})), null);
  assert.equal(hitSelectionFrame(C.selectionFrame(doc.entities), point), true);
  assert.equal(hitSelectionFrame(null, point), false);
  assert.equal(hitSelectionFrame(C.selectionFrame(doc.entities), {x:500,y:220}), false);
});

test('frame hit testing follows rotated selection edges and includes the hero header', () => {
  const frame = {x:100,y:200,w:200,h:50,rotation:47}, center = C.frameCenter(frame);
  for (const local of [{x:100,y:200},{x:300,y:250},{x:190,y:220}])
    assert.ok(hitSelectionFrame(frame, C.rotatePoint(local, center, 47)));
  assert.equal(hitSelectionFrame(frame, C.rotatePoint({x:99,y:220},center,47)),false);
  const hero = C.entity(C.createDocument(), {type:'heroes',x:100,y:100,w:200,h:150,heroIds:[2]});
  assert.ok(hitSelectionFrame(C.selectionFrame([hero]), {x:105,y:105}));
});

test('Shift translates every geometric draft without changing its symbols, spacing or dimensions', () => {
  for (const tool of ['line','hline','vline','rect','ellipse','triangle','diamond','star','spiral','wave','frame','fill','rectfill']) {
    const s = {tool, path:[{x:100,y:100}]};
    advanceDrawingStroke(s, {x:340,y:260}, false);
    const before = render(s), originalPath = structuredClone(s.path);
    setDrawingShift(s, true);
    assert.deepEqual(s.path, originalPath, `${tool}: pressing Shift must not jump`);
    assert.deepEqual(render(s), before);
    advanceDrawingStroke(s, {x:371,y:243}, true);
    const moved = render(s);
    assert.equal(moved.length, before.length, tool);
    moved.forEach((p,i) => { near(p.x, before[i].x+31); near(p.y,before[i].y-17); assert.equal(p.ch,before[i].ch); });
    setDrawingShift(s, false);
    assert.deepEqual(render(s), moved, `${tool}: releasing Shift must not jump`);
    advanceDrawingStroke(s, {x:401,y:273}, false);
    assert.deepEqual(s.path, [{x:131,y:83},{x:401,y:273}]);
  }
});

test('repeated translation, snapping and top/left limits preserve draft dimensions', () => {
  const s = {tool:'rect',path:[{x:16,y:24}]};
  advanceDrawingStroke(s, {x:176,y:104}, false);
  advanceDrawingStroke(s, snapPoint({x:193,y:131},true), true);
  assert.deepEqual(s.path,[{x:32,y:48},{x:192,y:128}]);
  advanceDrawingStroke(s, {x:-100,y:-100}, true);
  assert.deepEqual(s.path,[{x:0,y:0},{x:160,y:80}]);
  advanceDrawingStroke(s, {x:1300,y:700}, true);
  near(s.path[1].x-s.path[0].x,160); near(s.path[1].y-s.path[0].y,80);
  assert.ok(s.path[1].x > 1193 && s.path[1].y > 593);
});

test('pencil and smart/gradient brushes retain Shift axis drawing', () => {
  for (const tool of ['pencil','smart','gradient']) {
    const s = {tool,path:[{x:80,y:100}]};
    advanceDrawingStroke(s, {x:120,y:130}, false);
    advanceDrawingStroke(s, {x:300,y:135}, true);
    assert.equal(s.repositioning,false);
    assert.ok(render(s).every(p => p.y === 100));
    setDrawingShift(s,false);
    assert.ok(render(s).some(p => p.y > 100));
  }
});

test('a translated and resumed draft commits once and restores fully with undo/redo', () => {
  const doc = C.createDocument(), before = C.clone(doc), history = new C.History(10);
  const s = {tool:'frame',path:[{x:100,y:100}]};
  advanceDrawingStroke(s,{x:300,y:240},false);
  advanceDrawingStroke(s,{x:330,y:260},true);
  advanceDrawingStroke(s,{x:360,y:290},false);
  assert.deepEqual(doc,before, 'draft movement never mutates the saved document');
  doc.entities = render(s).map(p => C.entity(doc,{type:'symbol',text:p.ch,x:p.x,y:p.y,w:30,h:30,layer:'decor'}));
  history.push(before);
  const restored = history.undo(doc);
  assert.deepEqual(restored,before);
  assert.equal(history.past.length,0);
  assert.deepEqual(history.redo(restored),doc);
});
