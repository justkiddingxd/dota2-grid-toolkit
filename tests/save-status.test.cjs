const { test } = require('node:test');
const assert = require('node:assert/strict');
const { saveIndicator } = require('../scripts/save-status.mjs');

test('one save indicator waits for both local persistence and account sync', () => {
  const saved = { text: 'Изменения сохранены', warning: false };
  const saving = { text: 'Сохраняем…', warning: false };
  for (const cloud of ['', 'Файл на устройстве', 'Файл в аккаунте', 'Сохранено в аккаунте']) {
    assert.deepEqual(saveIndicator(saved, cloud), saved);
    assert.deepEqual(saveIndicator(saving, cloud), saving);
  }
  for (const cloud of ['Сохранено локально · ждёт синхронизации', 'Сохраняем в аккаунт…'])
    assert.deepEqual(saveIndicator(saved, cloud), saving);
});

test('save and recovery failures remain visible even after successful cloud sync', () => {
  const failed = { text: 'Не сохранено · скачать', warning: true, detail: 'Storage full' };
  const conflict = { text: 'Сохранено в копии · открыть', warning: true, detail: 'Another tab edited this file' };
  for (const local of [failed, conflict])
    for (const cloud of ['', 'Сохраняем в аккаунт…', 'Сохранено в аккаунте', 'Cloud unavailable'])
      assert.deepEqual(saveIndicator(local, cloud), local);
  const error = saveIndicator(undefined, 'Offline. Локальная копия сохранена.');
  assert.equal(error.text, 'Не синхронизировано');
  assert.equal(error.warning, true);
  assert.equal(error.detail, 'Offline. Локальная копия сохранена.');
  assert.equal(saveIndicator(undefined, 'Сохранено в аккаунте').warning, false);
});
