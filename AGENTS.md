# GridStudio development rules

User decision, 2026-09-28. These rules supersede the previous automatic server deployment workflow.

- Work locally. Do not run a production build until the user explicitly requests a build. Development server, syntax checks and tests are allowed.
- Do not deploy, push commits/tags, publish a GitHub release or post release announcements until the user explicitly approves that release for publication. Approval to build alone is not approval to publish.
- Number releases with SemVer. `package.json` is the source of the application version. The existing 1.0.0 is the numbering baseline, not a claim that a tagged release exists. Increment only when preparing the next authorized build; keep unfinished changes under Unreleased in CHANGELOG.md.
- Every approved release must have a source commit/tag on GitHub and a reviewed changelog. Contributor account: justkiddingxd; upstream: linsisss/dota2-grid-toolkit. Without write access, publish a branch in the contributor's fork and open a PR. Never force-push upstream.
- Release announcements use puregram sendRichMessage (not ordinary sendMessage), chat -1004309207941, topic 2, custom emoji 5316617119524236973. Real h1 heading: «Обновление VERSION»; native checked task list items with nested lists. Sending a test needs its own user authorization; the initial test was explicitly requested on 2026-09-28.
- Tokens belong only in ignored local environment files or secret environment variables. Never place them in frontend code, VITE_* variables, logs, GitHub, or for_github.
- Preserve the autosave storage key and schema across application releases. Back up raw documents before migration. Never replace an unreadable project with a demo. Test recovery, quota errors and competing tabs when changing persistence.
- Read docs/releases.md and docs/project-storage.md for the release and recovery implementation. Update both context documents when behavior changes. Do not copy the private root project.md into the public for_github directory.
- Existing dirty/untracked files are project work. Do not clean/reset them. Before a release review exactly which files will be committed; local deployment files and user exports are not release source.
