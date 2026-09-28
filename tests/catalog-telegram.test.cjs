const { test } = require('node:test');
const assert = require('node:assert/strict');
const { mkdtempSync, rmSync } = require('node:fs');
const { join } = require('node:path');
const { tmpdir } = require('node:os');
const modules = Promise.all([import('../server/catalog-store.mjs'), import('../server/catalog-telegram.mjs'), import('../server/catalog-telegram-store.mjs')]);
const config = { chatId: '-1004309207941', topicId: 6, origin: 'https://gridstudio.me', local: false };
const input = (x = 10) => ({ title: '<Сетка>', author: 'Игрок & автор', tags: ['Аниме'], grid: { version: 3, configs: [{ config_name: 'Моя', categories: [
  { category_name: '.·:; +*#%@ ←↑→↓ あいう ㄱㄲ 한글 БРАЙЛЬ ⣿', x_position: x, y_position: 20, width: 30, height: 30, hero_ids: [] },
  { category_name: 'MY HEROES', x_position: 200, y_position: 150, width: 500, height: 240, hero_ids: [127, 1, 5, 135] }
] }] } });
const identity = { browser: 'test-browser', ip: 'test-network' };
async function fixture(t, overrides = {}) {
  const [{ CatalogStore }, { CatalogTelegram }] = await modules;
  const store = new CatalogStore(':memory:', 'test-only-salt'); t.after(() => store.close());
  const sent = [], edits = [], answers = [];
  let message = 100;
  const api = {
    getMe: async () => ({ id: 42, username: 'test_bot' }),
    getChat: async () => ({ is_forum: true, title: 'Test' }),
    getChatMember: async ({ user_id }) => ({ status: user_id === 42 ? 'administrator' : 'member' }),
    getWebhookInfo: async () => ({ url: '' }),
    sendPhoto: async params => { sent.push(params); return { message_id: message++, message_thread_id: 6, chat: { id: -1004309207941 } }; },
    editMessageCaption: async params => { edits.push(params); return true; },
    answerCallbackQuery: async params => { answers.push(params); return true; }, ...overrides
  };
  const worker = new CatalogTelegram(store, config, api, { render: async () => Buffer.from('test-png'), log: () => {} });
  await worker.check();
  const saved = store.save(input(), identity);
  return { store, worker, saved, sent, edits, answers, api };
}
const callback = (job, action, user = 7) => ({ id: 'callback-id', data: `gs:${action}:${job.id}`, from: { id: user, first_name: `Игрок ${user}`, is_bot: false },
  message: { message_id: job.message, message_thread_id: 6, chat: { id: -1004309207941 }, from: { id: 42 } } });
const jobOf = f => f.store.get('SELECT * FROM telegram_reviews ORDER BY rowid DESC LIMIT 1');

