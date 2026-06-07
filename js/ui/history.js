/**
 * ui/history.js — History page with clear/remove options
 */

const UIHistory = (() => {
  'use strict';

  async function render() {
    const container = document.getElementById('pageContainer');
    container.innerHTML = '';

    const history = await Storage.getHistory();

    // Header
    const header = document.createElement('div');
    header.className = 'page-header';
    header.style.cssText = 'display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px';
    header.innerHTML = `
      <div>
        <h1 class="page-title">Watch History</h1>
        <p class="page-subtitle">${history.length} item${history.length !== 1 ? 's' : ''}</p>
      </div>
      ${history.length > 0 ? `<button class="btn-secondary" id="clearHistoryBtn" tabindex="0">Clear All</button>` : ''}
    `;
    container.appendChild(header);

    if (history.length === 0) {
      container.insertAdjacentHTML('beforeend', `
        <div class="empty-state">
          <div class="empty-state-icon">🕐</div>
          <div class="empty-state-title">No Watch History</div>
          <div class="empty-state-desc">Items you watch will appear here.</div>
        </div>
      `);
      return;
    }

    // Clear all button
    const clearBtn = header.querySelector('#clearHistoryBtn');
    if (clearBtn) {
      clearBtn.addEventListener('click', async () => {
        if (confirm('Clear all watch history?')) {
          await Storage.clearHistory();
          Utils.showToast('History cleared');
          render();
        }
      });
    }

    // List
    const listContainer = document.createElement('div');
    listContainer.id = 'historyList';
    container.appendChild(listContainer);

    history.forEach(item => {
      listContainer.appendChild(buildHistoryItem(item, listContainer));
    });

    Utils.initLazyImages();
  }

  function buildHistoryItem(item, listContainer) {
    const el = document.createElement('div');
    el.className = 'list-item';
    el.tabIndex = 0;
    el.setAttribute('aria-label', item.title);

    const badgeClass = item.type === 'channel' ? 'badge-channel' : item.type === 'movie' ? 'badge-movie' : 'badge-series';
    const badgeText = item.type === 'channel' ? 'LIVE' : item.type === 'movie' ? 'MOVIE' : 'SERIES';
    const progressPct = item.progress ? Math.round(item.progress * 100) : 0;

    el.innerHTML = `
      <img class="list-item-thumb" data-src="${Utils.sanitizeUrl(item.poster) || Utils.PLACEHOLDER_WIDE}" src="${Utils.PLACEHOLDER_WIDE}" alt="${Utils.sanitizeText(item.title)}" />
      <div class="list-item-info">
        <div class="list-item-title">${Utils.sanitizeText(item.title)}</div>
        <div class="list-item-meta">
          <span class="list-item-type-badge ${badgeClass}">${badgeText}</span>
          <span style="margin-left:8px;color:var(--text-dim);font-size:12px">${Utils.formatDate(item.watchedAt)}</span>
          ${progressPct > 0 ? `<span style="margin-left:8px;color:var(--text-muted);font-size:12px">${progressPct}% watched</span>` : ''}
        </div>
        ${progressPct > 0 ? `
          <div style="margin-top:6px;height:3px;background:var(--border);border-radius:2px;max-width:200px">
            <div style="height:100%;width:${progressPct}%;background:var(--accent);border-radius:2px"></div>
          </div>
        ` : ''}
      </div>
      <div class="list-item-actions">
        <button class="list-item-btn" data-action="play" tabindex="0">▶ Play</button>
        <button class="list-item-btn" data-action="remove" tabindex="0">✕</button>
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
      await Storage.removeHistory(item.id);
      el.remove();
      Utils.showToast('Removed from history');
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
