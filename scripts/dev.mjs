import { spawn } from 'node:child_process';
const children = [];
const port = process.env.STUDIO_PORT || '4173';
const env = { ...process.env, CATALOG_DEV: '1', CATALOG_ORIGIN: `http://127.0.0.1:${port}` };
for (const args of [['server/catalog-api.mjs'], ['node_modules/vite/bin/vite.js', '--host', '127.0.0.1', '--port', port, '--strictPort']]) {
  const child = spawn(process.execPath, args, { env, stdio: 'inherit', windowsHide: true }); children.push(child);
  child.on('exit', code => { for (const other of children) if (other !== child) other.kill(); process.exitCode = code || 0; });
}
for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, () => { for (const child of children) child.kill(); });
