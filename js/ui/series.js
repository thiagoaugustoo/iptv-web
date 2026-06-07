/**
 * ui/series.js — Series page: grid, season/episode navigation, detail modal
 */

const UISeries = (() => {
  'use strict';

  let _series = [];
  let _favorites = new Set();

  async function render(series) {
    _series = series || [];
    const container = document.getElementById('pageContainer');
    container.innerHTML = '';

    const favs = await Storage.getFavorites();
    _favorites = new Set(favs.filter(f => f.type === 'series').map(f => f.id));

    if (_series.length === 0) {
      renderEmpty(container);
      return;
    }

    // Header
    const header = document.createElement('div');
    header.className = 'page-header';
    header.innerHTML = `<h1 class="page-title">Series</h1><p class="page-subtitle">${_series.length} series available</p>`;
    container.appendChild(header);

    // Filter tabs
    const filterTabs = document.createElement('div');
    filterTabs.className = 'filter-tabs';
    ['All', 'Favorites', 'Categories'].forEach(f => {
      const tab = document.createElement('button');
      tab.className = 'filter-tab' + (f === 'All' ? ' active' : '');
      tab.textContent = f;
      tab.tabIndex = 0;
      tab.addEventListener('click', () => {
        document.querySelectorAll('#seriesFilterTabs .filter-tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        renderGrid(gridContainer, f);
      });
      filterTabs.appendChild(tab);
    });
    filterTabs.id = 'seriesFilterTabs';
    container.appendChild(filterTabs);

    // Grid
    const gridContainer = document.createElement('div');
    gridContainer.className = 'content-grid';
    container.appendChild(gridContainer);

    renderGrid(gridContainer, 'All');
    Utils.initLazyImages();
  }

  function renderGrid(container, filter) {
    container.innerHTML = '';
    let items = [..._series];

    if (filter === 'Favorites') {
      items = items.filter(s => _favorites.has(s.id));
      if (items.length === 0) {
        container.innerHTML = `<div class="empty-state" style="grid-column:1/-1;padding:40px">
          <div class="empty-state-icon">❤</div>
          <div class="empty-state-title">No favorite series yet</div>
        </div>`;
        return;
      }
    }

    items.forEach(show => {
      container.appendChild(buildSeriesCard(show));
    });

    Utils.initLazyImages();
  }

  function buildSeriesCard(show) {
    const isFav = _favorites.has(show.id);
    const seasonCount = Object.keys(show.seasons || {}).length;
    const card = document.createElement('div');
    card.className = 'card';
    card.tabIndex = 0;
    card.setAttribute('aria-label', show.title);

    card.innerHTML = `
      <img class="card-poster" data-src="${Utils.sanitizeUrl(show.poster) || Utils.PLACEHOLDER_IMG}" src="${Utils.PLACEHOLDER_IMG}" alt="${Utils.sanitizeText(show.title)}" />
      <button class="card-fav-btn ${isFav ? 'active' : ''}" aria-label="Favorite" tabindex="0">
        ${isFav ? '❤' : '♡'}
      </button>
      <div class="card-info">
        <div class="card-title">${Utils.sanitizeText(show.title)}</div>
        <div class="card-meta">${seasonCount} Season${seasonCount !== 1 ? 's' : ''}</div>
      </div>
    `;

    card.addEventListener('click', (e) => {
      if (e.target.closest('.card-fav-btn')) return;
      openDetail(show);
    });

    const favBtn = card.querySelector('.card-fav-btn');
    favBtn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const firstEp = getFirstEpisode(show);
      const added = await Storage.toggleFavorite({
        id: show.id,
        type: 'series',
        title: show.title,
        poster: show.poster,
        streamUrl: firstEp ? firstEp.streamUrl : ''
      });
      if (added) {
        _favorites.add(show.id);
        favBtn.textContent = '❤';
        favBtn.classList.add('active');
        Utils.showToast('Added to favorites', 'success');
      } else {
        _favorites.delete(show.id);
        favBtn.textContent = '♡';
        favBtn.classList.remove('active');
        Utils.showToast('Removed from favorites');
      }
    });

    card.addEventListener('keydown', e => { if (e.key === 'Enter') card.click(); });
    Utils.observeImage(card.querySelector('img'));
    return card;
  }

  function getFirstEpisode(show) {
    const seasons = show.seasons || {};
    const firstSeason = Object.keys(seasons).sort((a,b) => a-b)[0];
    if (!firstSeason) return null;
    return seasons[firstSeason][0] || null;
  }

  function openDetail(show) {
    const isFav = _favorites.has(show.id);
    const seasons = show.seasons || {};
    const seasonNums = Object.keys(seasons).sort((a,b) => a-b);
    let currentSeason = seasonNums[0] || '1';

    const modalEl = document.createElement('div');

    const buildSeasonTabs = () => {
      return seasonNums.map(s =>
        `<button class="filter-tab${s === currentSeason ? ' active' : ''}" data-season="${s}" tabindex="0">Season ${s}</button>`
      ).join('');
    };

    const buildEpisodeList = (seasonNum) => {
      const eps = seasons[seasonNum] || [];
      if (eps.length === 0) return '<div class="text-muted" style="padding:16px">No episodes</div>';
      return eps.map(ep => `
        <div class="episode-item" tabindex="0" data-ep-id="${ep.id}" data-stream="${Utils.sanitizeUrl(ep.streamUrl)}" data-title="${Utils.sanitizeText(ep.title)}">
          <span class="episode-num">E${ep.episode}</span>
          <span class="episode-title">${Utils.sanitizeText(ep.title)}</span>
          ${ep.duration ? `<span class="episode-duration">${Utils.formatDuration(ep.duration)}</span>` : ''}
        </div>
      `).join('');
    };

    modalEl.innerHTML = `
      <button class="modal-close" aria-label="Close" tabindex="0">✕</button>
      <div class="modal-hero">
        <img class="modal-poster" src="${Utils.sanitizeUrl(show.poster) || Utils.PLACEHOLDER_IMG}" alt="${Utils.sanitizeText(show.title)}" />
        <div class="modal-details">
          <h2 class="modal-title">${Utils.sanitizeText(show.title)}</h2>
          <div class="modal-meta">
            <span class="modal-badge">${seasonNums.length} Season${seasonNums.length !== 1 ? 's' : ''}</span>
            ${show.genre ? `<span class="modal-badge">${Utils.sanitizeText(show.genre)}</span>` : ''}
          </div>
          ${show.synopsis ? `<p class="modal-synopsis">${Utils.sanitizeText(show.synopsis)}</p>` : ''}
          <div class="modal-actions">
            <button class="btn-accent" id="seriesPlayFirstBtn" tabindex="0">▶ Play First Episode</button>
            <button class="btn-secondary" id="seriesFavBtn" tabindex="0">${isFav ? '❤ Favorited' : '♡ Favorite'}</button>
          </div>
        </div>
      </div>
      <div class="season-tabs" id="seasonTabs">${buildSeasonTabs()}</div>
      <div class="episode-list" id="episodeList">${buildEpisodeList(currentSeason)}</div>
    `;

    // Close
    modalEl.querySelector('.modal-close').addEventListener('click', () => App.closeModal());

    // Play first episode
    modalEl.querySelector('#seriesPlayFirstBtn').addEventListener('click', () => {
      const firstEp = getFirstEpisode(show);
      if (firstEp) {
        App.closeModal();
        App.playItem({
          id: firstEp.id,
          type: 'series',
          title: show.title,
          subtitle: firstEp.title,
          poster: show.poster,
          streamUrl: firstEp.streamUrl,
          season: parseInt(seasonNums[0]),
          episode: firstEp.episode
        });
      }
    });

    // Favorite
    const favBtn = modalEl.querySelector('#seriesFavBtn');
    favBtn.addEventListener('click', async () => {
      const firstEp = getFirstEpisode(show);
      const added = await Storage.toggleFavorite({
        id: show.id,
        type: 'series',
        title: show.title,
        poster: show.poster,
        streamUrl: firstEp ? firstEp.streamUrl : ''
      });
      if (added) {
        _favorites.add(show.id);
        favBtn.textContent = '❤ Favorited';
        Utils.showToast('Added to favorites', 'success');
      } else {
        _favorites.delete(show.id);
        favBtn.textContent = '♡ Favorite';
        Utils.showToast('Removed from favorites');
      }
    });

    // Season tabs
    const seasonTabsEl = modalEl.querySelector('#seasonTabs');
    const episodeListEl = modalEl.querySelector('#episodeList');

    seasonTabsEl.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-season]');
      if (!btn) return;
      currentSeason = btn.dataset.season;
      seasonTabsEl.querySelectorAll('.filter-tab').forEach(t => t.classList.remove('active'));
      btn.classList.add('active');
      episodeListEl.innerHTML = buildEpisodeList(currentSeason);
      bindEpisodeClicks(episodeListEl, show, currentSeason);
    });

    // Episode clicks
    bindEpisodeClicks(episodeListEl, show, currentSeason);

    App.openModal(modalEl);
  }

  function bindEpisodeClicks(listEl, show, seasonNum) {
    listEl.querySelectorAll('.episode-item').forEach(el => {
      el.addEventListener('click', () => {
        const streamUrl = el.dataset.stream;
        const epId = el.dataset.epId;
        const epTitle = el.dataset.title;
        const epNum = parseInt(el.querySelector('.episode-num').textContent.replace('E',''));
        App.closeModal();
        App.playItem({
          id: epId,
          type: 'series',
          title: show.title,
          subtitle: epTitle,
          poster: show.poster,
          streamUrl,
          season: parseInt(seasonNum),
          episode: epNum
        });
      });
      el.addEventListener('keydown', e => { if (e.key === 'Enter') el.click(); });
    });
  }

  function renderEmpty(container) {
    const el = document.createElement('div');
    el.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">📺</div>
        <div class="empty-state-title">No Series</div>
        <div class="empty-state-desc">Load a playlist in Settings to see series here.</div>
        <button class="btn-accent mt-16" tabindex="0">Open Settings</button>
      </div>
    `;
    el.querySelector('button').addEventListener('click', () => App.navigate('settings'));
    container.appendChild(el);
  }

  return { render, openDetail };
})();
