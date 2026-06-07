/**
 * ui/home.js — Home page: Continue Watching, Favorites, Recent Channels/Movies/Series
 */

const UIHome = (() => {
  'use strict';

  async function render(cache) {
    const container = document.getElementById('pageContainer');
    container.innerHTML = '';

    // Playlist status bar
    const statusBar = document.createElement('div');
    statusBar.id = 'playlistStatus';
    statusBar.className = 'playlist-status';
    statusBar.innerHTML = `<div class="dot"></div><span class="status-text">Loading...</span>`;
    container.appendChild(statusBar);

    // Apply any pending status from app.js
    if (typeof App !== 'undefined' && App.applyPendingStatus) {
      App.applyPendingStatus();
    }

    // Loading state
    const loadingEl = document.createElement('div');
    loadingEl.className = 'loading-wrap';
    loadingEl.innerHTML = '<div class="spinner"></div><span>Loading...</span>';
    container.appendChild(loadingEl);

    // Load async data
    const [continueWatching, favorites, history] = await Promise.all([
      Storage.getContinueWatching(),
      Storage.getFavorites(),
      Storage.getHistory()
    ]);

    loadingEl.remove();

    const channels = cache.channels || [];
    const movies   = cache.movies   || [];
    const series   = cache.series   || [];

    const hasContent = channels.length || movies.length || series.length;

    if (!hasContent && !continueWatching.length && !favorites.length) {
      renderEmpty(container);
      return;
    }

    // Continue Watching
    if (continueWatching.length > 0) {
      container.appendChild(buildRow('Continue Watching', continueWatching, renderContinueCard, 'continueWatching'));
    }

    // Favorites
    if (favorites.length > 0) {
      container.appendChild(buildRow('My Favorites', favorites, renderFavCard, 'favorites'));
    }

    // Recent Channels
    if (channels.length > 0) {
      const recentChannels = getRecentItems(history, channels, 'channel', 20);
      const displayChannels = recentChannels.length > 0 ? recentChannels : channels.slice(0, 20);
      container.appendChild(buildRow('Live Channels', displayChannels, renderChannelCard, 'livetv'));
    }

    // Recent Movies
    if (movies.length > 0) {
      const recentMovies = getRecentItems(history, movies, 'movie', 20);
      const displayMovies = recentMovies.length > 0 ? recentMovies : movies.slice(0, 20);
      container.appendChild(buildRow('Movies', displayMovies, renderMovieCard, 'movies'));
    }

    // Recent Series
    if (series.length > 0) {
      const recentSeries = getRecentItems(history, series, 'series', 20);
      const displaySeries = recentSeries.length > 0 ? recentSeries : series.slice(0, 20);
      container.appendChild(buildRow('Series', displaySeries, renderSeriesCard, 'series'));
    }

    Utils.initLazyImages();
  }

  function getRecentItems(history, items, type, limit) {
    const historyIds = history
      .filter(h => h.type === type)
      .map(h => h.id);
    if (historyIds.length === 0) return [];
    const idSet = new Set(historyIds);
    return items.filter(item => idSet.has(item.id)).slice(0, limit);
  }

  function buildRow(title, items, cardFn, moreRoute) {
    const section = document.createElement('div');
    section.className = 'section-row';

    const header = document.createElement('div');
    header.className = 'section-row-header';
    header.innerHTML = `
      <h2 class="section-row-title">${Utils.sanitizeText(title)}</h2>
      <span class="section-row-more" tabindex="0" data-route="${moreRoute}">See all</span>
    `;
    header.querySelector('.section-row-more').addEventListener('click', () => {
      App.navigate(moreRoute);
    });
    header.querySelector('.section-row-more').addEventListener('keydown', e => {
      if (e.key === 'Enter') App.navigate(moreRoute);
    });
    section.appendChild(header);

    const scroll = document.createElement('div');
    scroll.className = 'cards-scroll';
    items.forEach(item => {
      const card = cardFn(item);
      if (card) scroll.appendChild(card);
    });
    section.appendChild(scroll);
    return section;
  }

  function renderContinueCard(item) {
    const card = document.createElement('div');
    card.className = 'card';
    card.style.width = '200px';
    card.tabIndex = 0;
    card.setAttribute('aria-label', item.title);

    const pct = item.duration > 0 ? Math.round((item.currentTime / item.duration) * 100) : 0;

    card.innerHTML = `
      <img class="card-poster-wide" data-src="${Utils.sanitizeUrl(item.poster) || Utils.PLACEHOLDER_WIDE}" src="${Utils.PLACEHOLDER_WIDE}" alt="${Utils.sanitizeText(item.title)}" />
      <div class="card-info">
        <div class="card-title">${Utils.sanitizeText(item.title)}</div>
        <div class="card-meta">${item.season ? `S${item.season}E${item.episode} · ` : ''}${Utils.formatDuration(item.currentTime)} / ${Utils.formatDuration(item.duration)}</div>
      </div>
      <div class="card-progress"><div class="card-progress-fill" style="width:${pct}%"></div></div>
    `;

    card.addEventListener('click', () => {
      App.playItem({
        id: item.id,
        type: item.type,
        title: item.title,
        poster: item.poster,
        streamUrl: item.streamUrl || '',
        startTime: item.currentTime,
        season: item.season,
        episode: item.episode
      });
    });

    Utils.observeImage(card.querySelector('img'));
    return card;
  }

  function renderFavCard(item) {
    const card = document.createElement('div');
    card.className = 'card';
    card.style.width = item.type === 'channel' ? '180px' : '140px';
    card.tabIndex = 0;
    card.setAttribute('aria-label', item.title);

    const posterClass = item.type === 'channel' ? 'card-poster-wide' : 'card-poster';
    card.innerHTML = `
      <img class="${posterClass}" data-src="${Utils.sanitizeUrl(item.poster) || Utils.PLACEHOLDER_IMG}" src="${Utils.PLACEHOLDER_IMG}" alt="${Utils.sanitizeText(item.title)}" />
      <div class="card-info">
        <div class="card-title">${Utils.sanitizeText(item.title)}</div>
        <div class="card-meta">${Utils.sanitizeText(item.type)}</div>
      </div>
    `;

    card.addEventListener('click', () => {
      if (item.type === 'channel') {
        App.playItem({ ...item });
      } else if (item.type === 'movie') {
        UIMovies.openDetail(item);
      } else if (item.type === 'series') {
        UISeries.openDetail(item);
      }
    });

    Utils.observeImage(card.querySelector('img'));
    return card;
  }

  function renderChannelCard(item) {
    const card = document.createElement('div');
    card.className = 'card';
    card.style.width = '180px';
    card.tabIndex = 0;
    card.setAttribute('aria-label', item.title);

    card.innerHTML = `
      <img class="card-poster-wide" data-src="${Utils.sanitizeUrl(item.logo) || Utils.PLACEHOLDER_WIDE}" src="${Utils.PLACEHOLDER_WIDE}" alt="${Utils.sanitizeText(item.title)}" />
      <div class="card-info">
        <div class="card-title">${Utils.sanitizeText(item.title)}</div>
        <div class="card-meta">${Utils.sanitizeText(item.group || '')}</div>
      </div>
    `;

    card.addEventListener('click', () => {
      App.playItem({
        id: item.id,
        type: 'channel',
        title: item.title,
        poster: item.logo,
        streamUrl: item.streamUrl
      });
    });

    Utils.observeImage(card.querySelector('img'));
    return card;
  }

  function renderMovieCard(item) {
    const card = document.createElement('div');
    card.className = 'card';
    card.style.width = '140px';
    card.tabIndex = 0;
    card.setAttribute('aria-label', item.title);

    card.innerHTML = `
      <img class="card-poster" data-src="${Utils.sanitizeUrl(item.poster) || Utils.PLACEHOLDER_IMG}" src="${Utils.PLACEHOLDER_IMG}" alt="${Utils.sanitizeText(item.title)}" />
      <div class="card-info">
        <div class="card-title">${Utils.sanitizeText(item.title)}</div>
        <div class="card-meta">${Utils.sanitizeText(item.year || item.genre || '')}</div>
      </div>
    `;

    card.addEventListener('click', () => UIMovies.openDetail(item));
    Utils.observeImage(card.querySelector('img'));
    return card;
  }

  function renderSeriesCard(item) {
    const card = document.createElement('div');
    card.className = 'card';
    card.style.width = '140px';
    card.tabIndex = 0;
    card.setAttribute('aria-label', item.title);

    const seasonCount = Object.keys(item.seasons || {}).length;

    card.innerHTML = `
      <img class="card-poster" data-src="${Utils.sanitizeUrl(item.poster) || Utils.PLACEHOLDER_IMG}" src="${Utils.PLACEHOLDER_IMG}" alt="${Utils.sanitizeText(item.title)}" />
      <div class="card-info">
        <div class="card-title">${Utils.sanitizeText(item.title)}</div>
        <div class="card-meta">${seasonCount} Season${seasonCount !== 1 ? 's' : ''}</div>
      </div>
    `;

    card.addEventListener('click', () => UISeries.openDetail(item));
    Utils.observeImage(card.querySelector('img'));
    return card;
  }

  function renderEmpty(container) {
    const el = document.createElement('div');
    el.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">📺</div>
        <div class="empty-state-title">Welcome to IPTV Web</div>
        <div class="empty-state-desc">Go to <strong>Settings</strong> to add your M3U playlist URL and start watching.</div>
        <button class="btn-accent mt-16" tabindex="0">Open Settings</button>
      </div>
    `;
    el.querySelector('button').addEventListener('click', () => App.navigate('settings'));
    container.appendChild(el);
  }

  return { render };
})();
