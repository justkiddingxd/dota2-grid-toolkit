const escape = (text) => String(text).replace(/[&<>\"]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[ch]);

export function formatRelease(release, config, emoji = '🔷') {
  if (!release || (!release.test && !/^\d+\.\d+\.\d+(?:-[\w.-]+)?$/.test(release.version)))
    throw new Error('Укажи версию релиза в формате 1.2.3.');
  if (!/^\d+$/.test(config.emojiId)) throw new Error('Некорректный ID эмодзи.');
  if (!Array.isArray(release.changes) || !release.changes.length) throw new Error('Список изменений пуст.');
  const lines = [`<h1><tg-emoji emoji-id="${config.emojiId}">${escape(emoji)}</tg-emoji> Обновление ${escape(release.version)}</h1>`];
  function append(items, depth = 0) {
    if (depth > 3) throw new Error('Максимум четыре уровня пунктов.');
    lines.push('<ul>');
    for (const item of items) {
      const text = typeof item === 'string' ? item : item?.text;
      if (typeof text !== 'string' || !text.trim() || /[\r\n]/.test(text)) throw new Error('Каждый пункт должен быть одной непустой строкой.');
      lines.push(`<li><input type="checkbox" checked>${escape(text)}`);
      if (item.children) {
        if (!Array.isArray(item.children)) throw new Error('Подпункты должны быть массивом.');
        append(item.children, depth + 1);
      }
      lines.push('</li>');
    }
    lines.push('</ul>');
  }
  append(release.changes);
  if (release.test) lines.push('<footer>Тест формата. Новая версия ещё не опубликована.</footer>');
  else if (release.githubUrl) {
    const url = new URL(release.githubUrl);
    if (url.protocol !== 'https:' || url.hostname !== 'github.com') throw new Error('Нужна ссылка на опубликованный коммит, PR или релиз GitHub.');
    lines.push(`<p><a href="${escape(url.href)}">Изменения на GitHub</a></p>`);
  }
  const html = lines.join('\n');
  if (html.length > 16000 || lines.filter((line) => line.startsWith('<li>')).length > 100)
    throw new Error('Сводка слишком длинная: максимум 100 пунктов и 16 000 символов разметки.');
  return html;
}

export function releasePayload(release, config, emoji) {
  if (!/^-100\d+$/.test(config.chatId) || !Number.isSafeInteger(config.topicId) || config.topicId <= 0)
    throw new Error('Некорректный форум или топик.');
  return {
    chat_id: config.chatId, message_thread_id: config.topicId,
    rich_message: { html: formatRelease(release, config, emoji) }
  };
}
