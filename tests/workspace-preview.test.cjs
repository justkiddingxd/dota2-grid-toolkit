const {test}=require('node:test');
const assert=require('node:assert/strict');
const C=require('../scripts/core.mjs').default;
const {workspaceGridPreview}=require('../scripts/workspace-preview.mjs');
const config=(name,text,x)=>({config_name:name,categories:[{category_name:text,x_position:x,y_position:30,width:30,height:30,hero_ids:[]}]});

test('file previews use active edits and inactive drafts, keep hidden layers hidden and never mutate the file',()=>{
 let doc=C.importDota({version:3,configs:[config('First','A',10),config('Second','B',20),config('Third','C',30)]},0);
 doc.name='Edited first';doc.entities[0].text='FIRST';doc.entities[0].x=100;
 doc=C.switchConfig(doc,1);doc.name='Edited second';doc.entities[0].text='SECOND';
 const hidden=C.clone(doc.entities[0]);hidden.id='e'+doc.nextId++;hidden.text='HIDDEN';doc.layers.find(x=>x.id==='background').visible=false;hidden.layer='background';doc.entities.push(hidden);
 const before=JSON.stringify(doc);
 assert.equal(workspaceGridPreview(doc,0).configs[0].config_name,'Edited first');
 assert.equal(workspaceGridPreview(doc,0).configs[0].categories[0].x_position,100);
 assert.deepEqual(workspaceGridPreview(doc,1).configs[0].categories.map(c=>c.category_name),['SECOND']);
 assert.equal(workspaceGridPreview(doc,2).configs[0].categories[0].category_name,'C');
 assert.equal(JSON.stringify(doc),before);
 const viewed=workspaceGridPreview(doc,2);viewed.configs[0].categories[0].category_name='changed preview';assert.equal(JSON.stringify(doc),before);
});

test('private file previews handle more categories than catalog publication limits and reject invalid indexes',()=>{
 const source={version:3,configs:[{config_name:'Large',categories:Array.from({length:5100},(_,i)=>({category_name:'.',x_position:i%100*10,y_position:Math.floor(i/100)*10,width:30,height:30,hero_ids:[]}))}]};
 const doc=C.importDota(source);assert.equal(workspaceGridPreview(doc,0).configs[0].categories.length,5100);
 for(const index of [-1,1,0.5,NaN])assert.throws(()=>workspaceGridPreview(doc,index),/Сетка не найдена/);
});
