const test = require('node:test');
const assert = require('node:assert/strict');
const { formatRelease, releasePayload } = require('../scripts/release-format.mjs');
const config = require('../releases/telegram.json');
const example = require('../releases/test.json');

test('announcement uses rich heading, native checked tasks, nested tasks and logo', () => {
  const payload = releasePayload(example, config);
  assert.equal(payload.chat_id, '-1004309207941');
  assert.equal(payload.message_thread_id, 2);
  assert.match(payload.rich_message.html, /^<h1><tg-emoji emoji-id="5316617119524236973">/);
  assert.match(payload.rich_message.html, /<li><input type="checkbox" checked>/);
  assert.match(payload.rich_message.html, /Builds\n<ul>/);
  assert.match(payload.rich_message.html, /Тест формата/);
  assert.equal(payload.parse_mode, undefined);
});
test('release content is escaped, with approved GitHub URL and no test footer', () => {
  const html = formatRelease({ version: '1.2.3', githubUrl: 'https://github.com/justkiddingxd/dota2-grid-toolkit/releases/tag/v1.2.3', changes: ['<script>&"'] }, config);
  assert.match(html, /&lt;script&gt;&amp;&quot;/);
  assert.match(html, /Изменения на GitHub/);
  assert.doesNotMatch(html, /Тест формата|<script>/);
});
test('malformed/empty/oversized release content fails before sending', () => {
  assert.throws(() => formatRelease({ version: 'bad', changes: ['A'] }, config));
  assert.throws(() => formatRelease({ ...example, changes: [] }, config));
  assert.throws(() => formatRelease({ ...example, changes: ['a\nb'] }, config));
  assert.throws(() => formatRelease({ ...example, changes: ['a'.repeat(17000)] }, config));
  assert.throws(() => releasePayload(example, { ...config, topicId: 0 }));
});
