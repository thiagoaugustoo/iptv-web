/**
 * app.js — Main entry point, router, event bus, initialization
 */


const App = (() => {
  'use strict';

  if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("/sw.js").then(() => {
    console.log("SW ativo");
  });
}


  // ---- Event Bus ----
  const _listeners = {};

  function on(event, cb) {
    if (!_listeners[event]) _listeners[event] = [];
    _listeners[event].push(cb);
  }

  function off(event, cb) {
    if (!_listeners[event]) return;
    _listeners[event] = _listeners[event].filter(fn => fn !== cb);
  }

  function emit(event, data) {
    (_listeners[event] || []).forEach(cb => {
      try { cb(data); } catch(e) { console.error('Event error:', event, e); }
    });
  }

  // ---- State ----
  let _cache = { channels: [], movies: [], series: [], updatedAt: null };
  let _currentRoute = 'home';
  let _initialized = false;

  // ---- Router ----
  const _routes = {
    home:      () => UIHome.render(_cache),
    livetv:    () => UILiveTV.render(_cache.channels),
    movies:    () => UIMovies.render(_cache.movies),
    series:    () => UISeries.render(_cache.series),
    search:    () => UISearchPage.render(_cache),
    favorites: () => UIFavorites.render(),
    history:   () => UIHistory.render(),
    settings:  () => UISettings.render(),
  };

  function navigate(route, pushState = true) {
    if (!_routes[route]) route = 'home';

    if (pushState && _currentRoute !== route) {
      Navigation.pushHistory(_currentRoute);
    }

    _currentRoute = route;

    // Update sidebar active state
    document.querySelectorAll('.nav-item').forEach(el => {
      el.classList.toggle('active', el.dataset.route === route);
    });

    // Render page
    const container = document.getElementById('pageContainer');
    if (!container) return;
    container.innerHTML = '';

    try {
      _routes[route]();
    } catch(e) {
      console.error('Route render error:', route, e);
      container.innerHTML = `<div class="empty-state">
        <div class="empty-state-icon">⚠</div>
        <div class="empty-state-title">Page Error</div>
        <div class="empty-state-desc">${Utils.sanitizeText(e.message)}</div>
      </div>`;
    }

    // Update URL hash
    if (window.location.hash !== '#' + route) {
      window.location.hash = route;
    }

    // Focus first element
    setTimeout(() => Navigation.focusFirst(container), 100);
  }

  // ---- Play item ----
  function playItem(item) {
    Player.open(item);
  }

  // ---- Open detail modal ----
  function openModal(content) {
    const overlay = document.getElementById('modalOverlay');
    const modalContent = document.getElementById('modalContent');
    if (!overlay || !modalContent) return;
    modalContent.innerHTML = '';
    if (typeof content === 'string') {
      modalContent.innerHTML = content;
    } else {
      modalContent.appendChild(content);
    }
    overlay.classList.remove('hidden');
    setTimeout(() => Navigation.focusFirst(modalContent), 50);
  }

  function closeModal() {
    const overlay = document.getElementById('modalOverlay');
    if (overlay) overlay.classList.add('hidden');
    Navigation.focusFirst(document.getElementById('pageContainer'));
  }

  // ---- Playlist loading ----
  async function loadPlaylist(url, showToast = true) {
    if (!url) return;
    const safeUrl = Utils.sanitizeUrl(url);
    if (!safeUrl) {
      Utils.showToast('Invalid playlist URL', 'error');
      return;
    }

    updatePlaylistStatus('loading', 'Loading playlist...');

    try {
      const result = await Parser.fetchAndParse(safeUrl);
      _cache = result;
      SearchEngine.buildIndex(_cache);

      const total = result.channels.length + result.movies.length + result.series.length;
      updatePlaylistStatus('loaded', `${result.channels.length} channels, ${result.movies.length} movies, ${result.series.length} series`);

      if (showToast) {
        Utils.showToast(`Loaded ${total} items`, 'success');
      }

      // Re-render current page with new data
      navigate(_currentRoute, false);

    } catch(e) {
      console.error('Playlist load error:', e);
      updatePlaylistStatus('error', 'Failed to load playlist');
      Utils.showToast('Failed to load playlist: ' + e.message, 'error');
    }
  }

  let _lastStatus = null;

  function updatePlaylistStatus(state, text) {
    // May be called before home renders; store for later use
    _lastStatus = { state, text };
    const el = document.getElementById('playlistStatus');
    if (!el) return;
    el.className = 'playlist-status ' + state;
    const label = el.querySelector('.status-text');
    if (label) label.textContent = text;
  }

  function applyPendingStatus() {
    if (_lastStatus) updatePlaylistStatus(_lastStatus.state, _lastStatus.text);
  }

  // ---- Init ----
  async function init() {
    if (_initialized) return;
    _initialized = true;

    // Init subsystems
    await Storage.openDB();
    Navigation.init();
    Player.init();

    // Load settings
    const settings = Storage.getSettings();

    // Load cache from IndexedDB
    const cached = await Storage.loadCache();
    if (cached) {
      _cache = cached;
      SearchEngine.buildIndex(_cache);
    }

    // Setup hash router
    window.addEventListener('hashchange', () => {
      const route = window.location.hash.replace('#', '') || 'home';
      if (route !== _currentRoute) navigate(route, false);
    });

    // Setup sidebar nav clicks
    document.querySelectorAll('.nav-item').forEach(el => {
      el.addEventListener('click', (e) => {
        e.preventDefault();
        const route = el.dataset.route;
        if (route) navigate(route);
      });
    });

    // Modal close
    const modalOverlay = document.getElementById('modalOverlay');
    if (modalOverlay) {
      modalOverlay.addEventListener('click', (e) => {
        if (e.target === modalOverlay) closeModal();
      });
    }

    // Player events
    on('player:close', () => Player.close());
    on('player:closed', () => {
      // Refresh continue watching on home
      if (_currentRoute === 'home') navigate('home', false);
    });
    on('modal:close', closeModal);

    // Initial route
    const initialRoute = window.location.hash.replace('#', '') || 'home';
    navigate(initialRoute, false);

    // Auto-load last playlist URL
    const lastUrl = Storage.getLastPlaylistUrl();
    if (lastUrl) {
      const stale = await Storage.isCacheStale(3600000);
      if (stale || !cached || !cached.channels || cached.channels.length === 0) {
        loadPlaylist(lastUrl, false);
      } else {
        updatePlaylistStatus('loaded',
          `${_cache.channels.length} channels, ${_cache.movies.length} movies, ${_cache.series.length} series`);
      }
    } else {
      updatePlaylistStatus('idle', 'No playlist loaded — go to Settings');
    }
  }

  // ---- Expose ----
  return {
    on, off, emit,
    navigate,
    playItem,
    openModal,
    closeModal,
    loadPlaylist,
    applyPendingStatus,
    getCache: () => _cache,
    getCurrentRoute: () => _currentRoute,
    init
  };
})();