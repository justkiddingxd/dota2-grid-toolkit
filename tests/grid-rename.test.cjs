const {test}=require('node:test');
const assert=require('node:assert/strict');
const C=require('../scripts/core.mjs').default;
test('rename an inactive grid preserves the active canvas, drafts, and source geometry',()=>{
  const source={version:3,configs:[{config_name:'One',categories:[]},{config_name:'Two',categories:[{category_name:'★',x_position:12,y_position:23,width:30,height:30,hero_ids:[]}]}]};
  let doc=C.importDota(source,0);
  const before=JSON.stringify(doc), renamed=C.renameConfig(doc,1,'New name');
  assert.equal(JSON.stringify(doc),before);
  assert.equal(renamed.configIndex,0);assert.equal(renamed.name,'One');
  assert.deepEqual(renamed.entities,doc.entities);
  assert.deepEqual(renamed.source.configs[1].categories,source.configs[1].categories);
  doc=C.switchConfig(C.switchConfig(renamed,1),0);
  const withDraft=C.renameConfig(doc,1,'From draft');
  assert.equal(C.switchConfig(withDraft,1).name,'From draft');
  assert.equal(C.exportDota(withDraft).configs[1].config_name,'From draft');
  const history=new C.History(); history.push(doc);
  assert.deepEqual(history.undo(withDraft),doc);
});
test('rename active grid updates export and rejects empty names or invalid indices',()=>{
  const doc=C.createDocument(), next=C.renameConfig(doc,0,' Renamed ');
  assert.equal(next.name,'Renamed');assert.equal(C.exportDota(next).configs[0].config_name,'Renamed');
  for(const [index,name] of [[-1,'A'],[1,'A'],[0,'  '],[0,'x'.repeat(201)]]) assert.throws(()=>C.renameConfig(doc,index,name));
});
