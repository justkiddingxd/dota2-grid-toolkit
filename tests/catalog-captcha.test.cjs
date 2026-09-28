const { test } = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { tmpdir } = require('node:os');
const { join } = require('node:path');
const { unlinkSync } = require('node:fs');
const { CatalogStore } = require('../server/catalog-store.mjs');
const { CatalogCaptcha } = require('../server/catalog-captcha.mjs');
const { solve } = require('./captcha-helper.cjs');
const identity = { browser:'test-browser', ip:'test-ip' }, key='test-only-altcha-secret';
function fixture(t) {
  let now = Date.now();
  const store = new CatalogStore(':memory:', key, () => now);
  t.after(() => store.close());
  return { store, captcha:new CatalogCaptcha(store,key), advance:ms=>{now+=ms;} };
}
const bad = error => error.status === 400;
test('ALTCHA requires a real solution and binds challenges to browser and action', async t => {
  const {captcha}=fixture(t), challenge=await captcha.issue(identity,'submit'), token=await solve(challenge);
  for (const value of ['', 'junk', 'a'.repeat(12001), Buffer.from('{}').toString('base64')])
    await assert.rejects(captcha.verify(value,identity,'submit'),bad);
  await assert.rejects(captcha.verify(token,{...identity,browser:'other'},'submit'),bad);
  await assert.rejects(captcha.verify(token,identity,'report'),bad);
  const forged=JSON.parse(Buffer.from(token,'base64')); forged.challenge.parameters.cost=1;
  await assert.rejects(captcha.verify(Buffer.from(JSON.stringify(forged)).toString('base64'),identity,'submit'),bad);
  const invalid=JSON.parse(Buffer.from(token,'base64')); invalid.solution.derivedKey='00'.repeat(32);
  await assert.rejects(captcha.verify(Buffer.from(JSON.stringify(invalid)).toString('base64'),identity,'submit'),bad);
  await captcha.verify(token,identity,'submit');
  await assert.rejects(captcha.verify(token,identity,'submit'),bad);
});
test('ALTCHA accepts only one concurrent use and rejects expired challenges', async t => {
  const {captcha,advance}=fixture(t);
  const token=await solve(await captcha.issue(identity,'submit'));
  const results=await Promise.allSettled([captcha.verify(token,identity,'submit'),captcha.verify(token,identity,'submit')]);
  assert.equal(results.filter(x=>x.status==='fulfilled').length,1);
  const expiring=await solve(await captcha.issue(identity,'submit'));
  advance(11*60_000);
  await assert.rejects(captcha.verify(expiring,identity,'submit'),bad);
});
test('ALTCHA consumption survives server restart', async t => {
  const path=join(tmpdir(),`gridstudio-captcha-${randomUUID()}.sqlite`);
  let store=new CatalogStore(path,key);
  t.after(()=>{store.close();unlinkSync(path);});
  const captcha=new CatalogCaptcha(store,key), token=await solve(await captcha.issue(identity,'submit'));
  await captcha.verify(token,identity,'submit'); store.close();
  store=new CatalogStore(path,key);
  await assert.rejects(new CatalogCaptcha(store,key).verify(token,identity,'submit'),bad);
});
test('ALTCHA challenge endpoint rate limits before doing expensive work', async t => {
  const {captcha,store}=fixture(t);
  await assert.rejects(captcha.issue(identity,'anything'),bad);
  for(let n=0;n<20;n++) store.rate(`captcha:${identity.browser}`,20,600_000);
  await assert.rejects(captcha.issue(identity,'submit'),error=>error.status===429);
  assert.equal(store.get('SELECT count(*) n FROM captcha_challenges').n,0);
});
