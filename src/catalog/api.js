export const CATALOG_PATH = `./${import.meta.env.VITE_EDITOR_ENTRY ? 'catalog.html' : 'catalog'}`;
export const EDITOR_PATH = `./${import.meta.env.VITE_EDITOR_ENTRY || 'editor'}`;
export async function catalogAPI(path, { method = 'GET', body, token, signal } = {}) {
  let response;
  try { response = await fetch(`/api/catalog${path}`, { method, credentials: 'same-origin', referrerPolicy: 'no-referrer',
    headers: { ...(body ? { 'Content-Type': 'application/json' } : {}), ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {}), signal: signal || AbortSignal.timeout(15000) }); }
  catch (error) { if (signal?.aborted) throw error; throw new Error('Нет связи с каталогом. Проверь подключение и попробуй ещё раз.'); }
  let value;
  try { value = await response.json(); } catch { throw new Error('Каталог сейчас недоступен. Редактор и скачивание файла продолжают работать.'); }
  if (!response.ok) throw Object.assign(new Error(value.error || 'Не удалось выполнить запрос.'), { status: response.status, duplicateId: value.duplicateId });
  return value;
}
const OWNERS_KEY = 'gridstudio.catalog.ownership.v1';
export function ownedWorks() {
  try { const value = JSON.parse(localStorage.getItem(OWNERS_KEY) || '[]'); return Array.isArray(value) ? value.filter(x => /^[a-f0-9-]{36}$/.test(x.id) && /^[\w-]{43}$/.test(x.token)).slice(0, 100) : []; } catch { return []; }
}
export function rememberWork(item) {
  try { localStorage.setItem(OWNERS_KEY, JSON.stringify([item, ...ownedWorks().filter(x => x.id !== item.id)].slice(0, 100))); return true; } catch { return false; }
}
export function forgetWork(id) { try { localStorage.setItem(OWNERS_KEY, JSON.stringify(ownedWorks().filter(x => x.id !== id))); } catch {} }
export function managementLink(id, token) {
  const url = new URL(CATALOG_PATH, location.href); url.searchParams.set('id', id); url.hash = `manage=${token}`; return url.href;
}
export function downloadGrid(grid) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(grid, null, 2)], { type: 'application/json' }));
  const a = document.createElement('a'); a.href = url; a.download = 'hero_grid_config.json'; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
}
