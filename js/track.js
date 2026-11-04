/* Privacy-friendly event tracking.
 * Configured in data/site.json -> analytics.provider: "none" | "plausible" | "cloudflare".
 * "none" (the default) loads nothing. No cookies, no consent banner, no personal data.
 * Exposes window.track(eventName, props). */
(function () {
  'use strict';
  var cfg = {};
  try { cfg = JSON.parse(document.getElementById('site-config').textContent).analytics || {}; } catch (e) {}
  var provider = cfg.provider || 'none';

  // utm_source, utm_medium and utm_campaign from the URL are kept for the visit (sessionStorage, not a cookie)
  var utm = {};
  var KEYS = ['utm_source', 'utm_medium', 'utm_campaign'];
  try { utm = JSON.parse(sessionStorage.getItem('utm') || '{}'); } catch (e) {}
  try {
    var q = new URLSearchParams(location.search), found = false;
    KEYS.forEach(function (k) { var val = q.get(k); if (val) { utm[k] = val.slice(0, 80); found = true; } });
    if (found) { try { sessionStorage.setItem('utm', JSON.stringify(utm)); } catch (e) {} }
  } catch (e) {}

  function load(src, attrs) {
    var s = document.createElement('script');
    s.defer = true; s.src = src;
    Object.keys(attrs || {}).forEach(function (k) { s.setAttribute(k, attrs[k]); });
    document.head.appendChild(s);
  }

  if (provider === 'plausible' && cfg.plausible && cfg.plausible.domain) {
    window.plausible = window.plausible || function () { (window.plausible.q = window.plausible.q || []).push(arguments); };
    load(cfg.plausible.scriptSrc || 'https://plausible.io/js/script.tagged-events.js', { 'data-domain': cfg.plausible.domain });
  } else if (provider === 'cloudflare' && cfg.cloudflare && cfg.cloudflare.token) {
    load('https://static.cloudflareinsights.com/beacon.min.js', { 'data-cf-beacon': JSON.stringify({ token: cfg.cloudflare.token }) });
  }

  window.track = function (name, props) {
    var p = {};
    KEYS.forEach(function (k) { if (utm[k]) p[k] = utm[k]; });
    if (props) Object.keys(props).forEach(function (k) { if (props[k] !== '' && props[k] != null) p[k] = props[k]; });
    // Cloudflare Web Analytics records page views only; custom events are a Plausible feature.
    if (provider === 'plausible' && window.plausible) {
      try { window.plausible(name, Object.keys(p).length ? { props: p } : undefined); } catch (e) {}
    }
  };

  document.addEventListener('click', function (e) {
    var el = e.target.closest && e.target.closest('[data-track]');
    if (!el) return;
    var props = {};
    try { props = JSON.parse(el.getAttribute('data-track-props') || '{}'); } catch (err) {}
    window.track(el.getAttribute('data-track'), props);
  });

  document.addEventListener('DOMContentLoaded', function () {
    var view = document.body && document.body.getAttribute('data-track-view');
    if (view) window.track(view);
  });
})();
