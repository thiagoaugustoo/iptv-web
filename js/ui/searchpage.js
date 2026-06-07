/**
 * ui/searchpage.js — Search page UI
 */

const UISearchPage = (() => {
  'use strict';

  let _cache = {};
  let _searchDebounced = null;

  function render(cache) {
    _cache = cache;
    const container = document.getElementById('pageContainer');
    container.innerHTML = '';

    // Header
    const header = document.createElement('div');
    header.className = 'page-header';
    header.innerHTML = `<h1 class="page-title">Search</h1>`;
    container.appendChild(header);

    // Search bar
    const searchWrap = document.createElement('div');
    searchWrap.className = 'search-bar-wrap';
    searchWrap.innerHTML = `
      <span class="search-icon" aria-hidden="true">🔍</span>
      <input type="search" id="searchInput" class="search-input" placeholder="Search channels, movies, series..." autocomplete="off" tabindex="0" />
    `;
    container.appendChild(searchWrap);

    // Results container
    const resultsContainer = document.createElement('div');
    resultsContainer.id = 'searchResults';
    container.appendChild(resultsContainer);

    // Initial state
    resultsContainer.innerHTML = `
      <div class="search-empty">
        <div style="font-size:48px;opacity:0.3">🔍</div>
        <div>Start typing to search across all content</div>
      </div>
    `;

    // Debounced search
    _searchDebounced = Utils.debounce((query) => {
      performSearch(query, resultsContainer);
    }, 250);

    const input = document.getElementById('searchInput');
    input.addEventListener('input', (e) => {
      _searchDebounced(e.target.value);
    });

    // Focus input
    setTimeout(() => input.focus(), 100);
  }

  function performSearch(query, container) {
    if (!query || query.trim().length === 0) {
      container.innerHTML = `
        <div class="search-empty">
          <div style="font-size:48px;opacity:0.3">🔍</div>
          <div>Start typing to search across all content</div>
        </div>
      `;
      return;
    }

    const results = SearchEngine.search(query.trim(), 30);
    const total = results.channels.length + results.movies.length + results.series.length;

    if (total === 0) {
      container.innerHTML = `
        <div class="search-empty">
          <div style="font-size:48px;opacity:0.3">😕</div>
          <div>No results for "<strong>${Utils.sanitizeText(query)}</strong>"</div>
        </div>
      `;
      return;
    }

    container.innerHTML = '';

    if (results.channels.length > 0) {
      container.appendChild(buildResultSection('Live Channels', results.channels, renderChannelResult));
    }
    if (results.movies.length > 0) {
      container.appendChild(buildResultSection('Movies', results.movies, renderMovieResult));
    }
    if (results.series.length > 0) {
      container.appendChild(buildResultSection('Series', results.series, renderSeriesResult));
    }

    Utils.initLazyImages();
  }

  function buildResultSection(title, items, renderFn) {
    const section = document.createElement('div');
    section.className = 'search-results-section';

    const titleEl = document.createElement('div');
    titleEl.className = 'search-results-title';
    titleEl.textContent = `${title} (${items.length})`;
    section.appendChild(titleEl);

    const grid = document.createElement('div');
    grid.className = 'content-grid-wide';
    items.forEach(item => {
      const el = renderFn(item);
      if (el) grid.appendChild(el);
    });
    section.appendChild(grid);
    return section;
  }

  function renderChannelResult(ch) {
    const card = document.createElement('div');
    card.className = 'channel-card';
    card.tabIndex = 0;
    card.setAttribute('aria-label', ch.title);

    card.innerHTML = `
      <img class="channel-logo" data-src="${Utils.sanitizeUrl(ch.logo) || Utils.PLACEHOLDER_WIDE}" src="${Utils.PLACEHOLDER_WIDE}" alt="${Utils.sanitizeText(ch.title)}" />
      <div class="channel-info">
        <div class="channel-name">${Utils.sanitizeText(ch.title)}</div>
        <div class="channel-group">${Utils.sanitizeText(ch.group || '')}</div>
      </div>
      <span class="list-item-type-badge badge-channel">LIVE</span>
    `;

    card.addEventListener('click', () => {
      App.playItem({
        id: ch.id,
        type: 'channel',
        title: ch.title,
        poster: ch.logo,
        streamUrl: ch.streamUrl
      });
    });
    card.addEventListener('keydown', e => { if (e.key === 'Enter') card.click(); });
    Utils.observeImage(card.querySelector('img'));
    return card;
  }

  function renderMovieResult(movie) {
    const card = document.createElement('div');
    card.className = 'channel-card';
    card.tabIndex = 0;
    card.setAttribute('aria-label', movie.title);

    card.innerHTML = `
      <img class="channel-logo" data-src="${Utils.sanitizeUrl(movie.poster) || Utils.PLACEHOLDER_IMG}" src="${Utils.PLACEHOLDER_IMG}" alt="${Utils.sanitizeText(movie.title)}" style="aspect-ratio:2/3;height:64px;width:auto" />
      <div class="channel-info">
        <div class="channel-name">${Utils.sanitizeText(movie.title)}</div>
        <div class="channel-group">${Utils.sanitizeText([movie.year, movie.genre].filter(Boolean).join(' · '))}</div>
      </div>
      <span class="list-item-type-badge badge-movie">MOVIE</span>
    `;

    card.addEventListener('click', () => UIMovies.openDetail(movie));
    card.addEventListener('keydown', e => { if (e.key === 'Enter') card.click(); });
    Utils.observeImage(card.querySelector('img'));
    return card;
  }

  function renderSeriesResult(show) {
    const seasonCount = Object.keys(show.seasons || {}).length;
    const card = document.createElement('div');
    card.className = 'channel-card';
    card.tabIndex = 0;
    card.setAttribute('aria-label', show.title);

    card.innerHTML = `
      <img class="channel-logo" data-src="${Utils.sanitizeUrl(show.poster) || Utils.PLACEHOLDER_IMG}" src="${Utils.PLACEHOLDER_IMG}" alt="${Utils.sanitizeText(show.title)}" style="aspect-ratio:2/3;height:64px;width:auto" />
      <div class="channel-info">
        <div class="channel-name">${Utils.sanitizeText(show.title)}</div>
        <div class="channel-group">${seasonCount} Season${seasonCount !== 1 ? 's' : ''}</div>
      </div>
      <span class="list-item-type-badge badge-series">SERIES</span>
    `;

    card.addEventListener('click', () => UISeries.openDetail(show));
    card.addEventListener('keydown', e => { if (e.key === 'Enter') card.click(); });
    Utils.observeImage(card.querySelector('img'));
    return card;
  }

  return { render };
})();
