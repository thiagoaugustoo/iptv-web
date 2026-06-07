/**
 * ui/movies.js — Movies page: grid, filters, detail modal
 */

const UIMovies = (() => {
  'use strict';

  let _movies = [];
  let _favorites = new Set();
  let _currentFilter = 'New';
  let _currentCategory = 'All';
  let _watchCounts = {};

  async function render(movies) {
    _movies = movies || [];
    const container = document.getElementById('pageContainer');
    container.innerHTML = '';

    // Load favorites and history
    const [favs, history] = await Promise.all([
      Storage.getFavorites(),
      Storage.getHistory()
    ]);
    _favorites = new Set(favs.filter(f => f.type === 'movie').map(f => f.id));
    _watchCounts = {};
    history.filter(h => h.type === 'movie').forEach(h => {
      _watchCounts[h.id] = (_watchCounts[h.id] || 0) + 1;
    });

    if (_movies.length === 0) {
      renderEmpty(container);
      return;
    }

    // Header
    const header = document.createElement('div');
    header.className = 'page-header';
    header.innerHTML = `<h1 class="page-title">Movies</h1><p class="page-subtitle">${_movies.length} movies available</p>`;
    container.appendChild(header);

    // Filter tabs
    const filterTabs = document.createElement('div');
    filterTabs.className = 'filter-tabs';
    ['New', 'Most Watched', 'Favorites', 'Categories'].forEach(f => {
      const tab = document.createElement('button');
      tab.className = 'filter-tab' + (f === _currentFilter ? ' active' : '');
      tab.textContent = f;
      tab.tabIndex = 0;
      tab.addEventListener('click', () => {
        _currentFilter = f;
        document.querySelectorAll('.filter-tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        renderGrid(gridContainer, f, _currentCategory);
      });
      filterTabs.appendChild(tab);
    });
    container.appendChild(filterTabs);

    // Category filter (shown when Categories tab active)
    const catFilter = document.createElement('div');
    catFilter.id = 'movieCatFilter';
    catFilter.className = 'filter-tabs hidden';
    const categories = Parser.getCategories(_movies);
    categories.forEach(cat => {
      const tab = document.createElement('button');
      tab.className = 'filter-tab' + (cat === _currentCategory ? ' active' : '');
      tab.textContent = cat;
      tab.tabIndex = 0;
      tab.addEventListener('click', () => {
        _currentCategory = cat;
        document.querySelectorAll('#movieCatFilter .filter-tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        renderGrid(gridContainer, _currentFilter, cat);
      });
      catFilter.appendChild(tab);
    });
    container.appendChild(catFilter);

    // Grid
    const gridContainer = document.createElement('div');
    gridContainer.className = 'content-grid';
    gridContainer.id = 'moviesGrid';
    container.appendChild(gridContainer);

    renderGrid(gridContainer, _currentFilter, _currentCategory);
    Utils.initLazyImages();
  }

  function renderGrid(container, filter, category) {
    container.innerHTML = '';

    // Show/hide category filter
    const catFilter = document.getElementById('movieCatFilter');
    if (catFilter) catFilter.classList.toggle('hidden', filter !== 'Categories');

    let items = [..._movies];

    switch (filter) {
      case 'New':
        // Sort by year desc, then by index (newest first)
        items.sort((a, b) => (b.year || '0').localeCompare(a.year || '0'));
        break;
      case 'Most Watched':
        items = items.filter(m => _watchCounts[m.id] > 0)
                     .sort((a, b) => (_watchCounts[b.id] || 0) - (_watchCounts[a.id] || 0));
        if (items.length === 0) {
          container.innerHTML = `<div class="empty-state" style="grid-column:1/-1;padding:40px">
            <div class="empty-state-icon">👁</div>
            <div class="empty-state-title">No watch history yet</div>
          </div>`;
          return;
        }
        break;
      case 'Favorites':
        items = items.filter(m => _favorites.has(m.id));
        if (items.length === 0) {
          container.innerHTML = `<div class="empty-state" style="grid-column:1/-1;padding:40px">
            <div class="empty-state-icon">❤</div>
            <div class="empty-state-title">No favorite movies yet</div>
          </div>`;
          return;
        }
        break;
      case 'Categories':
        if (category !== 'All') {
          items = items.filter(m => m.group === category || m.genre === category);
        }
        break;
    }

    if (items.length === 0) {
      container.innerHTML = `<div class="empty-state" style="grid-column:1/-1;padding:40px">
        <div class="empty-state-icon">🎬</div>
        <div class="empty-state-title">No movies found</div>
      </div>`;
      return;
    }

    items.forEach(movie => {
      container.appendChild(buildMovieCard(movie));
    });

    Utils.initLazyImages();
  }

  function buildMovieCard(movie) {
    const isFav = _favorites.has(movie.id);
    const card = document.createElement('div');
    card.className = 'card';
    card.tabIndex = 0;
    card.setAttribute('aria-label', movie.title);

    card.innerHTML = `
      <img class="card-poster" data-src="${Utils.sanitizeUrl(movie.poster) || Utils.PLACEHOLDER_IMG}" src="${Utils.PLACEHOLDER_IMG}" alt="${Utils.sanitizeText(movie.title)}" />
      <button class="card-fav-btn ${isFav ? 'active' : ''}" aria-label="Favorite" tabindex="0">
        ${isFav ? '❤' : '♡'}
      </button>
      <div class="card-info">
        <div class="card-title">${Utils.sanitizeText(movie.title)}</div>
        <div class="card-meta">${Utils.sanitizeText([movie.year, movie.genre].filter(Boolean).join(' · '))}</div>
      </div>
    `;

    card.addEventListener('click', (e) => {
      if (e.target.closest('.card-fav-btn')) return;
      openDetail(movie);
    });

    const favBtn = card.querySelector('.card-fav-btn');
    favBtn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const added = await Storage.toggleFavorite({
        id: movie.id,
        type: 'movie',
        title: movie.title,
        poster: movie.poster,
        streamUrl: movie.streamUrl
      });
      if (added) {
        _favorites.add(movie.id);
        favBtn.textContent = '❤';
        favBtn.classList.add('active');
        Utils.showToast('Added to favorites', 'success');
      } else {
        _favorites.delete(movie.id);
        favBtn.textContent = '♡';
        favBtn.classList.remove('active');
        Utils.showToast('Removed from favorites');
      }
    });

    card.addEventListener('keydown', e => { if (e.key === 'Enter') card.click(); });
    Utils.observeImage(card.querySelector('img'));
    return card;
  }

  function openDetail(movie) {
    const isFav = _favorites.has(movie.id);
    const modalEl = document.createElement('div');

    modalEl.innerHTML = `
      <button class="modal-close" aria-label="Close" tabindex="0">✕</button>
      <div class="modal-hero">
        <img class="modal-poster" src="${Utils.sanitizeUrl(movie.poster) || Utils.PLACEHOLDER_IMG}" alt="${Utils.sanitizeText(movie.title)}" />
        <div class="modal-details">
          <h2 class="modal-title">${Utils.sanitizeText(movie.title)}</h2>
          <div class="modal-meta">
            ${movie.year ? `<span class="modal-badge">${Utils.sanitizeText(movie.year)}</span>` : ''}
            ${movie.genre ? `<span class="modal-badge">${Utils.sanitizeText(movie.genre)}</span>` : ''}
            ${movie.duration ? `<span class="modal-badge">${Utils.formatDuration(movie.duration)}</span>` : ''}
            ${movie.rating ? `<span class="modal-badge accent">★ ${Utils.sanitizeText(movie.rating)}</span>` : ''}
          </div>
          ${movie.synopsis ? `<p class="modal-synopsis">${Utils.sanitizeText(movie.synopsis)}</p>` : ''}
          <div class="modal-actions">
            <button class="btn-accent" id="modalPlayBtn" tabindex="0">▶ Play</button>
            <button class="btn-secondary" id="modalFavBtn" tabindex="0">${isFav ? '❤ Favorited' : '♡ Favorite'}</button>
          </div>
        </div>
      </div>
    `;

    modalEl.querySelector('.modal-close').addEventListener('click', () => App.closeModal());
    modalEl.querySelector('#modalPlayBtn').addEventListener('click', () => {
      App.closeModal();
      App.playItem({
        id: movie.id,
        type: 'movie',
        title: movie.title,
        poster: movie.poster,
        streamUrl: movie.streamUrl
      });
    });

    const favBtn = modalEl.querySelector('#modalFavBtn');
    favBtn.addEventListener('click', async () => {
      const added = await Storage.toggleFavorite({
        id: movie.id,
        type: 'movie',
        title: movie.title,
        poster: movie.poster,
        streamUrl: movie.streamUrl
      });
      if (added) {
        _favorites.add(movie.id);
        favBtn.textContent = '❤ Favorited';
        Utils.showToast('Added to favorites', 'success');
      } else {
        _favorites.delete(movie.id);
        favBtn.textContent = '♡ Favorite';
        Utils.showToast('Removed from favorites');
      }
    });

    App.openModal(modalEl);
  }

  function renderEmpty(container) {
    const el = document.createElement('div');
    el.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">🎬</div>
        <div class="empty-state-title">No Movies</div>
        <div class="empty-state-desc">Load a playlist in Settings to see movies here.</div>
        <button class="btn-accent mt-16" tabindex="0">Open Settings</button>
      </div>
    `;
    el.querySelector('button').addEventListener('click', () => App.navigate('settings'));
    container.appendChild(el);
  }

  return { render, openDetail };
})();
