/**
 * ui/settings.js — Settings page
 */

const UISettings = (() => {
  'use strict';

  function render() {
    const container = document.getElementById('pageContainer');
    container.innerHTML = '';

    const settings = Storage.getSettings();
    const lastUrl = Storage.getLastPlaylistUrl();

    // Header
    const header = document.createElement('div');
    header.className = 'page-header';
    header.innerHTML = `<h1 class="page-title">Settings</h1>`;
    container.appendChild(header);

    // ---- Playlist Section ----
    const playlistSection = buildSection('Playlist', `
      <div class="settings-row">
        <div>
          <div class="settings-label">M3U Playlist URL</div>
          <div class="settings-desc">Enter your M3U or M3U8 playlist URL</div>
        </div>
        <div class="settings-control" style="flex-direction:column;align-items:flex-end;gap:8px">
          <input type="url" id="playlistUrlInput" class="settings-input" placeholder="http://example.com/playlist.m3u" value="${Utils.sanitizeText(lastUrl || '')}" tabindex="0" />
          <div style="display:flex;gap:8px">
            <button class="btn-accent" id="loadPlaylistBtn" tabindex="0">Load Playlist</button>
            <button class="btn-secondary" id="clearPlaylistBtn" tabindex="0">Clear</button>
          </div>
        </div>
      </div>
      <div class="settings-row" id="playlistInfoRow" style="${lastUrl ? '' : 'display:none'}">
        <div>
          <div class="settings-label">Current Playlist</div>
          <div class="settings-desc" id="playlistInfoText">${Utils.sanitizeText(lastUrl || '')}</div>
        </div>
        <button class="btn-secondary" id="refreshPlaylistBtn" tabindex="0">↻ Refresh</button>
      </div>
    `);
    container.appendChild(playlistSection);

    // ---- Appearance Section ----
    const appearanceSection = buildSection('Appearance', `
      <div class="settings-row">
        <div>
          <div class="settings-label">Theme</div>
          <div class="settings-desc">Choose your preferred theme</div>
        </div>
        <div class="settings-control">
          <select id="themeSelect" class="settings-select" tabindex="0">
            <option value="dark" ${settings.theme === 'dark' ? 'selected' : ''}>Dark</option>
            <option value="darker" ${settings.theme === 'darker' ? 'selected' : ''}>Darker (AMOLED)</option>
          </select>
        </div>
      </div>
    `);
    container.appendChild(appearanceSection);

    // ---- Player Section ----
    const playerSection = buildSection('Player', `
      <div class="settings-row">
        <div>
          <div class="settings-label">Default Volume</div>
          <div class="settings-desc">Player volume (0-100)</div>
        </div>
        <div class="settings-control">
          <input type="range" id="volumeSetting" min="0" max="100" value="${settings.playerVolume}" style="width:120px" tabindex="0" />
          <span id="volumeSettingVal" style="min-width:36px;text-align:right">${settings.playerVolume}%</span>
        </div>
      </div>
      <div class="settings-row">
        <div>
          <div class="settings-label">Preferred Quality</div>
          <div class="settings-desc">Default stream quality</div>
        </div>
        <div class="settings-control">
          <select id="qualitySelect" class="settings-select" tabindex="0">
            <option value="auto" ${settings.preferredQuality === 'auto' ? 'selected' : ''}>Auto</option>
            <option value="1080p" ${settings.preferredQuality === '1080p' ? 'selected' : ''}>1080p</option>
            <option value="720p" ${settings.preferredQuality === '720p' ? 'selected' : ''}>720p</option>
            <option value="480p" ${settings.preferredQuality === '480p' ? 'selected' : ''}>480p</option>
            <option value="360p" ${settings.preferredQuality === '360p' ? 'selected' : ''}>360p</option>
          </select>
        </div>
      </div>
    `);
    container.appendChild(playerSection);

    // ---- Data Section ----
    const dataSection = buildSection('Data & Cache', `
      <div class="settings-row">
        <div>
          <div class="settings-label">Clear Watch History</div>
          <div class="settings-desc">Remove all watched items from history</div>
        </div>
        <button class="btn-secondary" id="clearHistorySettingBtn" tabindex="0">Clear History</button>
      </div>
      <div class="settings-row">
        <div>
          <div class="settings-label">Clear Continue Watching</div>
          <div class="settings-desc">Remove all in-progress items</div>
        </div>
        <button class="btn-secondary" id="clearContinueBtn" tabindex="0">Clear</button>
      </div>
      <div class="settings-row">
        <div>
          <div class="settings-label">Clear Favorites</div>
          <div class="settings-desc">Remove all favorited items</div>
        </div>
        <button class="btn-secondary" id="clearFavoritesBtn" tabindex="0">Clear</button>
      </div>
      <div class="settings-row">
        <div>
          <div class="settings-label">Clear Playlist Cache</div>
          <div class="settings-desc">Force reload playlist on next visit</div>
        </div>
        <button class="btn-secondary" id="clearCacheBtn" tabindex="0">Clear Cache</button>
      </div>
    `);
    container.appendChild(dataSection);

    // ---- About Section ----
    const aboutSection = buildSection('About', `
      <div class="settings-row">
        <div>
          <div class="settings-label">IPTV Web</div>
          <div class="settings-desc">Version 1.0.0 — Static IPTV Player</div>
        </div>
      </div>
      <div class="settings-row">
        <div>
          <div class="settings-label">Keyboard Shortcuts</div>
          <div class="settings-desc">Space: Play/Pause · F: Fullscreen · M: Mute · ←/→: Seek · ↑/↓: Volume · Esc: Close</div>
        </div>
      </div>
    `);
    container.appendChild(aboutSection);

    // ---- Bind events ----
    bindEvents(container, settings);
  }

  function buildSection(title, innerHtml) {
    const section = document.createElement('div');
    section.className = 'settings-section';
    section.innerHTML = `<div class="settings-section-title">${Utils.sanitizeText(title)}</div>${innerHtml}`;
    return section;
  }

  function bindEvents(container, settings) {
    // Load playlist
    const loadBtn = container.querySelector('#loadPlaylistBtn');
    const urlInput = container.querySelector('#playlistUrlInput');
    if (loadBtn && urlInput) {
      loadBtn.addEventListener('click', () => {
        const url = urlInput.value.trim();
        if (!url) { Utils.showToast('Please enter a URL', 'error'); return; }
        App.loadPlaylist(url);
        // Update info row
        const infoRow = container.querySelector('#playlistInfoRow');
        const infoText = container.querySelector('#playlistInfoText');
        if (infoRow) infoRow.style.display = '';
        if (infoText) infoText.textContent = url;
      });
      urlInput.addEventListener('keydown', e => {
        if (e.key === 'Enter') loadBtn.click();
      });
    }

    // Clear playlist URL
    const clearBtn = container.querySelector('#clearPlaylistBtn');
    if (clearBtn) {
      clearBtn.addEventListener('click', () => {
        Storage.saveLastPlaylistUrl('');
        if (urlInput) urlInput.value = '';
        const infoRow = container.querySelector('#playlistInfoRow');
        if (infoRow) infoRow.style.display = 'none';
        Utils.showToast('Playlist URL cleared');
      });
    }

    // Refresh playlist
    const refreshBtn = container.querySelector('#refreshPlaylistBtn');
    if (refreshBtn) {
      refreshBtn.addEventListener('click', () => {
        const url = Storage.getLastPlaylistUrl();
        if (url) App.loadPlaylist(url);
      });
    }

    // Theme
    const themeSelect = container.querySelector('#themeSelect');
    if (themeSelect) {
      themeSelect.addEventListener('change', () => {
        const theme = themeSelect.value;
        Storage.saveSettings({ theme });
        applyTheme(theme);
        Utils.showToast('Theme updated');
      });
    }

    // Volume
    const volSlider = container.querySelector('#volumeSetting');
    const volVal = container.querySelector('#volumeSettingVal');
    if (volSlider) {
      volSlider.addEventListener('input', () => {
        const v = parseInt(volSlider.value);
        if (volVal) volVal.textContent = v + '%';
        Storage.saveSettings({ playerVolume: v });
      });
    }

    // Quality
    const qualitySelect = container.querySelector('#qualitySelect');
    if (qualitySelect) {
      qualitySelect.addEventListener('change', () => {
        Storage.saveSettings({ preferredQuality: qualitySelect.value });
        Utils.showToast('Quality preference saved');
      });
    }

    // Clear history
    container.querySelector('#clearHistorySettingBtn')?.addEventListener('click', async () => {
      if (confirm('Clear all watch history?')) {
        await Storage.clearHistory();
        Utils.showToast('History cleared', 'success');
      }
    });

    // Clear continue watching
    container.querySelector('#clearContinueBtn')?.addEventListener('click', async () => {
      if (confirm('Clear continue watching list?')) {
        await Storage.clearStore('continueWatching');
        Utils.showToast('Continue watching cleared', 'success');
      }
    });

    // Clear favorites
    container.querySelector('#clearFavoritesBtn')?.addEventListener('click', async () => {
      if (confirm('Clear all favorites?')) {
        await Storage.clearStore('favorites');
        Utils.showToast('Favorites cleared', 'success');
      }
    });

    // Clear cache
    container.querySelector('#clearCacheBtn')?.addEventListener('click', async () => {
      if (confirm('Clear playlist cache? You will need to reload your playlist.')) {
        await Storage.clearStore('iptvCache');
        Storage.saveLastPlaylistUrl('');
        Utils.showToast('Cache cleared', 'success');
      }
    });
  }

  function applyTheme(theme) {
    if (theme === 'darker') {
      document.documentElement.style.setProperty('--bg-primary', '#000000');
      document.documentElement.style.setProperty('--bg-secondary', '#0A0A0A');
      document.documentElement.style.setProperty('--bg-card', '#111111');
    } else {
      document.documentElement.style.setProperty('--bg-primary', '#0B0B0B');
      document.documentElement.style.setProperty('--bg-secondary', '#141414');
      document.documentElement.style.setProperty('--bg-card', '#1F1F1F');
    }
  }

  return { render, applyTheme };
})();
