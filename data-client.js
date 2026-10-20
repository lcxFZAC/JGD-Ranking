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
      const response = await this.fetcher(url, {cache:'no-store', signal:AbortSignal.timeout(15000)});
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return response.json();
    }
    save(data) {
      if (!validCatalogue(data)) throw new Error('榜单数据无效');
      if (Date.parse(data.crawledAt) < Date.parse(this.catalogue.crawledAt)) return;
      this.catalogue = data;
      try { this.storage?.setItem(CACHE_KEY, JSON.stringify(data)); } catch { /* Quota is optional. */ }
    }
    async check() {
      if (this.pending) return this.pending;
      this.pending = this.checkOnce().finally(() => { this.pending = null; });
      return this.pending;
    }
    async checkOnce() {
      const manifest = await this.json(this.base + 'version.json');
      if (manifest.eventId !== 28 || !Number.isFinite(Date.parse(manifest.version)) ||
          !/^[a-f0-9]{64}$/.test(manifest.catalogueHash) || !/^[a-f0-9]{64}$/.test(manifest.historyHash)) throw new Error('版本信息无效');
      // A stale CDN response may never roll the displayed snapshot backwards.
      if (Date.parse(manifest.version) < Date.parse(this.catalogue.crawledAt)) return this.catalogue;
      if (this.catalogue.partial || this.catalogue.crawledAt !== manifest.version) {
        const data = await this.json(this.base + 'catalogue.json?v=' + manifest.catalogueHash);
        if (data.crawledAt !== manifest.version) throw new Error('榜单版本尚未同步，稍后重试');
        this.save(data);
      }
      this.manifest = manifest;
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
      const data = await this.json(manifest ? this.base + 'history.json?v=' + manifest.historyHash : './data/history.json');
      if (data.eventId !== 28 || !Array.isArray(data.snapshots) || !data.snapshots.some(s => s.ts === version)) throw new Error('历史数据尚未同步，稍后重试');
      this.history = data;
      this.historyHash = key;
      return data;
    }
  }
  if (typeof module === 'object' && module.exports) module.exports = {DataClient, validCatalogue};
  else root.SpotlightDataClient = DataClient;
})(typeof window === 'object' ? window : globalThis);
