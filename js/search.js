/**
 * search.js — Real-time global search engine
 * Searches across channels, movies, and series
 */

const SearchEngine = (() => {
  'use strict';

  let _index = { channels: [], movies: [], series: [] };

  // ---- Build index from cache ----
  function buildIndex(cache) {
    _index = {
      channels: (cache.channels || []).map(c => ({
        ...c,
        _searchText: [c.title, c.group, c.tvgId].filter(Boolean).join(' ').toLowerCase()
      })),
      movies: (cache.movies || []).map(m => ({
        ...m,
        _searchText: [m.title, m.group, m.genre, m.year].filter(Boolean).join(' ').toLowerCase()
      })),
      series: (cache.series || []).map(s => ({
        ...s,
        _searchText: [s.title, s.group, s.genre].filter(Boolean).join(' ').toLowerCase()
      }))
    };
  }

  // ---- Score a single item ----
  function score(item, query) {
    const q = query.toLowerCase();
    const text = item._searchText || '';
    const title = (item.title || '').toLowerCase();

    if (title === q) return 100;
    if (title.startsWith(q)) return 80;
    if (title.includes(q)) return 60;
    if (text.includes(q)) return 40;

    // Fuzzy: all words present
    const words = q.split(/\s+/).filter(Boolean);
    if (words.length > 1 && words.every(w => text.includes(w))) return 30;

    return 0;
  }

  // ---- Search ----
  function search(query, limit = 50) {
    if (!query || query.trim().length < 1) {
      return { channels: [], movies: [], series: [] };
    }

    const q = query.trim();

    const channels = _index.channels
      .map(item => ({ item, s: score(item, q) }))
      .filter(x => x.s > 0)
      .sort((a, b) => b.s - a.s)
      .slice(0, limit)
      .map(x => x.item);

    const movies = _index.movies
      .map(item => ({ item, s: score(item, q) }))
      .filter(x => x.s > 0)
      .sort((a, b) => b.s - a.s)
      .slice(0, limit)
      .map(x => x.item);

    const series = _index.series
      .map(item => ({ item, s: score(item, q) }))
      .filter(x => x.s > 0)
      .sort((a, b) => b.s - a.s)
      .slice(0, limit)
      .map(x => x.item);

    return { channels, movies, series };
  }

  // ---- Quick suggestions (top 5 per type) ----
  function suggest(query) {
    const results = search(query, 5);
    return [
      ...results.channels.map(c => ({ ...c, type: 'channel' })),
      ...results.movies.map(m => ({ ...m, type: 'movie' })),
      ...results.series.map(s => ({ ...s, type: 'series' })),
    ].slice(0, 10);
  }

  return { buildIndex, search, suggest };
})();
