const CLOUD_IDLE = new Set(['', 'Файл в аккаунте', 'Файл на устройстве', 'Сохранено в аккаунте']);
const CLOUD_PENDING = new Set(['Сохраняем в аккаунт…', 'Сохранено локально · ждёт синхронизации']);

// A local failure must never be masked by a later successful cloud response.
export function saveIndicator(local = { text: 'Изменения сохранены', warning: false }, cloud = '') {
  if (local.warning) return local;
  if (!CLOUD_IDLE.has(cloud) && !CLOUD_PENDING.has(cloud))
    return { text: 'Не синхронизировано', warning: true, detail: cloud };
  if (CLOUD_PENDING.has(cloud)) return { text: 'Сохраняем…', warning: false };
  return local;
}
