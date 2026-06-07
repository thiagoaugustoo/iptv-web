/**
 * player.js — HLS.js wrapper with full controls
 * Supports: HLS streams, MP4/TS native, subtitles (VTT/SRT), audio tracks, quality levels
 */

const Player = (() => {

  function isHls(url) {
  if (!url) return false;

  return (
    url.includes('.m3u8') ||
    url.includes('application/vnd.apple.mpegurl')
  );
}
  'use strict';

  let _hls = null;
  let _video = null;
  let _currentItem = null;
  let _controlsTimer = null;
  let _progressSaveTimer = null;
  let _subtitleTrack = null;
  let _subtitleCues = [];
  let _subtitleTimer = null;
  let _isLive = false;

  const CONTROLS_HIDE_DELAY = 3500;
  const PROGRESS_SAVE_INTERVAL = 5000;

  // ---- DOM refs ----
  function dom(id) { return document.getElementById(id); }

  // ---- Init ----
  function init() {
    _video = dom('videoElement');
    if (!_video) return;

    // Video events
    _video.addEventListener('play',     onPlay);
    _video.addEventListener('pause',    onPause);
    _video.addEventListener('ended',    onEnded);
    _video.addEventListener('timeupdate', onTimeUpdate);
    _video.addEventListener('durationchange', onDurationChange);
    _video.addEventListener('waiting',  () => showSpinner(true));
    _video.addEventListener('playing',  () => showSpinner(false));
    _video.addEventListener('error',    onError);
    _video.addEventListener('canplay',  () => showSpinner(false));

    // Controls
    dom('btnPlayPause').addEventListener('click', togglePlayPause);
    dom('btnStop').addEventListener('click', stop);
    dom('btnRewind').addEventListener('click', () => seek(-10));
    dom('btnForward').addEventListener('click', () => seek(10));
    dom('btnMute').addEventListener('click', toggleMute);
    dom('btnFullscreen').addEventListener('click', toggleFullscreen);
    dom('btnSubtitles').addEventListener('click', toggleSubtitleMenu);
    dom('btnAudioTrack').addEventListener('click', toggleAudioMenu);
    dom('btnQuality').addEventListener('click', toggleQualityMenu);
    dom('playerClose').addEventListener('click', close);
    dom('playerRetry').addEventListener('click', retry);

    // Volume
    const volSlider = dom('volumeSlider');
    volSlider.addEventListener('input', () => {
      setVolume(parseInt(volSlider.value));
    });

    // Progress bar click/drag
    const progressBar = dom('playerProgressBar');
    progressBar.addEventListener('click', onProgressClick);
    progressBar.addEventListener('mousedown', onProgressDrag);
    progressBar.addEventListener('touchstart', onProgressTouch, { passive: true });

    // Controls visibility
    const overlay = dom('playerOverlay');
    overlay.addEventListener('mousemove', showControls);
    overlay.addEventListener('click', showControls);
    overlay.addEventListener('touchstart', showControls, { passive: true });

    // Keyboard shortcuts (player mode)
    document.addEventListener('keydown', onPlayerKey);

    // Fullscreen change
    document.addEventListener('fullscreenchange', onFullscreenChange);
    document.addEventListener('webkitfullscreenchange', onFullscreenChange);

    // Load saved volume
    const settings = Storage.getSettings();
    setVolume(settings.playerVolume || 100);
  }


  // ---- Open / Load ----
  function open(item) {
    console.log('ITEM:', item);
    console.log('STREAM URL:', item.streamUrl);
    console.log('URL:', item.url);
    async function loadChannel(item, startTime = 0) {
  try {
    const streamUrl = item.streamUrl || item.url;

    if (!streamUrl) {
      showError('URL do canal não encontrada');
      return;
    }

    let finalUrl = streamUrl;

    // 🚀 tudo que NÃO for m3u8 passa no proxy
    if (!isHls(streamUrl)) {
      const response = await fetch(
        `https://proxy.silvatech.dev.br/stream?url=${encodeURIComponent(streamUrl)}`
      );

      const data = await response.json();

      if (!data.hls) {
        showError('Proxy não retornou playlist HLS');
        return;
      }

      finalUrl = data.hls;
    }

    loadStream(finalUrl, startTime);

  } catch (err) {
    console.error(err);
    showError('Erro ao carregar stream');
  }
}

// Restore progress
const startTime = item.startTime || 0;

loadChannel(item, startTime);
    showControls();

    // Add to history
    Storage.addHistory({
      id: item.id,
      type: item.type,
      title: item.title,
      poster: item.poster || '',
      progress: 0
    });
  }

  function loadStream(url, startTime = 0) {
    destroyHls();
    _video.src = '';

    const streamType = Utils.detectStreamType(url);

    if (streamType === 'hls' && typeof Hls !== 'undefined' && Hls.isSupported()) {
      _hls = new Hls({
        enableWorker: true,
        lowLatencyMode: false,
        backBufferLength: 90,
        maxBufferLength: 30,
        maxMaxBufferLength: 600,
      });
      _hls.loadSource(url);
      _hls.attachMedia(_video);
      _hls.on(Hls.Events.MANIFEST_PARSED, () => {
        if (startTime > 0) _video.currentTime = startTime;
        _video.play().catch(() => {});
        updateQualityMenu();
        updateAudioMenu();
      });
      _hls.on(Hls.Events.ERROR, (event, data) => {
        if (data.fatal) {
          switch (data.type) {
            case Hls.ErrorTypes.NETWORK_ERROR:
              _hls.startLoad();
              break;
            case Hls.ErrorTypes.MEDIA_ERROR:
              _hls.recoverMediaError();
              break;
            default:
              showError('Stream error. Please retry.');
              break;
          }
        }
      });
    } else if (_video.canPlayType('application/vnd.apple.mpegurl') || streamType !== 'hls') {
      // Native HLS (Safari) or MP4/TS
      _video.src = url;
      _video.load();
      _video.addEventListener('loadedmetadata', () => {
        if (startTime > 0) _video.currentTime = startTime;
        _video.play().catch(() => {});
      }, { once: true });
    } else {
      showError('HLS not supported in this browser.');
    }
  }

  function destroyHls() {
    if (_hls) {
      _hls.destroy();
      _hls = null;
    }
  }

  // ---- Controls ----
  function togglePlayPause() {
    if (!_video) return;
    if (_video.paused) {
      _video.play().catch(() => {});
    } else {
      _video.pause();
    }
  }

  function stop() {
    if (_video) {
      _video.pause();
      _video.currentTime = 0;
    }
    close();
  }

  function seek(seconds) {
    if (!_video || _isLive) return;
    _video.currentTime = Utils.clamp(_video.currentTime + seconds, 0, _video.duration || 0);
    showControls();
  }

  function seekTo(time) {
    if (!_video) return;
    _video.currentTime = Utils.clamp(time, 0, _video.duration || 0);
  }

  function setVolume(val) {
    if (!_video) return;
    const v = Utils.clamp(val, 0, 100) / 100;
    _video.volume = v;
    _video.muted = v === 0;
    const slider = dom('volumeSlider');
    if (slider) slider.value = val;
    updateMuteBtn();
    Storage.saveSettings({ playerVolume: val });
  }

  function toggleMute() {
    if (!_video) return;
    _video.muted = !_video.muted;
    updateMuteBtn();
  }

  function updateMuteBtn() {
    const btn = dom('btnMute');
    if (!btn || !_video) return;
    btn.textContent = _video.muted || _video.volume === 0 ? '🔇' : '🔊';
  }

  function toggleFullscreen() {
    const overlay = dom('playerOverlay');
    if (!overlay) return;
    if (!document.fullscreenElement && !document.webkitFullscreenElement) {
      (overlay.requestFullscreen || overlay.webkitRequestFullscreen || (() => {})).call(overlay);
    } else {
      (document.exitFullscreen || document.webkitExitFullscreen || (() => {})).call(document);
    }
  }

  function onFullscreenChange() {
    const btn = dom('btnFullscreen');
    if (!btn) return;
    const isFs = !!(document.fullscreenElement || document.webkitFullscreenElement);
    btn.textContent = isFs ? '\u2756' : '\u26F6';
    btn.setAttribute('aria-label', isFs ? 'Exit fullscreen' : 'Fullscreen');
  }

  function close() {
    saveProgress();
    destroyHls();
    if (_video) {
      _video.pause();
      _video.src = '';
    }
    clearSubtitles();
    dom('playerOverlay').classList.add('hidden');
    Navigation.setPlayerMode(false);
    Navigation.enable();
    clearTimeout(_controlsTimer);
    clearInterval(_progressSaveTimer);
    _currentItem = null;
    App.emit('player:closed');
  }

  function retry() {
    if (_currentItem) {
      dom('playerError').classList.add('hidden');
      loadStream(_currentItem.streamUrl, _video ? _video.currentTime : 0);
    }
  }

  // ---- Events ----
  function onPlay() {
    const btn = dom('btnPlayPause');
    if (btn) btn.textContent = '⏸';
    startProgressSave();
  }

  function onPause() {
    const btn = dom('btnPlayPause');
    if (btn) btn.textContent = '▶';
    saveProgress();
  }

  function onEnded() {
    saveProgress();
    App.emit('player:ended', _currentItem);
  }

  function onTimeUpdate() {
    if (!_video) return;
    const cur = _video.currentTime;
    const dur = _video.duration;

    dom('playerCurrentTime').textContent = Utils.formatDuration(cur);
    if (!isNaN(dur) && dur > 0) {
      dom('playerDuration').textContent = Utils.formatDuration(dur);
      const pct = (cur / dur) * 100;
      dom('playerProgressFill').style.width = pct + '%';
      dom('playerProgressThumb').style.left = pct + '%';
    }

    updateSubtitles(cur);
  }

  function onDurationChange() {
    if (!_video) return;
    const dur = _video.duration;
    if (!isNaN(dur) && dur > 0) {
      dom('playerDuration').textContent = Utils.formatDuration(dur);
      _isLive = false;
    } else {
      dom('playerDuration').textContent = 'LIVE';
      _isLive = true;
    }
  }

  function onError() {
    showError('Failed to load stream.');
  }

  // ---- Progress bar ----
  function onProgressClick(e) {
    if (!_video || _isLive) return;
    const bar = dom('playerProgressBar');
    const rect = bar.getBoundingClientRect();
    const pct = (e.clientX - rect.left) / rect.width;
    seekTo(pct * (_video.duration || 0));
  }

  function onProgressDrag(e) {
    if (!_video || _isLive) return;
    const bar = dom('playerProgressBar');
    const move = (ev) => {
      const rect = bar.getBoundingClientRect();
      const pct = Utils.clamp((ev.clientX - rect.left) / rect.width, 0, 1);
      seekTo(pct * (_video.duration || 0));
    };
    const up = () => {
      document.removeEventListener('mousemove', move);
      document.removeEventListener('mouseup', up);
    };
    document.addEventListener('mousemove', move);
    document.addEventListener('mouseup', up);
  }

  function onProgressTouch(e) {
    if (!_video || _isLive) return;
    const bar = dom('playerProgressBar');
    const touch = e.touches[0];
    const rect = bar.getBoundingClientRect();
    const pct = Utils.clamp((touch.clientX - rect.left) / rect.width, 0, 1);
    seekTo(pct * (_video.duration || 0));
  }

  // ---- Controls visibility ----
  function showControls() {
    const overlay = dom('playerOverlay');
    if (!overlay) return;
    overlay.classList.add('controls-visible');
    clearTimeout(_controlsTimer);
    _controlsTimer = setTimeout(() => {
      overlay.classList.remove('controls-visible');
    }, CONTROLS_HIDE_DELAY);
  }

  // ---- Spinner / Error ----
  function showSpinner(show) {
    const el = dom('playerSpinner');
    if (el) el.classList.toggle('hidden', !show);
  }

  function showError(msg) {
    showSpinner(false);
    const el = dom('playerError');
    const msgEl = dom('playerErrorMsg');
    if (el) el.classList.remove('hidden');
    if (msgEl) msgEl.textContent = msg;
  }

  // ---- Progress save ----
  function saveProgress() {
    if (!_video || !_currentItem) return;
    const cur = _video.currentTime;
    const dur = _video.duration;
    if (cur < 5) return;

    Storage.saveContinueWatching({
      id: _currentItem.id,
      type: _currentItem.type,
      title: _currentItem.title,
      poster: _currentItem.poster || '',
      season: _currentItem.season || null,
      episode: _currentItem.episode || null,
      currentTime: cur,
      duration: isNaN(dur) ? 0 : dur,
    });

    Storage.addHistory({
      id: _currentItem.id,
      type: _currentItem.type,
      title: _currentItem.title,
      poster: _currentItem.poster || '',
      progress: isNaN(dur) || dur === 0 ? 0 : cur / dur,
      watchedAt: Date.now()
    });
  }

  function startProgressSave() {
    clearInterval(_progressSaveTimer);
    _progressSaveTimer = setInterval(saveProgress, PROGRESS_SAVE_INTERVAL);
  }

  // ---- Quality menu ----
  function toggleQualityMenu() {
    closeAllMenus();
    if (!_hls) return;
    const levels = _hls.levels;
    if (!levels || levels.length === 0) return;

    const menu = createMenu('quality-menu');
    const autoItem = createMenuItem('Auto', _hls.currentLevel === -1, () => {
      _hls.currentLevel = -1;
      closeAllMenus();
    });
    menu.appendChild(autoItem);

    levels.forEach((level, idx) => {
      const label = level.height ? `${level.height}p` : `Level ${idx}`;
      const item = createMenuItem(label, _hls.currentLevel === idx, () => {
        _hls.currentLevel = idx;
        closeAllMenus();
      });
      menu.appendChild(item);
    });

    dom('playerOverlay').appendChild(menu);
  }

  function updateQualityMenu() {
    const btn = dom('btnQuality');
    if (!btn || !_hls) return;
    const level = _hls.currentLevel;
    if (level >= 0 && _hls.levels[level]) {
      const h = _hls.levels[level].height;
      btn.textContent = h ? `${h}p` : 'HD';
    } else {
      btn.textContent = 'Auto';
    }
  }

  // ---- Audio track menu ----
  function toggleAudioMenu() {
    closeAllMenus();
    if (!_hls) return;
    const tracks = _hls.audioTracks;
    if (!tracks || tracks.length <= 1) return;

    const menu = createMenu('audio-menu');
    tracks.forEach((track, idx) => {
      const item = createMenuItem(track.name || `Track ${idx+1}`, _hls.audioTrack === idx, () => {
        _hls.audioTrack = idx;
        closeAllMenus();
      });
      menu.appendChild(item);
    });

    dom('playerOverlay').appendChild(menu);
  }

  function updateAudioMenu() {
    const btn = dom('btnAudioTrack');
    if (!btn || !_hls) return;
    const tracks = _hls.audioTracks;
    if (tracks && tracks.length > 1) {
      btn.style.opacity = '1';
    } else {
      btn.style.opacity = '0.4';
    }
  }

  // ---- Subtitle menu ----
  function toggleSubtitleMenu() {
    closeAllMenus();
    const menu = createMenu('subtitle-menu');

    const offItem = createMenuItem('Off', !_subtitleTrack, () => {
      _subtitleTrack = null;
      _subtitleCues = [];
      dom('subtitleDisplay').textContent = '';
      closeAllMenus();
    });
    menu.appendChild(offItem);

    // Native video text tracks
    if (_video && _video.textTracks) {
      Array.from(_video.textTracks).forEach((track, idx) => {
        const item = createMenuItem(track.label || `Subtitle ${idx+1}`, false, () => {
          Array.from(_video.textTracks).forEach(t => t.mode = 'hidden');
          track.mode = 'showing';
          closeAllMenus();
        });
        menu.appendChild(item);
      });
    }

    dom('playerOverlay').appendChild(menu);
  }

  // ---- Subtitle rendering ----
  function loadSubtitleUrl(url, format) {
    fetch(url).then(r => r.text()).then(text => {
      if (format === 'srt') {
        _subtitleCues = parseSRT(text);
      } else {
        _subtitleCues = parseVTT(text);
      }
      _subtitleTrack = url;
    }).catch(() => {});
  }

  function updateSubtitles(currentTime) {
    if (!_subtitleCues.length) return;
    const cue = _subtitleCues.find(c => currentTime >= c.start && currentTime <= c.end);
    const display = dom('subtitleDisplay');
    if (display) display.textContent = cue ? cue.text : '';
  }

  function clearSubtitles() {
    _subtitleCues = [];
    _subtitleTrack = null;
    const display = dom('subtitleDisplay');
    if (display) display.textContent = '';
  }

  function parseSRT(text) {
    const cues = [];
    const blocks = text.trim().split(/\n\s*\n/);
    blocks.forEach(block => {
      const lines = block.trim().split('\n');
      if (lines.length < 3) return;
      const timeMatch = lines[1].match(/(\d+):(\d+):(\d+)[,.](\d+)\s*-->\s*(\d+):(\d+):(\d+)[,.](\d+)/);
      if (!timeMatch) return;
      const start = toSeconds(timeMatch[1], timeMatch[2], timeMatch[3], timeMatch[4]);
      const end   = toSeconds(timeMatch[5], timeMatch[6], timeMatch[7], timeMatch[8]);
      const text  = lines.slice(2).join('\n');
      cues.push({ start, end, text });
    });
    return cues;
  }

  function parseVTT(text) {
    const cues = [];
    const lines = text.split('\n');
    let i = 0;
    while (i < lines.length) {
      const timeMatch = lines[i].match(/(\d+):(\d+):(\d+)\.(\d+)\s*-->\s*(\d+):(\d+):(\d+)\.(\d+)/);
      if (timeMatch) {
        const start = toSeconds(timeMatch[1], timeMatch[2], timeMatch[3], timeMatch[4]);
        const end   = toSeconds(timeMatch[5], timeMatch[6], timeMatch[7], timeMatch[8]);
        i++;
        const textLines = [];
        while (i < lines.length && lines[i].trim() !== '') {
          textLines.push(lines[i]);
          i++;
        }
        cues.push({ start, end, text: textLines.join('\n') });
      } else {
        i++;
      }
    }
    return cues;
  }

  function toSeconds(h, m, s, ms) {
    return parseInt(h)*3600 + parseInt(m)*60 + parseInt(s) + parseInt(ms)/1000;
  }

  // ---- Menu helpers ----

  function createMenu(id) {
    const menu = document.createElement('div');
    menu.className = 'player-menu';
    menu.id = id;
    return menu;
  }

  function createMenuItem(label, active, onClick) {
    const item = document.createElement('div');
    item.className = 'player-menu-item' + (active ? ' active' : '');
    item.textContent = label;
    item.tabIndex = 0;
    item.addEventListener('click', onClick);
    item.addEventListener('keydown', e => { if (e.key === 'Enter') onClick(); });
    return item;
  }

  function closeAllMenus() {
    ['quality-menu', 'audio-menu', 'subtitle-menu'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.remove();
    });
  }

  // ---- Keyboard shortcuts ----
  function onPlayerKey(e) {
    const overlay = dom('playerOverlay');
    if (!overlay || overlay.classList.contains('hidden')) return;

    showControls();

    switch (e.key) {
      case ' ':
      case 'k':
        e.preventDefault();
        togglePlayPause();
        break;
      case 'f':
      case 'F':
        e.preventDefault();
        toggleFullscreen();
        break;
      case 'm':
      case 'M':
        e.preventDefault();
        toggleMute();
        break;
      case 'ArrowLeft':
        e.preventDefault();
        seek(-10);
        break;
      case 'ArrowRight':
        e.preventDefault();
        seek(10);
        break;
      case 'ArrowUp':
        e.preventDefault();
        setVolume(Utils.clamp((_video ? _video.volume * 100 : 100) + 10, 0, 100));
        break;
      case 'ArrowDown':
        e.preventDefault();
        setVolume(Utils.clamp((_video ? _video.volume * 100 : 100) - 10, 0, 100));
        break;
      case 'Escape':
      case 'Backspace':
        e.preventDefault();
        close();
        break;
    }

    // Samsung/LG remote
    if (e.keyCode === 415 || e.keyCode === 179) togglePlayPause();
    if (e.keyCode === 19)  _video && _video.pause();
    if (e.keyCode === 413) stop();
    if (e.keyCode === 417) seek(30);
    if (e.keyCode === 412) seek(-30);
  }

  return {
    init,
    open,
    close,
    togglePlayPause,
    seek,
    setVolume,
    loadSubtitleUrl,
    isOpen: () => !dom('playerOverlay').classList.contains('hidden')
  };
})();
