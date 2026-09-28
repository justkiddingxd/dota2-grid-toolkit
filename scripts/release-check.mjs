import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { releasePayload } from './release-format.mjs';

try {
  const pkg = JSON.parse(readFileSync('package.json', 'utf8'));
  const lock = JSON.parse(readFileSync('package-lock.json', 'utf8'));
  if (pkg.version !== lock.version || pkg.version !== lock.packages[''].version) throw new Error('Версии package.json и package-lock.json различаются.');
  const file = process.argv[2] || 'releases/draft.json';
  const release = JSON.parse(readFileSync(file, 'utf8'));
  const config = JSON.parse(readFileSync('releases/telegram.json', 'utf8'));
  releasePayload(release, config);
  const run = (...args) => {
    const result = spawnSync('git', ['-c', `safe.directory=${process.cwd().replaceAll('\\', '/')}`, ...args], { encoding: 'utf8' });
    if (result.status !== 0) throw new Error('Не удалось проверить Git.');
    return result.stdout.trim();
  };
  const staged = run('diff', '--cached', '--name-only').split('\n').filter(Boolean);
  const forbidden = /(^|\/)(\.env(?:\.|$)|\.release-state\/|node_modules\/|dist\/|release-artifacts\/|test-results\/|exports\/|deploy\/)|^docs\/deployment\.md$/;
  const unsafe = staged.filter((path) => path !== '.env.example' && (forbidden.test(path) || /\.(?:key|pem)$/i.test(path)));
  if (unsafe.length) throw new Error(`Проверь приватные файлы в индексе: ${unsafe.join(', ')}`);
  if (staged.includes('project.md') && !run('show', ':project.md').startsWith('<!-- GridStudio public project context -->'))
    throw new Error('Для project.md используй проверенную публичную копию из for_github, не локальный документ.');
  const diff = run('diff', '--cached', '--no-ext-diff', '--unified=0');
  if (/^\+(?!\+).*\b\d{6,}:[A-Za-z0-9_-]{30,}/m.test(diff)) throw new Error('В staged-изменениях обнаружен похожий на токен Telegram секрет.');
  console.log(JSON.stringify({ currentVersion: pkg.version, draftVersion: release.version, branch: run('branch', '--show-current'), commit: run('rev-parse', '--short', 'HEAD'), stagedFiles: staged.length, status: 'Локальная проверка. Сборка и публикация не выполнялись.' }, null, 2));
} catch (error) { console.error(error.message); process.exitCode = 1; }
