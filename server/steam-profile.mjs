import { parseSteamProfile, steamAccount } from '../scripts/steam-profile.mjs';
import { fail } from './catalog-store.mjs';

const unavailable = () => fail(503, 'Steam сейчас не отвечает. Попробуй позже или введи код друга.');
const missing = () => fail(404, 'Профиль не найден. Проверь ссылку или введи код друга.');
async function readLimited(response) {
  if (Number(response.headers.get('content-length')) > 262144) throw new Error('Response too large');
  const chunks = []; let size = 0;
  for await (const chunk of response.body) {
    size += chunk.length;
    if (size > 262144) throw new Error('Response too large');
    chunks.push(chunk);
  }
  return Buffer.concat(chunks).toString('utf8');
}

export class SteamProfiles {
  constructor({ apiKey = '', fetch = globalThis.fetch, now = Date.now } = {}) {
    this.apiKey = apiKey; this.fetch = fetch; this.now = now;
    this.cache = new Map(); this.pending = new Map();
  }
  async resolve(input) {
    let parsed;
    try { parsed = parseSteamProfile(input); } catch (error) { fail(400, error.message); }
    if (parsed.kind === 'account') return { accountId: parsed.accountId, steamId64: parsed.steamId64 };
    const name = parsed.vanity;
    const cached = this.cache.get(name);
    if (cached?.expires > this.now()) return cached.value;
    if (this.pending.has(name)) return this.pending.get(name);
    if (this.pending.size >= 16) return unavailable();
    const promise = this.lookup(name).then(value => {
      if (this.cache.size >= 512) this.cache.delete(this.cache.keys().next().value);
      this.cache.set(name, { value, expires: this.now() + 15 * 60_000 });
      return value;
    }).finally(() => this.pending.delete(name));
    this.pending.set(name, promise);
    return promise;
  }
  async request(url) {
    // Never fetch the submitted URL or follow its redirects. Only fixed Steam hosts.
    return this.fetch(url, { redirect: 'error', signal: AbortSignal.timeout(4500), headers: { Accept: 'application/json, text/xml' } });
  }
  async lookup(vanity) {
    if (this.apiKey) {
      let result;
      try {
        const url = new URL('https://api.steampowered.com/ISteamUser/ResolveVanityURL/v1/');
        url.search = new URLSearchParams({ key: this.apiKey, vanityurl: vanity, url_type: '1' });
        const response = await this.request(url);
        if (response.ok) result = JSON.parse(await readLimited(response)).response;
        if (result?.success === 1) return steamAccount(result.steamid, true);
      } catch { /* The public profile remains a fallback if the API is unavailable. */ }
      if (result?.success === 42) return missing();
    }
    let response, xml;
    try {
      response = await this.request(`https://steamcommunity.com/id/${encodeURIComponent(vanity)}/?xml=1`);
      if (response.ok) xml = await readLimited(response);
    } catch { return unavailable(); }
    if (response.status === 404) return missing();
    if (!response.ok || !xml || !/^\s*(?:<\?xml[^>]*>\s*)?<(?:profile|response)\b/.test(xml)) return unavailable();
    const steamId = /<steamID64>\s*(\d{17})\s*<\/steamID64>/.exec(xml)?.[1];
    if (!steamId) return /<error[>\s]/.test(xml) ? missing() : unavailable();
    try { return steamAccount(steamId, true); } catch { return unavailable(); }
  }
}
