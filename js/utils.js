/**
 * utils.js — Sanitization, helpers, and utility functions
 */

const Utils = (() => {
  'use strict';

  // ---- URL Sanitization ----
  function sanitizeUrl(url) {
    if (!url || typeof url !== 'string') return '';
    const trimmed = url.trim();
    // Allow only http, https, rtmp, rtmps, rtp, udp schemes
    if (!/^(https?|rtmps?|rtp|udp):\/\//i.test(trimmed)) return '';
    // Block javascript: and data: embedded in URL
    if (/javascript:|data:/i.test(trimmed)) return '';
    return trimmed;
  }

  // ---- Text Sanitization (prevent XSS) ----
  function sanitizeText(str) {
    if (!str || typeof str !== 'string') return '';
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#x27;')
      .replace(/\//g, '&#x2F;');
  }

  // ---- Safe HTML (allow limited tags) ----
  function safeHtml(str) {
    return sanitizeText(str);
  }

  // ---- Generate stable ID from string ----
  function generateId(str) {
    if (!str) return 'id_' + Math.random().toString(36).slice(2);
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash |= 0;
    }
    return 'id_' + Math.abs(hash).toString(36);
  }

  // ---- Format duration (seconds → HH:MM:SS or MM:SS) ----
  function formatDuration(seconds) {
    if (!seconds || isNaN(seconds)) return '0:00';
    const s = Math.floor(seconds);
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    if (h > 0) {
      return `${h}:${String(m).padStart(2,'0')}:${String(sec).padStart(2,'0')}`;
    }
    return `${m}:${String(sec).padStart(2,'0')}`;
  }

  // ---- Format date ----
  function formatDate(ts) {
    if (!ts) return '';
    const d = new Date(ts);
    const now = new Date();
    const diff = now - d;
    if (diff < 60000) return 'Just now';
    if (diff < 3600000) return `${Math.floor(diff/60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff/3600000)}h ago`;
    if (diff < 604800000) return `${Math.floor(diff/86400000)}d ago`;
    return d.toLocaleDateString();
  }

  // ---- Debounce ----
  function debounce(fn, delay) {
    let timer;
    return function(...args) {
      clearTimeout(timer);
      timer = setTimeout(() => fn.apply(this, args), delay);
    };
  }

  // ---- Throttle ----
  function throttle(fn, limit) {
    let last = 0;
    return function(...args) {
      const now = Date.now();
      if (now - last >= limit) {
        last = now;
        return fn.apply(this, args);
      }
    };
  }

  // ---- Clamp ----
  function clamp(val, min, max) {
    return Math.min(Math.max(val, min), max);
  }

  // ---- Parse M3U attribute string ----
  function parseAttributes(attrStr) {
    const attrs = {};
    if (!attrStr) return attrs;
    // Match key="value" or key=value patterns
    const re = /([\w-]+)=(?:"([^"]*?)"|([^\s,]+))/g;
    let m;
    while ((m = re.exec(attrStr)) !== null) {
      attrs[m[1].toLowerCase()] = m[2] !== undefined ? m[2] : m[3];
    }
    return attrs;
  }

  // ---- Detect content type from URL ----
  function detectStreamType(url) {
    if (!url) return 'unknown';
    const u = url.toLowerCase().split('?')[0];
    if (u.endsWith('.m3u8') || u.endsWith('.m3u')) return 'hls';
    if (u.endsWith('.mp4') || u.endsWith('.mkv') || u.endsWith('.avi')) return 'mp4';
    if (u.endsWith('.ts')) return 'ts';
    if (u.startsWith('rtmp')) return 'rtmp';
    if (u.includes('/live/')) return 'hls';
    if (u.includes('/movie/')) return 'hls';
    if (u.includes('/series/')) return 'hls';
    return 'hls'; // default assumption
  }

  // ---- Lazy image loader ----
  let _imgObserver = null;
  function initLazyImages() {
    if (!('IntersectionObserver' in window)) {
      // Fallback: load all immediately
      document.querySelectorAll('img[data-src]').forEach(img => {
        img.src = img.dataset.src;
      });
      return;
    }
    if (_imgObserver) _imgObserver.disconnect();
    _imgObserver = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const img = entry.target;
          if (img.dataset.src) {
            img.src = img.dataset.src;
            img.removeAttribute('data-src');
            _imgObserver.unobserve(img);
          }
        }
      });
    }, { rootMargin: '200px' });

    document.querySelectorAll('img[data-src]').forEach(img => {
      _imgObserver.observe(img);
    });
  }

  function observeImage(img) {
    if (!_imgObserver) initLazyImages();
    if (_imgObserver && img.dataset.src) {
      _imgObserver.observe(img);
    }
  }

  // ---- Toast notification ----
  function showToast(message, type = 'info', duration = 3000) {
    const container = document.getElementById('toastContainer');
    if (!container) return;
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    container.appendChild(toast);
    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateX(40px)';
      toast.style.transition = 'opacity 0.3s, transform 0.3s';
      setTimeout(() => toast.remove(), 300);
    }, duration);
  }

  // ---- Placeholder image (data URI) ----
  const PLACEHOLDER_IMG = 'data:image/svg+xml;base64,' + btoa(`
    <svg xmlns="http://www.w3.org/2000/svg" width="160" height="240" viewBox="0 0 160 240">
      <rect width="160" height="240" fill="#1F1F1F"/>
      <text x="80" y="125" text-anchor="middle" fill="#444" font-size="40">&#9654;</text>
    </svg>
  `);

  const PLACEHOLDER_WIDE = 'data:image/svg+xml;base64,' + btoa(`
    <svg xmlns="http://www.w3.org/2000/svg" width="320" height="180" viewBox="0 0 320 180">
      <rect width="320" height="180" fill="#1F1F1F"/>
      <text x="160" y="95" text-anchor="middle" fill="#444" font-size="40">&#9654;</text>
    </svg>
  `);

  // ---- Normalize series title (extract show name, season, episode) ----
  function parseSeriesInfo(title) {
    if (!title) return { show: title, season: 1, episode: 1 };
    // Patterns: S01E01, s1e1, Season 1 Episode 1, 1x01
    const patterns = [
      /^(.*?)\s*[Ss](\d+)[Ee](\d+)/,
      /^(.*?)\s*[Ss]eason\s*(\d+)\s*[Ee]p(?:isode)?\s*(\d+)/i,
      /^(.*?)\s*(\d+)[xX](\d+)/,
    ];
    for (const re of patterns) {
      const m = title.match(re);
      if (m) {
        return {
          show: m[1].trim(),
          season: parseInt(m[2], 10),
          episode: parseInt(m[3], 10),
          original: title
        };
      }
    }
    return { show: title, season: 1, episode: 1, original: title };
  }

  // ---- Escape regex special chars ----
  function escapeRegex(str) {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  // ---- Deep clone ----
  function clone(obj) {
    return JSON.parse(JSON.stringify(obj));
  }

  // ---- Unique array by key ----
  function uniqueBy(arr, key) {
    const seen = new Set();
    return arr.filter(item => {
      const k = item[key];
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });
  }

  return {
    sanitizeUrl,
    sanitizeText,
    safeHtml,
    generateId,
    formatDuration,
    formatDate,
    debounce,
    throttle,
    clamp,
    parseAttributes,
    detectStreamType,
    initLazyImages,
    observeImage,
    showToast,
    PLACEHOLDER_IMG,
    PLACEHOLDER_WIDE,
    parseSeriesInfo,
    escapeRegex,
    clone,
    uniqueBy
  };
})();
