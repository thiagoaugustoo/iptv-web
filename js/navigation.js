/**
 * navigation.js — Keyboard and TV remote navigation system
 * Handles: ArrowUp/Down/Left/Right, Enter, Backspace/Escape
 * Samsung Tizen and LG WebOS key codes
 */

const Navigation = (() => {
  'use strict';

  // ---- Key code map ----
  const KEYS = {
    UP:        ['ArrowUp',    38],
    DOWN:      ['ArrowDown',  40],
    LEFT:      ['ArrowLeft',  37],
    RIGHT:     ['ArrowRight', 39],
    ENTER:     ['Enter',      13],
    BACK:      ['Backspace',  8, 'Escape', 27, 10009, 461], // Samsung/LG back
    EXIT:      [10182],  // Samsung Tizen exit
    PLAY:      [415, 179],
    PAUSE:     [19, 179],
    STOP:      [413],
    FF:        [417],
    RW:        [412],
    RED:       [403],
    GREEN:     [404],
    YELLOW:    [405],
    BLUE:      [406],
  };

  function matchKey(e, keyDef) {
    return keyDef.some(k => e.key === k || e.keyCode === k || e.which === k);
  }

  // ---- Focus management ----
  let _currentSection = null;
  let _sections = {};
  let _history = [];

  function registerSection(name, getFocusables, opts = {}) {
    _sections[name] = { getFocusables, opts };
  }

  function setSection(name) {
    _currentSection = name;
  }

  function getFocusables(container) {
    if (!container) return [];
    const sel = '[tabindex="0"], a[href], button:not([disabled]), input:not([disabled]), select:not([disabled])';
    return Array.from(container.querySelectorAll(sel)).filter(el => {
      const rect = el.getBoundingClientRect();
      return rect.width > 0 && rect.height > 0 && !el.closest('.hidden');
    });
  }

  function focusFirst(container) {
    const els = getFocusables(container || document.getElementById('mainContent'));
    if (els.length > 0) {
      els[0].focus();
      els[0].classList.add('focused');
    }
  }

  function focusElement(el) {
    if (!el) return;
    // Remove focused class from all
    document.querySelectorAll('.focused').forEach(e => e.classList.remove('focused'));
    el.focus();
    el.classList.add('focused');
    el.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'smooth' });
  }

  // ---- Spatial navigation ----
  function getCenter(el) {
    const r = el.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2, rect: r };
  }

  function findBest(current, candidates, direction) {
    const cur = getCenter(current);
    let best = null;
    let bestScore = Infinity;

    candidates.forEach(el => {
      if (el === current) return;
      const c = getCenter(el);
      const dx = c.x - cur.x;
      const dy = c.y - cur.y;

      let primary, secondary;
      switch (direction) {
        case 'up':    primary = -dy; secondary = Math.abs(dx); break;
        case 'down':  primary = dy;  secondary = Math.abs(dx); break;
        case 'left':  primary = -dx; secondary = Math.abs(dy); break;
        case 'right': primary = dx;  secondary = Math.abs(dy); break;
      }

      if (primary <= 0) return; // wrong direction

      // Score: prefer items directly in line, penalize off-axis
      const score = primary + secondary * 2;
      if (score < bestScore) {
        bestScore = score;
        best = el;
      }
    });

    return best;
  }

  // ---- Global key handler ----
  let _enabled = true;
  let _playerMode = false;

  function enable() { _enabled = true; }
  function disable() { _enabled = false; }
  function setPlayerMode(val) { _playerMode = val; }

  function handleKeyDown(e) {
    if (!_enabled) return;

    const active = document.activeElement;

    // Player mode: delegate to player
    if (_playerMode) {
      if (matchKey(e, KEYS.BACK)) {
        e.preventDefault();
        if (typeof App !== 'undefined') App.emit('player:close');
      }
      return;
    }

    // Back / Escape
    if (matchKey(e, KEYS.BACK)) {
      e.preventDefault();
      // If modal is open, close it
      const modal = document.getElementById('modalOverlay');
      if (modal && !modal.classList.contains('hidden')) {
        if (typeof App !== 'undefined') App.emit('modal:close');
        return;
      }
      // Navigate back in history
      if (typeof App !== 'undefined') {
        if (_history.length > 0) {
          const prev = _history.pop();
          App.navigate(prev);
        } else {
          App.navigate('home');
        }
      }
      return;
    }

    // Enter on nav items
    if (matchKey(e, KEYS.ENTER)) {
      if (active && active !== document.body) {
        active.click();
        e.preventDefault();
      }
      return;
    }

    // Arrow navigation
    const container = document.getElementById('mainContent') || document.body;
    const focusables = getFocusables(container);
    if (focusables.length === 0) return;

    let direction = null;
    if (matchKey(e, KEYS.UP))    direction = 'up';
    if (matchKey(e, KEYS.DOWN))  direction = 'down';
    if (matchKey(e, KEYS.LEFT))  direction = 'left';
    if (matchKey(e, KEYS.RIGHT)) direction = 'right';

    if (!direction) return;
    e.preventDefault();

    const currentFocused = active && focusables.includes(active) ? active : focusables[0];
    const next = findBest(currentFocused, focusables, direction);

    if (next) {
      focusElement(next);
    } else {
      // Try sidebar navigation
      const sidebar = document.getElementById('sidebar');
      if (sidebar) {
        const sidebarFocusables = getFocusables(sidebar);
        const nextInSidebar = findBest(currentFocused, sidebarFocusables, direction);
        if (nextInSidebar) focusElement(nextInSidebar);
      }
    }
  }

  function init() {
    document.addEventListener('keydown', handleKeyDown);

    // Track focus changes
    document.addEventListener('focusin', (e) => {
      document.querySelectorAll('.focused').forEach(el => {
        if (el !== e.target) el.classList.remove('focused');
      });
      if (e.target && e.target !== document.body) {
        e.target.classList.add('focused');
      }
    });

    document.addEventListener('focusout', (e) => {
      if (e.target) e.target.classList.remove('focused');
    });
  }

  function pushHistory(route) {
    if (_history[_history.length - 1] !== route) {
      _history.push(route);
      if (_history.length > 20) _history.shift();
    }
  }

  function clearHistory() {
    _history = [];
  }

  return {
    init,
    enable,
    disable,
    setPlayerMode,
    focusFirst,
    focusElement,
    getFocusables,
    registerSection,
    setSection,
    pushHistory,
    clearHistory,
    matchKey,
    KEYS
  };
})();