test('Telegram cards go to topic 6 with server PNG, escaped text and bounded callback data, no owner token', async t => {
  const f = await fixture(t); await f.worker.deliverOne(); await f.worker.deliverOne();
  assert.equal(f.sent.length, 1); const payload = f.sent[0];
  assert.equal(payload.chat_id, config.chatId); assert.equal(payload.message_thread_id, 6);
  assert.ok(payload.photo); assert.match(payload.caption, /&lt;Сетка&gt;/);
  assert.equal(payload.parse_mode, 'HTML');
  assert.match(payload.caption, /<tg-emoji emoji-id="5879813604068298387">❗️<\/tg-emoji> <b>Новая сетка на проверку:<\/b> "&lt;Сетка&gt;"/);
  assert.match(payload.caption, /<tg-emoji emoji-id="5920344347152224466">👤<\/tg-emoji> Автор: Игрок &amp; автор/);
  assert.match(payload.caption, /<tg-emoji emoji-id="5960551395730919906">📝<\/tg-emoji> Количество категорий: 2/);
  assert.match(payload.caption, /<tg-emoji emoji-id="5886436057091673541">💬<\/tg-emoji> Теги: Аниме/);
  assert.match(payload.caption, /\n\n<tg-emoji emoji-id="5776213190387961618">🕓<\/tg-emoji> Ожидает принятия решения$/);
  assert.doesNotMatch(payload.caption, /Символы:|Герои:|версия |Любой участник/);
  assert.deepEqual(payload.reply_markup.inline_keyboard[0].map(({text,icon_custom_emoji_id})=>({text,icon_custom_emoji_id})),[
    {text:'Одобрить',icon_custom_emoji_id:'5985596818912712352'},
    {text:'Отклонить',icon_custom_emoji_id:'5985346521103604145'}
  ]);
  assert.equal(JSON.stringify(payload).includes(f.saved.managementToken), false);
  for (const button of payload.reply_markup.inline_keyboard[0]) assert.ok(Buffer.byteLength(button.callback_data) <= 64);
});
test('any ordinary current chat member can approve; second click cannot reverse the first decision', async t => {
  const f = await fixture(t); await f.worker.deliverOne(); const job = jobOf(f);
  await f.worker.callback(callback(job, 'approve'));
  assert.equal(f.store.list().total, 1); assert.equal(jobOf(f).outcome, 'approve');
  await f.worker.callback(callback(job, 'reject', 8));
  assert.equal(jobOf(f).outcome, 'approve'); assert.match(f.answers.at(-1).text, /Игрок 7/);
  assert.equal(f.edits[0].reply_markup.inline_keyboard[0][0].text, 'Открыть в каталоге');
  assert.match(f.edits[0].caption, /<tg-emoji emoji-id="5985596818912712352">✅<\/tg-emoji> Одобрено · Игрок 7 \(ID 7\)$/);
  assert.doesNotMatch(f.edits[0].caption, /Ожидает принятия решения|5776213190387961618/);
  assert.match(f.store.all('SELECT action FROM audit').at(-1).action, /telegram:approve.*user:7/);
});
test('reject is available to an ordinary participant and appears in author status', async t => {
  const f = await fixture(t); await f.worker.deliverOne(); await f.worker.callback(callback(jobOf(f), 'reject'));
  assert.equal(f.store.list().total, 0); assert.equal(f.store.ownerView(f.saved.id, f.saved.managementToken).status, 'rejected');
  assert.match(f.store.ownerView(f.saved.id, f.saved.managementToken).reason, /Telegram/);
  assert.equal(f.edits[0].reply_markup.inline_keyboard.length, 0);
  assert.match(f.edits[0].caption, /<tg-emoji emoji-id="5985346521103604145">❌<\/tg-emoji> Отклонено · Игрок 7 \(ID 7\)$/);
  assert.doesNotMatch(f.edits[0].caption, /Ожидает принятия решения|5776213190387961618/);
});

