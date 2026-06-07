/**
 * parser.js — M3U/M3U8 fetch, parse, and categorize
 * Supports: #EXTINF tags, tvg-* attributes, group-title, Xtream Codes patterns
 */

const Parser = (() => {
  'use strict';

  // ---- Category detection heuristics ----
  const MOVIE_KEYWORDS = /\b(movie|movies|film|films|vod|cinema|cine|pelicul|filme)\b/i;
  const SERIES_KEYWORDS = /\b(series|serie|show|shows|season|seasons|episode|episodes|tv.?show|telenovela|novela|soap)\b/i;
  const LIVE_KEYWORDS = /\b(live|news|sport|sports|channel|channels|tv|radio|music|kids|adult|xxx|entertainment|variety|religious|religion)\b/i;

  // Xtream Codes URL patterns
  const XTREAM_MOVIE_RE = /\/movie\//i;
  const XTREAM_SERIES_RE = /\/series\//i;
  const XTREAM_LIVE_RE = /\/live\//i;

  // Series title patterns (S01E01, 1x01, etc.)
  const SERIES_TITLE_RE = /[Ss]\d{1,3}[Ee]\d{1,3}|\d{1,2}[xX]\d{1,3}|[Ss]eason\s*\d+/i;

  function detectType(item) {
    const group = (item.group || '').toLowerCase();
    const title = (item.title || '').toLowerCase();
    const url = (item.url || '').toLowerCase();

    // Xtream Codes URL takes priority
    if (XTREAM_MOVIE_RE.test(url)) return 'movie';
    if (XTREAM_SERIES_RE.test(url)) return 'series';
    if (XTREAM_LIVE_RE.test(url)) return 'channel';

    // Group-title keyword matching
    if (SERIES_KEYWORDS.test(group)) return 'series';
    if (MOVIE_KEYWORDS.test(group)) return 'movie';

    // Title pattern matching
    if (SERIES_TITLE_RE.test(title)) return 'series';

    // Default to channel
    return 'channel';
  }

  // ---- Parse a single #EXTINF line ----
  function parseExtInf(line) {
    // Format: #EXTINF:-1 tvg-id="..." tvg-name="..." tvg-logo="..." group-title="...",Title
    const commaIdx = line.lastIndexOf(',');
    const attrPart = commaIdx > 0 ? line.substring(8, commaIdx) : line.substring(8);
    const title = commaIdx > 0 ? line.substring(commaIdx + 1).trim() : '';

    const attrs = Utils.parseAttributes(attrPart);

    // Duration (first number after #EXTINF:)
    const durationMatch = attrPart.match(/^(-?\d+(?:\.\d+)?)/);
    const duration = durationMatch ? parseFloat(durationMatch[1]) : -1;

    return {
      title: Utils.sanitizeText(attrs['tvg-name'] || title || 'Unknown'),
      tvgId: attrs['tvg-id'] || '',
      tvgLogo: Utils.sanitizeUrl(attrs['tvg-logo'] || ''),
      group: Utils.sanitizeText(attrs['group-title'] || 'Uncategorized'),
      duration: duration > 0 ? duration : null,
      // Extra Xtream Codes attributes
      tvgChno: attrs['tvg-chno'] || '',
      tvgShift: attrs['tvg-shift'] || '',
      tvgCountry: attrs['tvg-country'] || '',
      tvgLanguage: attrs['tvg-language'] || '',
      // Movie/Series metadata from group or title
      year: extractYear(attrs['tvg-name'] || title || ''),
      rating: attrs['tvg-rating'] || '',
    };
  }

  function extractYear(str) {
    const m = str.match(/\b(19|20)\d{2}\b/);
    return m ? m[0] : '';
  }

  // ---- Main parse function ----
  function parseM3U(text) {
    const lines = text.split(/\r?\n/);
    const channels = [];
    const movies = [];
    const seriesMap = {}; // key: show name

    let currentInfo = null;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      if (line.startsWith('#EXTM3U')) continue;

      if (line.startsWith('#EXTINF:')) {
        currentInfo = parseExtInf(line);
        continue;
      }

      if (line.startsWith('#')) continue; // other directives

      // This is a URL line
      if (currentInfo) {
        const url = Utils.sanitizeUrl(line);
        if (!url) { currentInfo = null; continue; }

        const item = {
          ...currentInfo,
          url,
          id: Utils.generateId(url + currentInfo.title),
        };

        const type = detectType(item);

        if (type === 'movie') {
          movies.push({
            id: item.id,
            title: item.title,
            poster: item.tvgLogo || Utils.PLACEHOLDER_IMG,
            streamUrl: item.url,
            group: item.group,
            year: item.year,
            duration: item.duration,
            rating: item.rating,
            synopsis: '',
            genre: item.group,
          });
        } else if (type === 'series') {
          const info = Utils.parseSeriesInfo(item.title);
          const showKey = Utils.generateId(info.show);
          if (!seriesMap[showKey]) {
            seriesMap[showKey] = {
              id: showKey,
              title: info.show,
              poster: item.tvgLogo || Utils.PLACEHOLDER_IMG,
              group: item.group,
              synopsis: '',
              genre: item.group,
              seasons: {}
            };
          }
          const show = seriesMap[showKey];
          // Update poster if we have one
          if (item.tvgLogo && !show.poster.startsWith('data:')) {
            show.poster = item.tvgLogo;
          }
          const seasonNum = info.season;
          if (!show.seasons[seasonNum]) {
            show.seasons[seasonNum] = [];
          }
          show.seasons[seasonNum].push({
            id: item.id,
            episode: info.episode,
            title: item.title,
            streamUrl: item.url,
            duration: item.duration,
          });
        } else {
          // Channel
          channels.push({
            id: item.id,
            title: item.title,
            logo: item.tvgLogo || Utils.PLACEHOLDER_WIDE,
            streamUrl: item.url,
            group: item.group,
            tvgId: item.tvgId,
            tvgChno: item.tvgChno,
          });
        }

        currentInfo = null;
      }
    }

    // Convert seriesMap to array and sort seasons/episodes
    const series = Object.values(seriesMap).map(show => {
      const seasons = {};
      Object.keys(show.seasons).sort((a,b) => a-b).forEach(s => {
        seasons[s] = show.seasons[s].sort((a,b) => a.episode - b.episode);
      });
      return { ...show, seasons };
    });

    return { channels, movies, series };
  }

  // ---- CORS proxy helpers ----
  const CORS_PROXIES = [
    url => `https://corsproxy.io/?url=${encodeURIComponent(url)}`,
    url => `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`,
  ];

  async function fetchText(fetchUrl) {
    const response = await fetch(fetchUrl, {
      method: 'GET',
      headers: { 'Accept': 'application/x-mpegurl, text/plain, */*' },
      cache: 'no-store'
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    return response.text();
  }

  // ---- Fetch and parse ----
  async function fetchAndParse(url) {
    const safeUrl = Utils.sanitizeUrl(url);
    if (!safeUrl) throw new Error('Invalid URL');

    const settings = Storage.getSettings();
    // proxyMode: 'auto' (default) | 'always' | 'never'
    const proxyMode = settings.corsProxy || 'auto';

    let text = null;
    let usedProxy = false;

    if (proxyMode === 'never') {
      // Direct only
      text = await fetchText(safeUrl);
    } else if (proxyMode === 'always') {
      // Skip direct, go straight to first proxy
      text = await fetchText(CORS_PROXIES[0](safeUrl));
      usedProxy = true;
    } else {
      // auto: try direct first, fall back to proxies
      try {
        text = await fetchText(safeUrl);
      } catch (directErr) {
        let lastErr = directErr;
        for (const proxyFn of CORS_PROXIES) {
          try {
            text = await fetchText(proxyFn(safeUrl));
            usedProxy = true;
            break;
          } catch (proxyErr) {
            lastErr = proxyErr;
          }
        }
        if (!usedProxy) throw lastErr;
      }
    }

    if (!text || !text.trim().startsWith('#EXTM3U')) {
      throw new Error('Not a valid M3U file');
    }

    if (usedProxy) {
      Utils.showToast('Loaded via CORS proxy (HTTP URL detected)', 'info');
    }

    const result = parseM3U(text);
    await Storage.saveCache(result);
    Storage.saveLastPlaylistUrl(safeUrl);
    return result;
  }

  // ---- Get unique groups/categories ----
  function getCategories(items) {
    const groups = new Set();
    items.forEach(item => {
      if (item.group) groups.add(item.group);
    });
    return ['All', ...Array.from(groups).sort()];
  }

  // ---- Filter by category ----
  function filterByCategory(items, category) {
    if (!category || category === 'All') return items;
    return items.filter(item => item.group === category);
  }

  return {
    parseM3U,
    fetchAndParse,
    getCategories,
    filterByCategory,
    detectType
  };
})();
