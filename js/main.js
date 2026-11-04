(function () {
  'use strict';
  var reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  var t = function (n, p) { if (window.track) window.track(n, p); };

  /* Email: decoded in the browser so the address never appears in the HTML source. */
  function decode(b64) { try { return atob(b64).split('').reverse().join(''); } catch (e) { return ''; } }
  document.querySelectorAll('span[data-email]').forEach(function (el) {
    var addr = decode(el.getAttribute('data-email'));
    if (!addr) return;
    var a = document.createElement('a');
    a.href = 'mailto:' + addr; a.textContent = addr;
    el.textContent = ''; el.appendChild(a);
  });
  document.querySelectorAll('[data-copy-email]').forEach(function (btn) {
    var status = btn.parentNode.querySelector('[data-copy-status]');
    var label = btn.textContent;
    btn.addEventListener('click', function () {
      var addr = decode(btn.getAttribute('data-email'));
      var done = function () {
        btn.textContent = btn.getAttribute('data-copied') || 'Copied';
        if (status) status.textContent = btn.textContent;
        setTimeout(function () { btn.textContent = label; if (status) status.textContent = ''; }, 2500);
      };
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(addr).then(done, function () { fallback(addr, done); });
      } else fallback(addr, done);
    });
  });
  function fallback(text, done) {
    var ta = document.createElement('textarea');
    ta.value = text; ta.setAttribute('readonly', ''); ta.style.position = 'fixed'; ta.style.opacity = '0';
    document.body.appendChild(ta); ta.select();
    try { document.execCommand('copy'); done(); } catch (e) {}
    document.body.removeChild(ta);
  }

  /* Forms (Netlify Forms, posted in the background; falls back to a normal post without JS). */
  document.querySelectorAll('form[data-ajax]').forEach(function (form) {
    form.addEventListener('submit', function (e) {
      if (!window.fetch) return;
      e.preventDefault();
      var status = form.querySelector('[data-status]');
      var btn = form.querySelector('button[type=submit]');
      if (btn) btn.disabled = true;
      fetch('/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams(new FormData(form)).toString()
      }).then(function (r) {
        if (!r.ok) throw new Error(r.status);
        form.reset();
        status.removeAttribute('data-state');
        status.textContent = form.getAttribute('data-success');
        t(form.getAttribute('data-track-submit'));
      }).catch(function () {
        status.setAttribute('data-state', 'error');
        status.textContent = form.getAttribute('data-error');
      }).then(function () { if (btn) btn.disabled = false; });
    });
  });

  /* Resume: print button, and one print event however the dialog is opened. */
  var printBtn = document.querySelector('[data-print]');
  if (printBtn) printBtn.addEventListener('click', function () { window.print(); });
  if (document.body.classList.contains('resume-page')) {
    var last = 0;
    window.addEventListener('beforeprint', function () {
      var now = Date.now();
      if (now - last > 1500) t('resume_print');
      last = now;
    });
  }

  /* Current section in the nav. */
  var links = [].slice.call(document.querySelectorAll('.nav nav a'));
  if (links.length) {
    var map = links.map(function (a) { return { a: a, s: document.getElementById(a.getAttribute('href').slice(1)) }; }).filter(function (x) { return x.s; });
    var scroller = links[0].closest('nav');
    var ticking = false, current = null;
    var update = function () {
      ticking = false;
      var y = window.innerHeight * 0.35, active = null;
      map.forEach(function (x) { if (x.s.getBoundingClientRect().top <= y) active = x; });
      if (active === current) return;
      current = active;
      map.forEach(function (x) { if (x === active) x.a.setAttribute('aria-current', 'true'); else x.a.removeAttribute('aria-current'); });
      if (active && scroller.scrollWidth > scroller.clientWidth) {
        scroller.scrollTo({ left: active.a.offsetLeft - 24, behavior: reduce ? 'auto' : 'smooth' });
      }
    };
    window.addEventListener('scroll', function () { if (!ticking) { ticking = true; requestAnimationFrame(update); } }, { passive: true });
    update();
  }

  /* Numbers count up once, as the strip scrolls into view. */
  var counters = [].slice.call(document.querySelectorAll('[data-count]'));
  if (counters.length && 'IntersectionObserver' in window && !reduce) {
    counters.forEach(function (el) { el.textContent = '0'; });
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (!en.isIntersecting) return;
        io.unobserve(en.target);
        var el = en.target, end = parseFloat(el.getAttribute('data-count')), start = null, dur = 1400;
        (function step(ts) {
          if (start === null) start = ts;
          var p = Math.min((ts - start) / dur, 1), eased = 1 - Math.pow(1 - p, 3);
          el.textContent = Math.round(end * eased);
          if (p < 1) requestAnimationFrame(step); else el.textContent = el.getAttribute('data-count');
        })(performance.now());
      });
    }, { threshold: 0.6 });
    counters.forEach(function (el) { io.observe(el); });
  }
})();