test('caption escapes submitted markup and reviewer name, fits Telegram limits, and marks stale cards without a fake reviewer', async()=>{
  const [, {reviewCaption,reviewKeyboard}]=await modules;
  const summary={title:'<b>'.repeat(26),author:'&'.repeat(48),tags:['С упором на героя','Dead inside','Аниме'],stats:{categories:2001},reason:'<a href="bad">&'.repeat(30)};
  const job={kind:'report',id:'example',revision:1,summary:JSON.stringify(summary),outcome:'reject',actor:JSON.stringify({name:'<b>&'.repeat(25),id:1234567890123})};
  const text=reviewCaption(job,{...config,local:true});
  assert.match(text,/Локальная проверка/);assert.match(text,/Более 2 000 категорий/);assert.match(text,/&lt;a href=&quot;bad&quot;&gt;&amp;/);
  assert.match(text,/&lt;b&gt;&amp;/);assert.doesNotMatch(text,/<a href=/);
  const visible=text.replace(/<[^>]+>/g,'').replace(/&(?:amp|lt|gt|quot);/g,'x');
  assert.ok(visible.length<=1024,`Caption length: ${visible.length}`);
  const outdated=reviewCaption({...job,outcome:'outdated',actor:''},config);
  assert.match(outdated,/Заявка уже проверена, изменена или удалена/);assert.doesNotMatch(outdated,/Ожидает принятия решения|\(ID /);
  assert.deepEqual(reviewKeyboard({...job,outcome:'outdated'},config).inline_keyboard,[]);
  const pending=reviewCaption({...job,outcome:'',actor:'',summary:JSON.stringify({...summary,author:'',tags:[],reason:''})},config);
  assert.match(pending,/Автор: не указан/);assert.match(pending,/Теги: не указаны/);
});
test('left, kicked and nonmember restricted users cannot moderate, restricted members can', async t => {
  const [, { isChatMember }] = await modules;
  assert.equal(isChatMember({ status: 'restricted', is_member: true }), true);
  for (const status of ['left', 'kicked', 'restricted']) {
    const f = await fixture(t); await f.worker.deliverOne();
    f.api.getChatMember = async () => ({ status, is_member: false });
    await f.worker.callback(callback(jobOf(f), 'approve'));
    assert.equal(f.store.list().total, 0); assert.match(f.answers.at(-1).text, /только участники/);
  }
});
test('foreign chat/topic/message/bot and unavailable membership checks fail closed', async t => {
  const f = await fixture(t); await f.worker.deliverOne(); const job = jobOf(f);
  for (const mutate of [q => q.message.chat.id = -1001111, q => q.message.message_thread_id = 2, q => q.message.message_id++, q => q.message.from.id++, q => q.from.is_bot = true]) {
    const q = callback(job, 'approve'); mutate(q); await f.worker.callback(q); assert.equal(f.store.list().total, 0);
  }
  f.api.getChatMember = async () => { throw new Error('offline'); };
  await f.worker.callback(callback(job, 'approve')); assert.equal(f.store.list().total, 0);
});
test('two concurrent Telegram decisions publish or reject once even across awaited membership calls', async t => {
  const f = await fixture(t); await f.worker.deliverOne(); const job = jobOf(f);
  await Promise.all([f.worker.callback(callback(job, 'approve')), f.worker.callback(callback(job, 'reject', 8))]);
  assert.equal(f.store.list().total, 1);
  assert.equal(f.store.all("SELECT * FROM audit WHERE action LIKE 'telegram:%'").length, 1);
});
test('outdated and deleted cards never publish the replacement; updates have a separate card', async t => {
  const f = await fixture(t); await f.worker.deliverOne(); const first = jobOf(f);
  const updated = f.store.save(input(40), identity, f.saved.id, f.saved.managementToken, f.saved.revision);
  await f.worker.callback(callback(first, 'approve')); assert.equal(f.store.list().total, 0);
  await f.worker.deliverOne(); assert.equal(f.sent.length, 2); assert.equal(jobOf(f).revision, updated.revision);
  const second = jobOf(f); f.store.remove(f.saved.id, f.saved.managementToken);
  await f.worker.callback(callback(second, 'approve')); assert.equal(f.store.list().total, 0);
});
test('lost send response is not blindly retried; actual callback recovers its receipt', async t => {
  const f = await fixture(t, { sendPhoto: async () => { throw new Error('timeout'); } });
  await f.worker.deliverOne(); assert.equal(jobOf(f).state, 'uncertain');
  assert.equal(await f.worker.deliverOne(), false);
  const job = { ...jobOf(f), message: 222 };
  await f.worker.callback(callback(job, 'approve')); assert.equal(f.store.list().total, 1); assert.equal(jobOf(f).message, 222);
});
test('Telegram 429 backs off, permanent errors stay visible and previews retry without sending', async t => {
  const f = await fixture(t, { sendPhoto: async () => { const { ApiError } = await import('puregram'); throw new ApiError({ error_code: 429, description: 'Too Many Requests', parameters: { retry_after: 45 } }); } });
  await f.worker.deliverOne(); assert.equal(jobOf(f).state, 'queued'); assert.ok(jobOf(f).next_at > Date.now() + 40_000);
  f.worker.queue.retry(jobOf(f), 'queued', 0); f.api.sendPhoto = async () => { throw { error_code: 400 }; };
  await f.worker.deliverOne(); assert.equal(jobOf(f).state, 'failed');
  f.worker.queue.retry(jobOf(f), 'queued', 0); f.worker.render = async () => { throw Error('font'); };
  await f.worker.deliverOne(); assert.equal(jobOf(f).state, 'queued');
});
test('pending notification, upload uncertainty and single-worker lease survive restart', async t => {
  const [{ CatalogStore }, , { TelegramQueue }] = await modules;
  const dir = mkdtempSync(join(tmpdir(), 'gridstudio-telegram-')); t.after(() => rmSync(dir, { recursive: true, force: true }));
  const path = join(dir, 'db.sqlite'); let store = new CatalogStore(path, 'salt'), q = new TelegramQueue(store);
  store.save(input(), identity); q.sync(); const job = q.claim(); q.sending(job, config);
  assert.equal(q.lease('a'), true); assert.equal(q.lease('b'), false); q.release('a'); store.close();
  store = new CatalogStore(path, 'salt'); q = new TelegramQueue(store);
  try { q.recover(); q.sync(); assert.equal(q.get(job.id).state, 'uncertain'); assert.equal(q.lease('b'), true); assert.equal(q.claim(), undefined); }
  finally { store.close(); }
});
test('report card can dismiss a complaint or hide its exact public revision without approving a draft', async t => {
  const f = await fixture(t); await f.worker.deliverOne(); await f.worker.callback(callback(jobOf(f), 'approve'));
  f.store.report(f.saved.id, { browser: 'reporter', ip: 'other-ip' }, 'Реклама'); await f.worker.deliverOne();
  assert.equal(jobOf(f).kind, 'report'); await f.worker.callback(callback(jobOf(f), 'keep')); assert.equal(f.store.list().total, 1);
  f.store.report(f.saved.id, { browser: 'reporter', ip: 'other-ip' }, 'Новая жалоба'); await f.worker.deliverOne(); const report = jobOf(f);
  f.store.save(input(60), identity, f.saved.id, f.saved.managementToken, f.saved.revision);
  await f.worker.callback(callback(report, 'hide')); assert.equal(f.store.list().total, 0);
  assert.equal(f.store.ownerView(f.saved.id, f.saved.managementToken).blocked, true);
});
test('web moderator endpoints are disabled by default even with an existing password/session', async t => {
  const [{ CatalogStore }] = await modules; const { createCatalogAPI } = await import('../server/catalog-api.mjs');
  const store = new CatalogStore(':memory:', 'salt'), settings = { ...config, salt: 'salt', development: true, adminPassword: 'long-existing-secret-value' };
  const { server } = createCatalogAPI(settings, { store }); await new Promise(r => server.listen(0, '127.0.0.1', r));
  t.after(async () => { await new Promise(r => server.close(r)); store.close(); });
  const r = await fetch(`http://127.0.0.1:${server.address().port}/api/catalog/admin/login`, { method: 'POST', headers: { Origin: config.origin, 'Content-Type': 'application/json' }, body: JSON.stringify({ password: settings.adminPassword }) });
  assert.equal(r.status, 403); assert.match((await r.json()).error, /Telegram/);
});
test('server preview is a PNG in Dota dimensions, handles local portrait formats and is deterministic', async () => {
  const { renderCatalogPreview } = await import('../server/catalog-preview.mjs');
  const a = await renderCatalogPreview(input().grid), b = await renderCatalogPreview(input().grid);
  assert.equal(a.subarray(1, 4).toString(), 'PNG'); assert.equal(a.readUInt32BE(16), 1193); assert.equal(a.readUInt32BE(20), 593);
  assert.deepEqual(a, b); assert.ok(a.length > 10000);
});
