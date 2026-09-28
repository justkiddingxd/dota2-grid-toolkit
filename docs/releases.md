# Версии и публикация GridStudio

Порядок принят пользователем 28.09.2026. Разработка локально. `npm run dev`, `npm run check`, `npm test` и `npm run release:check` не публикуют проект и не создают production build.

## Версии

Источник номера — `package.json`; Vite подставляет его в справку редактора. База — существующая `1.0.0`. Следующий черновик — `releases/draft.json`, `1.0.1`. Пока это **не выпущенная версия**.

- Patch: исправления без изменения формата проекта.
- Minor: совместимые новые возможности.
- Major: несовместимые изменения; необходимы миграция, сохранение исходных данных и тесты старых проектов.

Номер версии приложения не является номером схемы проекта, ключа localStorage или базы IndexedDB. Их нельзя менять вместе с каждой версией.

## Обычная работа

1. Менять исходники локально, обновлять раздел Unreleased в CHANGELOG.md.
2. Проверять синтаксис, тесты и интерфейс через dev server.
3. Дополнять черновик сводки. `npm run telegram:preview -- releases/draft.json` только печатает разметку, ничего не отправляет.
4. Не запускать build, не трогать сервер, не пушить и не отправлять релизные сообщения без соответствующей команды пользователя.

## После команды «собери»

1. Уточнить фактический номер по текущему package.json и тегам, не повторять уже выпущенный номер.
2. Например, `npm version 1.0.1 --no-git-tag-version` обновляет package.json и lockfile. Само по себе не коммитит, не собирает и не публикует.
3. Перенести готовые пункты из Unreleased в раздел версии, согласовать ту же версию в JSON сводки.
4. `npm run check`, `npm test`, `npm run release:check`, затем `npm run build`.
5. Проверить именно этот dist, сохранить номер версии и SHA исходного коммита в описании сборки. После изменений исходников снова собрать только в рамках одобренной работы.

CI `test.yml` проверяет push/PR без сборки. `build.yml` создаёт артефакт только через ручной workflow_dispatch, проверяет введённую версию и не деплоит сайт. Сохранённый upstream workflow `deploy-pages.yml` также запускается только вручную; для Pages он задаёт `VITE_EDITOR_ENTRY=editor.html`. Запускать сборку или деплой агент может только по соответствующей команде пользователя.

## GitHub и авторство

Аккаунт участника: `justkiddingxd`. Upstream: https://github.com/linsisss/dota2-grid-toolkit.

Без прав на запись: fork → ветка `codex/release-VERSION` → commit/push в свой fork → Pull Request в upstream. Владелец проверяет PR и делает merge. Сам Approve не добавляет коммиты в основную ветку; вклад учитывается после merge с корректным авторством. Email коммитов должен быть привязан к GitHub-аккаунту, можно использовать его GitHub noreply email. При squash проверить сохранение автора. Contributor — не то же самое, что collaborator с правом push.

Нельзя угадывать email/учётные данные, форсировать push, перезаписывать main или автоматически сливать PR. До первой публикации проверить аутентификацию `justkiddingxd`, создать/найти fork, получить актуальный upstream и сравнить историю. Текущая локальная ветка исторически называется `feat/unified-grid-studio`; автоматически не переименовывалась. В upstream уже есть новые коммиты, поэтому нельзя считать локальный origin/main актуальным.

Перед commit: просмотреть `git diff --cached`; выбирать публичные исходники явно, не `git add .`. Локальный приватный project.md, deploy/, docs/deployment.md, exports/, test-results/, токены и .release-state не публиковать. Для project.md использовать отдельно очищенную версию из for_github с первой строкой `<!-- GridStudio public project context -->`. `npm run release:check` разрешает этот проверенный документ и пустой шаблон `.env.example`, проверяет остальные staged-пути и похожие на токены Telegram строки, но не заменяет просмотр диффа. Не переносить маркер в приватный документ.

Каждый одобренный build должен соответствовать исходному commit и тегу `vVERSION` в репозитории выпускающего. Собранный dist распространять как артефакт или ZIP GitHub Release, а не коммитить node_modules/dist в исходники. Создание GitHub Release, push и PR — после разрешения пользователя на публикацию.

## Telegram: только rich message через puregram

Форум: `-1004309207941`; топик Builds: `2`; логотип: `5316617119524236973`.

Используется **sendRichMessage**, не sendMessage с обычным HTML. Заголовок `<h1>` содержит custom emoji и «Обновление VERSION». Пункты — настоящие task list items `<li><input type="checkbox" checked>`, подпункты — вложенный `<ul>`. В конце ссылка на опубликованный commit/PR/release на GitHub. Токен не передаётся в браузер.

1. Токен в `TELEGRAM_BOT_TOKEN` или игнорируемом `.env.release.local`; пример — `.env.example`. Файл с токеном нельзя копировать в for_github.
2. Предпросмотр: `npm run telegram:preview -- releases/draft.json`.
3. После разрешения опубликовать релиз: сначала commit/push/PR на GitHub, затем добавить реальную `githubUrl` и проверить номер версии.
4. Отправка: `npm run telegram:preview -- releases/draft.json --send --approved`.

Скрипт проверяет совпадение версии с package.json, наличие GitHub-ссылки, формат и размер сводки. Квитанция с message ID пишется в .release-state. Повтор той же версии автоматически запрещён. При таймауте квитанция остаётся pending: сначала проверить чат, не удалять её ради слепого повтора. Обычные сетевые повторы отключены.

Тест имеет явный `test: true`, не считается релизом и не требует GitHub-ссылки. Отправлять тест можно только по просьбе пользователя: `npm run telegram:test -- --send`. Исправление своего ранее отправленного теста: добавить `--edit-test=MESSAGE_ID` (ID сверяется с локальной квитанцией). 28.09.2026 тест №17 в топике 2 отправлен и затем заменён на rich message; API подтвердил rich_message и custom emoji. Новая сборка при этом не публиковалась.

Справка: [GitHub contributions](https://docs.github.com/en/account-and-profile/reference/profile-contributions-reference), [fork и Pull Request](https://docs.github.com/en/get-started/exploring-projects-on-github/contributing-to-a-project), [Telegram rich messages](https://core.telegram.org/bots/api#rich-messages), [puregram](https://github.com/puregram/puregram).
