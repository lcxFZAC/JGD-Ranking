/* Small version checks, cached catalogue, and independently loaded history. */
(function (root) {
  'use strict';
  const BASE = 'https://raw.githubusercontent.com/lcxFZAC/JGD-Ranking/main/data/';
  const CACHE_KEY = 'spotlight-catalogue-v1';
  function validCatalogue(data) {
    return data?.eventId === 28 && !data.partial && Number.isFinite(Date.parse(data.crawledAt)) &&
      Array.isArray(data.games) && data.games.length > 0 && data.summary?.total === data.games.length &&
      data.games.every(g => typeof g.id === 'string' && typeof g.name === 'string' && Number.isFinite(g.heat) && Number.isFinite(g.followers));
  }
  class DataClient {
    constructor({fetcher, storage, initial, base = BASE}) {
      this.fetcher = fetcher;
      this.storage = storage;
      this.base = base;
      this.catalogue = initial;
      this.manifest = null;
      this.history = null;
      this.historyHash = null;
      try {
        const cached = JSON.parse(storage?.getItem(CACHE_KEY));
        if (validCatalogue(cached) && Date.parse(cached.crawledAt) >= Date.parse(initial.crawledAt)) this.catalogue = cached;
      } catch { /* Disabled, corrupt, or full storage must not prevent rendering. */ }
    }
    async json(url) {
      const urls = [url];
      const match = url.match(/^https:\/\/raw\.githubusercontent\.com\/lcxFZAC\/JGD-Ranking\/([^/]+)\/(.+)$/);
      if (match) urls.push(`https://cdn.jsdelivr.net/gh/lcxFZAC/JGD-Ranking@${match[1]}/${match[2]}`);
      let failure;
      for (const source of urls) {
        try {
          const response = await this.fetcher(source, {cache:'no-store', signal:AbortSignal.timeout(15000)});
          if (!response.ok) throw new Error(`HTTP ${response.status}`);
          return await response.json();
        } catch (error) { failure = error; }
      }
      throw failure;
    }
    save(data) {
      if (!validCatalogue(data)) throw new Error('榜单数据无效');
      if (Date.parse(data.crawledAt) < Date.parse(this.catalogue.crawledAt)) return;
      this.catalogue = data;
      try { this.storage?.setItem(CACHE_KEY, JSON.stringify(data)); } catch { /* Quota is optional. */ }
    }
    async check() {
      if (this.pending) return this.pending;
      this.pending = this.checkOnce().catch(async error => {
        // Branch URLs can serve different commits even with no-store/query strings.
        // Resolve a publication commit only on failure, then read immutable URLs.
        if (this.base !== BASE) throw error;
        try { return await this.recoverSnapshot(); } catch { throw error; }
      }).finally(() => { this.pending = null; });
      return this.pending;
    }
    async checkOnce() {
      // Only cold visitors speculate; returning visitors retain version-only checks.
      // Settle errors immediately so a failed speculative request is never unhandled.
      const cold = this.catalogue.partial
        ? this.json(this.base + 'catalogue.json').then(data => ({data}), () => ({data:null})) : null;
      const manifest = await this.json(this.base + 'version.json');
      if (manifest.eventId !== 28 || !Number.isFinite(Date.parse(manifest.version)) ||
          !/^[a-f0-9]{64}$/.test(manifest.catalogueHash) || !/^[a-f0-9]{64}$/.test(manifest.historyHash)) throw new Error('版本信息无效');
      // A stale CDN response may never roll the displayed snapshot backwards.
      if (Date.parse(manifest.version) < Date.parse(this.catalogue.crawledAt)) return this.catalogue;
      if (this.catalogue.partial || this.catalogue.crawledAt !== manifest.version) {
        const candidate = cold ? (await cold).data : null;
        const data = candidate?.crawledAt === manifest.version && validCatalogue(candidate)
          ? candidate : await this.json(this.base + 'catalogue.json?v=' + manifest.catalogueHash);
        if (data.crawledAt !== manifest.version) throw new Error('榜单版本尚未同步，稍后重试');
        this.save(data);
      }
      this.manifest = manifest;
      this.historyBase = this.base;
      return this.catalogue;
    }
    async recoverSnapshot() {
      const commits = await this.json('https://api.github.com/repos/lcxFZAC/JGD-Ranking/commits?path=data/version.json&per_page=1');
      const sha = commits?.[0]?.sha;
      if (!/^[a-f0-9]{40}$/.test(sha)) throw new Error('无法确认数据提交版本');
      const base = BASE.replace('/main/', `/${sha}/`);
      const [manifest, data] = await Promise.all([
        this.json(base + 'version.json'), this.json(base + 'catalogue.json')
      ]);
      if (manifest.eventId !== 28 || !Number.isFinite(Date.parse(manifest.version)) ||
          !/^[a-f0-9]{64}$/.test(manifest.catalogueHash) || !/^[a-f0-9]{64}$/.test(manifest.historyHash) ||
          data.crawledAt !== manifest.version || !validCatalogue(data)) throw new Error('提交中的数据版本不一致');
      if (Date.parse(data.crawledAt) < Date.parse(this.catalogue.crawledAt)) return this.catalogue;
      this.save(data);
      this.manifest = manifest;
      this.historyBase = base;
      return this.catalogue;
    }
    async localFallback() {
      if (!this.catalogue.partial) return this.catalogue;
      const data = await this.json('./data/catalogue.json');
      this.save(data);
      return this.catalogue;
    }
    async loadHistory() {
      if (this.historyPending) return this.historyPending;
      this.historyPending = this.historyOnce().finally(() => { this.historyPending = null; });
      return this.historyPending;
    }
    async historyOnce() {
      const manifest = this.manifest;
      const version = manifest?.version || this.catalogue.crawledAt;
      const key = manifest?.historyHash || version;
      if (this.history && this.historyHash === key) return this.history;
      const data = await this.json(manifest ? (this.historyBase || this.base) + 'history.json?v=' + manifest.historyHash : './data/history.json');
      if (data.eventId !== 28 || !Array.isArray(data.snapshots) || !data.snapshots.some(s => s.ts === version)) throw new Error('历史数据尚未同步，稍后重试');
      this.history = data;
      this.historyHash = key;
      return data;
    }
  }
  if (typeof module === 'object' && module.exports) module.exports = {DataClient, validCatalogue};
  else root.SpotlightDataClient = DataClient;
})(typeof window === 'object' ? window : globalThis);
