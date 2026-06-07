/**
 * ui/favorites.js — Favorites page with type filter
 */

const UIFavorites = (() => {
  'use strict';

  let _currentFilter = 'All';

  async function render() {
    const container = document.getElementById('pageContainer');
    container.innerHTML = '';

    const favorites = await Storage.getFavorites();

    // Header
    const header = document.createElement('div');
    header.className = 'page-header';
    header.innerHTML = `<h1 class="page-title">Favorites</h1><p class="page-subtitle">${favorites.length} item${favorites.length !== 1 ? 's' : ''}</p>`;
    container.appendChild(header);

    if (favorites.length === 0) {
      container.insertAdjacentHTML('beforeend', `
        <div class="empty-state">
          <div class="empty-state-icon">❤</div>
          <div class="empty-state-title">No Favorites Yet</div>
          <div class="empty-state-desc">Add channels, movies, or series to your favorites by clicking the heart icon.</div>
        </div>
      `);
      return;
    }

    // Filter chips
    const filterTabs = document.createElement('div');
    filterTabs.className = 'filter-tabs';
    ['All', 'Channels', 'Movies', 'Series'].forEach(f => {
      const tab = document.createElement('button');
      tab.className = 'filter-tab' + (f === _currentFilter ? ' active' : '');
      tab.textContent = f;
      tab.tabIndex = 0;
      tab.addEventListener('click', () => {
        _currentFilter = f;
        document.querySelectorAll('#favFilterTabs .filter-tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        renderList(listContainer, favorites, f);
      });
      filterTabs.appendChild(tab);
    });
    filterTabs.id = 'favFilterTabs';
    container.appendChild(filterTabs);

    // List
    const listContainer = document.createElement('div');
    listContainer.id = 'favoritesList';
    container.appendChild(listContainer);

    renderList(listContainer, favorites, _currentFilter);
    Utils.initLazyImages();
  }

  function renderList(container, favorites, filter) {
    container.innerHTML = '';

    let items = favorites;
    if (filter === 'Channels') items = favorites.filter(f => f.type === 'channel');
    if (filter === 'Movies')   items = favorites.filter(f => f.type === 'movie');
    if (filter === 'Series')   items = favorites.filter(f => f.type === 'series');

    if (items.length === 0) {
      container.innerHTML = `<div class="empty-state" style="padding:40px">
        <div class="empty-state-icon">❤</div>
        <div class="empty-state-title">No ${filter} favorites</div>
      </div>`;
      return;
    }

    items.forEach(item => {
      container.appendChild(buildFavItem(item, container, favorites));
    });

    Utils.initLazyImages();
  }

  function buildFavItem(item, listContainer, allFavorites) {
    const el = document.createElement('div');
    el.className = 'list-item';
    el.tabIndex = 0;
    el.setAttribute('aria-label', item.title);

    const badgeClass = item.type === 'channel' ? 'badge-channel' : item.type === 'movie' ? 'badge-movie' : 'badge-series';
    const badgeText = item.type === 'channel' ? 'LIVE' : item.type === 'movie' ? 'MOVIE' : 'SERIES';

    el.innerHTML = `
      <img class="list-item-thumb" data-src="${Utils.sanitizeUrl(item.poster) || Utils.PLACEHOLDER_WIDE}" src="${Utils.PLACEHOLDER_WIDE}" alt="${Utils.sanitizeText(item.title)}" />
      <div class="list-item-info">
        <div class="list-item-title">${Utils.sanitizeText(item.title)}</div>
        <div class="list-item-meta">
          <span class="list-item-type-badge ${badgeClass}">${badgeText}</span>
        </div>
      </div>
      <div class="list-item-actions">
        <button class="list-item-btn" data-action="play" tabindex="0">▶ Play</button>
        <button class="list-item-btn" data-action="remove" tabindex="0">✕ Remove</button>
      </div>
    `;

    el.querySelector('[data-action="play"]').addEventListener('click', (e) => {
      e.stopPropagation();
      if (item.type === 'channel') {
        App.playItem({ ...item });
      } else if (item.type === 'movie') {
        UIMovies.openDetail(item);
      } else if (item.type === 'series') {
        UISeries.openDetail(item);
      }
    });

    el.querySelector('[data-action="remove"]').addEventListener('click', async (e) => {
      e.stopPropagation();
      await Storage.removeFavorite(item.id);
      el.remove();
      Utils.showToast('Removed from favorites');
      // Update count
      const remaining = listContainer.querySelectorAll('.list-item').length;
      const subtitle = document.querySelector('.page-subtitle');
      if (subtitle) subtitle.textContent = `${remaining} item${remaining !== 1 ? 's' : ''}`;
    });

    el.addEventListener('click', () => {
      if (item.type === 'channel') {
        App.playItem({ ...item });
      } else if (item.type === 'movie') {
        UIMovies.openDetail(item);
      } else if (item.type === 'series') {
        UISeries.openDetail(item);
      }
    });

    el.addEventListener('keydown', e => { if (e.key === 'Enter') el.click(); });
    Utils.observeImage(el.querySelector('img'));
    return el;
  }

  return { render };
})();
