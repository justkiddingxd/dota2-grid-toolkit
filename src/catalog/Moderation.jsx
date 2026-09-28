import { useEffect, useState } from 'react';
import { catalogAPI } from './api.js';
import { Icon, Notice, Stats, useCatalogConfig } from './Common.jsx';
import GridPreview from './GridPreview.jsx';

export default function Moderation() {
  const { config, error } = useCatalogConfig();
  if (error) return <Notice error>{error}</Notice>;
  if (!config) return <p role="status">Загружаем настройки…</p>;
  if (config.webModeration) return <WebModeration/>;
  return <section className="catalog-empty"><h1>Модерация в Telegram</h1>
    <p>Заявки приходят в «approve grids here». Одобрить или отклонить сетку может любой участник чата.</p>
    <a className="catalog-button primary" href={config.moderationUrl || 'https://t.me/c/4309207941/6'} target="_blank" rel="noreferrer">Открыть топик</a>
  </section>;
}

function WebModeration() {
  const [authenticated, setAuthenticated] = useState(null), [password, setPassword] = useState('');
  const [error, setError] = useState(''), [busy, setBusy] = useState(false), [filter, setFilter] = useState('pending');
  const [data, setData] = useState(null), [selected, setSelected] = useState(''), [page, setPage] = useState(0), [refresh, setRefresh] = useState(0);
  const [reason, setReason] = useState(''), [blockIP, setBlockIP] = useState(false);
  useEffect(() => { catalogAPI('/admin/session').then(() => setAuthenticated(true)).catch(() => setAuthenticated(false)); }, []);
  useEffect(() => {
    if (!authenticated) return; const c = new AbortController(); setError('');
    catalogAPI(`/admin/works?filter=${filter}&page=${page}`, { signal: c.signal }).then(next => { setData(next); setSelected(current => next.items.some(item => item.id === current) ? current : next.items[0]?.id || ''); })
      .catch(error => { if (c.signal.aborted) return; if (error.status === 401) setAuthenticated(false); setError(error.message); });
    return () => c.abort();
  }, [authenticated, filter, page, refresh]);
  const item = data?.items.find(item => item.id === selected);
  useEffect(() => { setReason(''); setBlockIP(false); }, [item?.id, item?.revision]);
  async function review(action) {
    setBusy(true); setError('');
    try { await catalogAPI(`/admin/works/${item.id}`, { method: 'POST', body: { action, revision: item.revision, reason, blockIP } }); setRefresh(x => x + 1); }
    catch (e) { setError(e.message); } finally { setBusy(false); }
  }
  if (authenticated === null) return <p role="status">Проверяем доступ…</p>;
  if (!authenticated) return <form className="catalog-login" onSubmit={async event => {
    event.preventDefault(); setBusy(true); setError('');
    try { await catalogAPI('/admin/login', { method: 'POST', body: { password } }); setPassword(''); setAuthenticated(true); }
    catch (e) { setError(e.message); } finally { setBusy(false); }
  }}><h1>Модерация</h1><p className="catalog-muted">Доступ для авторов GridStudio.</p><label>Ключ модератора<input type="password" autoComplete="current-password" value={password} onChange={e => setPassword(e.target.value)} required autoFocus/></label>
    {error && <Notice error>{error}</Notice>}<button className="catalog-button primary" disabled={busy}>{busy ? 'Входим…' : 'Войти'}<Icon name="arrow"/></button></form>;
  return <><header className="catalog-heading"><div><h1>Модерация</h1><p>Проверяй именно ту версию, которая будет опубликована.</p></div><div className="catalog-actions"><button className="catalog-button" disabled={busy || !data} onClick={async () => {
    setBusy(true); try { await catalogAPI('/admin/settings', { method: 'PATCH', body: { paused: !data.paused } }); setRefresh(x => x + 1); } catch (e) { setError(e.message); } finally { setBusy(false); }
  }}>{data?.paused ? 'Возобновить приём' : 'Приостановить приём'}</button><button className="catalog-button" onClick={async () => { try { await catalogAPI('/admin/logout', { method: 'POST', body: {} }); setAuthenticated(false); setData(null); } catch (e) { setError(e.message); } }}>Выйти</button></div></header>
    {data?.paused && <Notice>Новые заявки и обновления временно не принимаются. Просмотр и скачивание доступны.</Notice>}
    <div className="catalog-toolbar"><div className="catalog-tabs">{[['pending','На проверке'],['reports','Жалобы'],['published','Опубликованы']].map(([value, label]) => <button key={value} aria-pressed={filter === value} onClick={() => { setFilter(value); setPage(0); setData(null); }}>{label}</button>)}</div><button className="catalog-link" onClick={() => setRefresh(x => x + 1)}>Обновить очередь</button></div>
    {error && <Notice error>{error}</Notice>}
    {!data ? <p role="status">Загружаем очередь…</p> : !data.items.length ? <section className="catalog-empty"><h2>Здесь всё разобрано</h2><p>Новых заявок в этой подборке нет.</p>{page > 0 && <button className="catalog-button" onClick={() => setPage(x => x - 1)}>Предыдущая страница</button>}</section> : <>
      <div className="catalog-moderation"><nav className="catalog-queue" aria-label="Заявки">{data.items.map(work => <button key={work.id} aria-current={selected === work.id ? 'true' : undefined} onClick={() => setSelected(work.id)}><strong>{work.title}</strong><span>{work.author || 'Без подписи'}</span><small>{work.stats.categories} категорий{work.reports.length ? ` · жалоб: ${work.reports.length}` : ''}</small></button>)}</nav>
        {item && <section className="catalog-review"><h2>{item.title}</h2><GridPreview grid={item.grid} title={item.title} large/><Stats stats={item.stats}/>
          <p className="catalog-muted">Автор: {item.author || 'не указан'}. Работ от этого браузера: {item.related}. Точные повторы содержимого отсекаются при отправке.</p>
          {item.published && item.status === 'pending' && <details><summary>Сравнить с опубликованной версией</summary><GridPreview grid={item.published.grid} title="Опубликованная версия" large/></details>}
          {!!item.reports.length && <div className="catalog-reports"><h3>Жалобы</h3>{item.reports.map(report => <p key={report.id}>{report.reason}</p>)}</div>}
          <label>Причина отказа или ограничения<textarea rows={3} value={reason} onChange={e => setReason(e.target.value)} maxLength={500}/></label>
          <div className="catalog-actions">{item.status === 'pending' ? <><button className="catalog-button primary" disabled={busy} onClick={() => review('approve')}><Icon name="check"/>Одобрить</button><button className="catalog-button" disabled={busy || !reason.trim()} onClick={() => review('reject')}>Вернуть на доработку</button></> : null}{!!item.reports.length && <button className="catalog-button" disabled={busy} onClick={() => review('resolve')}>Жалобы проверены</button>}</div>
          <details className="catalog-block"><summary>Ограничить источник спама</summary><p>Работа исчезнет из каталога. Браузер автора не сможет отправлять сетки 7 дней.</p><label className="catalog-check"><input type="checkbox" checked={blockIP} onChange={e => setBlockIP(e.target.checked)}/>Также ограничить IP на 7 дней</label><p className="catalog-muted">Одним IP могут пользоваться разные люди. Включай только при массовом спаме.</p><button className="catalog-button danger" disabled={busy || !reason.trim()} onClick={() => review('block')}>Скрыть работу и ограничить отправку</button></details>
        </section>}</div>
      {data.total > 20 && <nav className="catalog-pagination"><button className="catalog-button" disabled={!page} onClick={() => setPage(x => x - 1)}>Назад</button><span>{page + 1} / {Math.ceil(data.total / 20)}</span><button className="catalog-button" disabled={(page + 1) * 20 >= data.total} onClick={() => setPage(x => x + 1)}>Дальше</button></nav>}
    </>}
  </>;
}
