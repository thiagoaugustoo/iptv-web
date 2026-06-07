/**
 * ui/livetv.js — Live TV page: category sidebar + channel list
 */

const UILiveTV = (() => {
  'use strict';

  const LIVE_CATEGORIES = ['All', 'Sports', 'Movies', 'News', 'Kids', 'Music', 'Variety', 'Religious'];
  let _currentCategory = 'All';
  let _channels = [];
  let _favorites = new Set();

  async function render(channels) {
    _channels = channels || [];
    const container = document.getElementById('pageContainer');
    container.innerHTML = '';
    container.style.padding = '0';
    container.style.overflow = 'hidden';
    container.style.height = '100%';

    // Load favorites
    const favs = await Storage.getFavorites();
    _favorites = new Set(favs.filter(f => f.type === 'channel').map(f => f.id));

    // Load last category
    const settings = Storage.getSettings();
    _currentCategory = settings.lastCategory || 'All';

    if (_channels.length === 0) {
      container.style.padding = '28px 32px';
      container.style.overflow = 'auto';
      container.style.height = 'auto';
      renderEmpty(container);
      return;
    }

    // Build categories from actual data
    const dataCategories = Parser.getCategories(_channels);
    // Merge with predefined + data categories
    const allCats = Utils.uniqueBy(
      [...LIVE_CATEGORIES.map(c => ({ name: c })),
       ...dataCategories.filter(c => c !== 'All').map(c => ({ name: c }))],
      'name'
    ).map(c => c.name);

    const layout = document.createElement('div');
    layout.className = 'livetv-layout';

    // Category sidebar
    const catSidebar = document.createElement('div');
    catSidebar.className = 'category-sidebar';
    allCats.forEach(cat => {
      const item = document.createElement('div');
      item.className = 'category-item' + (cat === _currentCategory ? ' active' : '');
      item.textContent = cat;
      item.tabIndex = 0;
      item.addEventListener('click', () => selectCategory(cat, item, channelList));
      item.addEventListener('keydown', e => {
        if (e.key === 'Enter') selectCategory(cat, item, channelList);
      });
      catSidebar.appendChild(item);
    });

    // Channel list
    const channelList = document.createElement('div');
    channelList.className = 'channel-list-area';
    channelList.id = 'channelListArea';

    layout.appendChild(catSidebar);
    layout.appendChild(channelList);
    container.appendChild(layout);

    renderChannels(channelList, _currentCategory);
    Utils.initLazyImages();
  }

  function selectCategory(cat, itemEl, listEl) {
    _currentCategory = cat;
    Storage.saveSettings({ lastCategory: cat });

    document.querySelectorAll('.category-item').forEach(el => el.classList.remove('active'));
    itemEl.classList.add('active');

    renderChannels(listEl, cat);
    Utils.initLazyImages();
  }

  function renderChannels(container, category) {
    container.innerHTML = '';

    const filtered = category === 'All'
      ? _channels
      : _channels.filter(ch => {
          const g = (ch.group || '').toLowerCase();
          return g.includes(category.toLowerCase());
        });

    if (filtered.length === 0) {
      container.innerHTML = `<div class="empty-state" style="padding:40px 20px">
        <div class="empty-state-icon">📡</div>
        <div class="empty-state-title">No channels in this category</div>
      </div>`;
      return;
    }

    // Virtual list for large channel lists
    if (filtered.length > 200) {
      renderVirtualChannelList(container, filtered);
    } else {
      filtered.forEach(ch => {
        container.appendChild(buildChannelCard(ch));
      });
    }
  }

  function renderVirtualChannelList(container, channels) {
    const ITEM_HEIGHT = 76; // px
    const BUFFER = 10;

    container.style.position = 'relative';
    container.style.overflowY = 'auto';

    const inner = document.createElement('div');
    inner.style.height = (channels.length * ITEM_HEIGHT) + 'px';
    inner.style.position = 'relative';
    container.appendChild(inner);

    function renderVisible() {
      const scrollTop = container.scrollTop;
      const viewHeight = container.clientHeight;
      const startIdx = Math.max(0, Math.floor(scrollTop / ITEM_HEIGHT) - BUFFER);
      const endIdx = Math.min(channels.length - 1, Math.ceil((scrollTop + viewHeight) / ITEM_HEIGHT) + BUFFER);

      // Remove items outside range
      Array.from(inner.children).forEach(el => {
        const idx = parseInt(el.dataset.idx);
        if (idx < startIdx || idx > endIdx) el.remove();
      });

      // Add items in range
      const existing = new Set(Array.from(inner.children).map(el => parseInt(el.dataset.idx)));
      for (let i = startIdx; i <= endIdx; i++) {
        if (existing.has(i)) continue;
        const card = buildChannelCard(channels[i]);
        card.dataset.idx = i;
        card.style.position = 'absolute';
        card.style.top = (i * ITEM_HEIGHT) + 'px';
        card.style.left = '0';
        card.style.right = '0';
        inner.appendChild(card);
      }

      Utils.initLazyImages();
    }

    container.addEventListener('scroll', Utils.throttle(renderVisible, 50));
    renderVisible();
  }

  function buildChannelCard(ch) {
    const isFav = _favorites.has(ch.id);
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
      <button class="card-fav-btn ${isFav ? 'active' : ''}" aria-label="${isFav ? 'Remove from favorites' : 'Add to favorites'}" tabindex="0" data-id="${ch.id}">
        ${isFav ? '❤' : '♡'}
      </button>
    `;

    card.addEventListener('click', (e) => {
      if (e.target.closest('.card-fav-btn')) return;
      App.playItem({
        id: ch.id,
        type: 'channel',
        title: ch.title,
        poster: ch.logo,
        streamUrl: ch.streamUrl
      });
    });

    const favBtn = card.querySelector('.card-fav-btn');
    favBtn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const added = await Storage.toggleFavorite({
        id: ch.id,
        type: 'channel',
        title: ch.title,
        poster: ch.logo,
        streamUrl: ch.streamUrl
      });
      if (added) {
        _favorites.add(ch.id);
        favBtn.textContent = '❤';
        favBtn.classList.add('active');
        Utils.showToast('Added to favorites', 'success');
      } else {
        _favorites.delete(ch.id);
        favBtn.textContent = '♡';
        favBtn.classList.remove('active');
        Utils.showToast('Removed from favorites');
      }
    });

    card.addEventListener('keydown', e => {
      if (e.key === 'Enter') card.click();
    });

    Utils.observeImage(card.querySelector('img'));
    return card;
  }

  function renderEmpty(container) {
    const el = document.createElement('div');
    el.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">📡</div>
        <div class="empty-state-title">No Live Channels</div>
        <div class="empty-state-desc">Load a playlist in Settings to see live channels here.</div>
        <button class="btn-accent mt-16" tabindex="0">Open Settings</button>
      </div>
    `;
    el.querySelector('button').addEventListener('click', () => App.navigate('settings'));
    container.appendChild(el);
  }

  return { render };
})();
