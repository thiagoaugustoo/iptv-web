/**
 * storage.js — IndexedDB + localStorage abstraction
 * Stores: iptvCache, favorites, history, continueWatching
 * localStorage: lastPlaylistUrl, settings
 */

const Storage = (() => {
  'use strict';

  const DB_NAME = 'IPTVWebDB';
  const DB_VERSION = 1;
  const STORES = ['iptvCache', 'favorites', 'history', 'continueWatching'];

  let _db = null;

  // ---- Open DB ----
  function openDB() {
    return new Promise((resolve, reject) => {
      if (_db) { resolve(_db); return; }
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = (e) => {
        const db = e.target.result;
        STORES.forEach(storeName => {
          if (!db.objectStoreNames.contains(storeName)) {
            db.createObjectStore(storeName, { keyPath: 'id' });
          }
        });
      };
      req.onsuccess = (e) => { _db = e.target.result; resolve(_db); };
      req.onerror = (e) => reject(e.target.error);
    });
  }

  // ---- Generic get ----
  async function get(storeName, id) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, 'readonly');
      const req = tx.objectStore(storeName).get(id);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error);
    });
  }

  // ---- Generic set ----
  async function set(storeName, obj) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, 'readwrite');
      const req = tx.objectStore(storeName).put(obj);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  // ---- Generic delete ----
  async function remove(storeName, id) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, 'readwrite');
      const req = tx.objectStore(storeName).delete(id);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }

  // ---- Get all ----
  async function getAll(storeName) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, 'readonly');
      const req = tx.objectStore(storeName).getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });
  }

  // ---- Clear store ----
  async function clearStore(storeName) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, 'readwrite');
      const req = tx.objectStore(storeName).clear();
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }

  // ---- IPTV Cache ----
  async function saveCache(data) {
    // data: { channels, movies, series, updatedAt }
    await set('iptvCache', { id: 'main', ...data, updatedAt: Date.now() });
  }

  async function loadCache() {
    return await get('iptvCache', 'main');
  }

  async function isCacheStale(maxAgeMs = 3600000) {
    const cache = await loadCache();
    if (!cache || !cache.updatedAt) return true;
    return (Date.now() - cache.updatedAt) > maxAgeMs;
  }

  // ---- Favorites ----
  async function getFavorites() {
    return await getAll('favorites');
  }

  async function addFavorite(item) {
    // item: { id, type, title, poster, streamUrl }
    await set('favorites', item);
  }

  async function removeFavorite(id) {
    await remove('favorites', id);
  }

  async function isFavorite(id) {
    const item = await get('favorites', id);
    return !!item;
  }

  async function toggleFavorite(item) {
    const exists = await isFavorite(item.id);
    if (exists) {
      await removeFavorite(item.id);
      return false;
    } else {
      await addFavorite(item);
      return true;
    }
  }

  // ---- History ----
  async function getHistory() {
    const all = await getAll('history');
    return all.sort((a, b) => (b.watchedAt || 0) - (a.watchedAt || 0));
  }

  async function addHistory(item) {
    // item: { id, type, title, poster, watchedAt, progress }
    await set('history', { ...item, watchedAt: Date.now() });
  }

  async function removeHistory(id) {
    await remove('history', id);
  }

  async function clearHistory() {
    await clearStore('history');
  }

  // ---- Continue Watching ----
  async function getContinueWatching() {
    const all = await getAll('continueWatching');
    return all.sort((a, b) => (b.lastWatched || 0) - (a.lastWatched || 0));
  }

  async function saveContinueWatching(item) {
    // item: { id, type, title, poster, season, episode, currentTime, duration, lastWatched }
    await set('continueWatching', { ...item, lastWatched: Date.now() });
  }

  async function removeContinueWatching(id) {
    await remove('continueWatching', id);
  }

  async function getContinueWatchingItem(id) {
    return await get('continueWatching', id);
  }

  // ---- localStorage helpers ----
  function lsGet(key, defaultVal = null) {
    try {
      const val = localStorage.getItem(key);
      if (val === null) return defaultVal;
      return JSON.parse(val);
    } catch { return defaultVal; }
  }

  function lsSet(key, val) {
    try { localStorage.setItem(key, JSON.stringify(val)); } catch {}
  }

  function lsRemove(key) {
    try { localStorage.removeItem(key); } catch {}
  }

  // ---- Settings ----
  const DEFAULT_SETTINGS = {
    theme: 'dark',
    playerVolume: 100,
    lastCategory: 'All',
    preferredQuality: 'auto'
  };

  function getSettings() {
    return { ...DEFAULT_SETTINGS, ...lsGet('settings', {}) };
  }

  function saveSettings(settings) {
    lsSet('settings', { ...getSettings(), ...settings });
  }

  // ---- Last Playlist URL ----
  function getLastPlaylistUrl() {
    return lsGet('lastPlaylistUrl', '');
  }

  function saveLastPlaylistUrl(url) {
    lsSet('lastPlaylistUrl', url);
  }

  return {
    openDB,
    get,
    set,
    remove,
    getAll,
    clearStore,
    saveCache,
    loadCache,
    isCacheStale,
    getFavorites,
    addFavorite,
    removeFavorite,
    isFavorite,
    toggleFavorite,
    getHistory,
    addHistory,
    removeHistory,
    clearHistory,
    getContinueWatching,
    saveContinueWatching,
    removeContinueWatching,
    getContinueWatchingItem,
    lsGet,
    lsSet,
    lsRemove,
    getSettings,
    saveSettings,
    getLastPlaylistUrl,
    saveLastPlaylistUrl
  };
})();
