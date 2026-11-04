/* Office ops HQ demo. Runs entirely in the browser; data is fictional and lives in localStorage. */
(function () {
  'use strict';
  var root = document.getElementById('demo');
  if (!root) return;
  var KEY = 'joyhdae.demo-hq.v1';
  var t = function (n, p) { if (window.track) window.track(n, p); };

  /* ---------- helpers ---------- */
  function h(tag, attrs) {
    var el = document.createElement(tag);
    if (attrs) Object.keys(attrs).forEach(function (k) {
      var v = attrs[k];
      if (v === false || v == null) return;
      if (k === 'class') el.className = v;
      else if (k === 'text') el.textContent = v;
      else if (k.slice(0, 2) === 'on') el.addEventListener(k.slice(2), v);
      else el.setAttribute(k, v === true ? '' : v);
    });
    (function add(list) {
      list.forEach(function (c) {
        if (c == null || c === false) return;
        if (Array.isArray(c)) return add(c);
        el.appendChild(typeof c === 'string' || typeof c === 'number' ? document.createTextNode(String(c)) : c);
      });
    })([].slice.call(arguments, 2));
    return el;
  }
  function pad(n) { return n < 10 ? '0' + n : '' + n; }
  function iso(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function addDays(n) { var d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() + n); return d; }
  function parse(s) { var p = String(s).split('-'); return new Date(+p[0], +p[1] - 1, +p[2]); }
  var today = addDays(0);
  function daysUntil(s) { return Math.round((parse(s) - today) / 86400000); }
  function fmtDate(s) {
    if (!s) return '';
    var d = parse(s);
    return isNaN(d) ? s : new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(d);
  }
  function money(n) { return '$' + Number(n || 0).toLocaleString('en-US'); }
  function uid(p) { return p + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }
  function clone(o) { return JSON.parse(JSON.stringify(o)); }

  /* ---------- data ---------- */
  var seedData, state, storageOk = true;
  function build(d) {
    return {
      vendors: d.vendors.map(function (x) { return { id: x.id, vendor: x.vendor, service: x.service, owner: x.owner, annualSpend: x.annualSpend, renewal: iso(addDays(x.renewalInDays)), status: x.status }; }),
      events: d.events.map(function (x) { return { id: x.id, title: x.title, type: x.type, date: iso(addDays(x.startInDays)), location: x.location, status: x.status }; }),
      runOfShow: clone(d.runOfShow || {}),
      projects: d.projects.map(function (x) { return { id: x.id, project: x.project, type: x.type, status: x.status, owner: x.owner, due: iso(addDays(x.dueInDays)) }; }),
      requests: d.requests.map(function (x) { return { id: x.id, title: x.title, category: x.category, requester: x.requester, priority: x.priority, status: x.status, opened: iso(addDays(x.openedInDays)) }; })
    };
  }
  function load() {
    try {
      var s = JSON.parse(localStorage.getItem(KEY));
      if (s && s.vendors && s.events && s.runOfShow && s.projects && s.requests) return s;
    } catch (e) {}
    return null;
  }
  function save() { try { localStorage.setItem(KEY, JSON.stringify(state)); storageOk = true; } catch (e) { storageOk = false; } }

  /* ---------- csv ---------- */
  function csvCell(v) {
    if (v == null) return '';
    var s = String(v);
    if (typeof v === 'string' && /^[=+\-@\t\r]/.test(s)) s = "'" + s; // keep spreadsheets from running formulas
    return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  }
  function exportCsv(name, headers, rows) {
    var text = '﻿' + [headers].concat(rows).map(function (r) { return r.map(csvCell).join(','); }).join('\r\n');
    var url = URL.createObjectURL(new Blob([text], { type: 'text/csv;charset=utf-8' }));
    var a = h('a', { href: url, download: name });
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
    t('demo_export_csv');
  }

  /* ---------- edit dialog ---------- */
  function editDialog(title, cols, row, onSave) {
    var titleId = uid('dt');
    var form = h('form', { method: 'dialog' });
    var first = null;
    cols.forEach(function (c) {
      if (c.computed) return;
      var id = uid('f'), val = row ? row[c.key] : (c.def !== undefined ? c.def : '');
      var input;
      if (c.type === 'select') {
        input = h('select', { id: id, name: c.key }, c.options.map(function (o) { return h('option', { value: o, selected: o === (val || c.options[0]) }, o); }));
      } else {
        input = h('input', { id: id, name: c.key, type: c.type === 'number' ? 'number' : c.type || 'text', required: !!c.required, min: c.type === 'number' ? '0' : false, step: c.type === 'number' ? '1' : false });
        input.value = val == null ? '' : val;
      }
      if (!first) first = input;
      form.appendChild(h('div', { class: 'field' }, h('label', { for: id, text: c.label }), input));
    });
    form.appendChild(h('div', { class: 'actions' },
      h('button', { type: 'button', class: 'btn btn--small btn--ghost', onclick: function () { dlg.close(); } }, 'Cancel'),
      h('button', { type: 'submit', class: 'btn btn--small btn--primary' }, 'Save')));
    var dlg = h('dialog', { 'aria-labelledby': titleId }, h('h2', { id: titleId, text: title }), form);
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      if (!form.reportValidity()) return;
      var out = {};
      cols.forEach(function (c) {
        if (c.computed) return;
        var v = form.elements[c.key].value;
        out[c.key] = c.type === 'number' ? Number(v || 0) : v.trim();
      });
      dlg.close();
      onSave(out);
    });
    dlg.addEventListener('close', function () { dlg.remove(); });
    document.body.appendChild(dlg);
    dlg.showModal();
    if (first) first.focus();
  }

  /* ---------- generic table ---------- */
  var ui = {};
  function alertOf(v) {
    if (!v.renewal || v.status === 'Terminated') return { k: 'none', days: null, label: '' };
    var d = daysUntil(v.renewal);
    if (d < 0) return { k: 'past', days: d, label: 'Past due by ' + (-d) + (d === -1 ? ' day' : ' days') };
    if (d <= 30) return { k: '30', days: d, label: 'Renews in ' + d + (d === 1 ? ' day' : ' days') };
    if (d <= 60) return { k: '60', days: d, label: 'Renews in ' + d + ' days' };
    if (d <= 90) return { k: '90', days: d, label: 'Renews in ' + d + ' days' };
    return { k: 'none', days: d, label: '' };
  }
  function alertChip(a) {
    return a.k === 'none' ? null : h('span', { class: 'chip chip--' + a.k, text: a.label });
  }

  function tableTab(cfg) {
    var s = ui[cfg.id] = ui[cfg.id] || { q: '', f: {}, sort: cfg.sort || null };
    var wrap = h('div');
    var tbody = h('tbody'), count = h('p', { class: 'srnote', role: 'status', 'aria-live': 'polite' });
    var thead = h('tr');
    var search = h('input', { type: 'search', id: cfg.id + '-q', value: s.q, placeholder: 'Search' });
    search.addEventListener('input', function () { s.q = search.value; draw(); });
    var controls = h('div', { class: 'controls' },
      h('label', { for: cfg.id + '-q' }, 'Search', search));
    (cfg.filters || []).forEach(function (f) {
      var sel = h('select', { id: cfg.id + '-f-' + f.key }, [h('option', { value: '' }, 'All')].concat(f.options.map(function (o) {
        var val = typeof o === 'string' ? o : o.value, lab = typeof o === 'string' ? o : o.label;
        return h('option', { value: val, selected: s.f[f.key] === val }, lab);
      })));
      sel.addEventListener('change', function () { s.f[f.key] = sel.value; draw(); });
      controls.appendChild(h('label', { for: sel.id }, f.label, sel));
    });
    controls.appendChild(h('button', { type: 'button', class: 'btn btn--small btn--primary', onclick: function () { edit(null); } }, cfg.addLabel));
    wrap.appendChild(controls);
    var table = h('table', null, h('caption', { class: 'visually-hidden', text: cfg.caption }), h('thead', null, thead), tbody);
    wrap.appendChild(h('div', { class: 'tablewrap', role: 'region', 'aria-label': cfg.caption + ' (scrollable)', tabindex: '0' }, table));
    wrap.appendChild(count);

    cfg.columns.forEach(function (c) {
      var th = h('th', { scope: 'col', class: c.type === 'number' ? 'num' : false });
      var btn = h('button', { type: 'button' }, c.label, h('span', { class: 'dir', 'aria-hidden': 'true' }));
      btn.addEventListener('click', function () {
        s.sort = s.sort && s.sort.key === c.key ? { key: c.key, dir: -s.sort.dir } : { key: c.key, dir: 1 };
        draw();
      });
      th._c = c; th._b = btn; th.appendChild(btn); thead.appendChild(th);
    });
    thead.appendChild(h('th', { scope: 'col' }, h('span', { class: 'visually-hidden', text: 'Actions' })));

    function val(row, c) { return c.sortVal ? c.sortVal(row) : row[c.key]; }
    function visible() {
      var rows = cfg.rows().filter(function (r) {
        if (s.q) {
          var hay = cfg.columns.map(function (c) { return c.computed ? '' : String(r[c.key] == null ? '' : r[c.key]); }).join(' ').toLowerCase();
          if (hay.indexOf(s.q.toLowerCase()) < 0) return false;
        }
        return (cfg.filters || []).every(function (f) { return !s.f[f.key] || f.test(r, s.f[f.key]); });
      });
      if (s.sort) {
        var c = cfg.columns.filter(function (x) { return x.key === s.sort.key; })[0];
        rows.sort(function (a, b) {
          var x = val(a, c), y = val(b, c);
          if (x == null) x = ''; if (y == null) y = '';
          var r = typeof x === 'number' && typeof y === 'number' ? x - y : String(x).localeCompare(String(y), undefined, { numeric: true });
          return r * s.sort.dir;
        });
      }
      return rows;
    }
    function edit(row) {
      editDialog(row ? cfg.editLabel : cfg.addLabel, cfg.columns, row, function (vals) {
        if (row) Object.keys(vals).forEach(function (k) { row[k] = vals[k]; });
        else { vals.id = uid(cfg.id[0]); cfg.rows().push(vals); }
        save(); rerender();
      });
    }
    function draw() {
      var rows = visible();
      tbody.textContent = '';
      [].forEach.call(thead.children, function (th) {
        if (!th._c) return;
        var on = s.sort && s.sort.key === th._c.key;
        th.setAttribute('aria-sort', on ? (s.sort.dir === 1 ? 'ascending' : 'descending') : 'none');
        th._b.lastChild.textContent = on ? (s.sort.dir === 1 ? '▲' : '▼') : '';
      });
      rows.forEach(function (r) {
        var tr = h('tr', { class: cfg.rowClass ? cfg.rowClass(r) : false });
        cfg.columns.forEach(function (c) {
          var content = c.cell ? c.cell(r) : c.type === 'number' ? money(r[c.key]) : c.type === 'date' ? fmtDate(r[c.key]) : r[c.key];
          tr.appendChild(h('td', { class: c.type === 'number' ? 'num' : false }, content));
        });
        tr.appendChild(h('td', { class: 'rowact' },
          h('button', { type: 'button', class: 'btn btn--ghost', onclick: function () { edit(r); } }, 'Edit', h('span', { class: 'visually-hidden', text: ' ' + (r[cfg.nameKey] || '') })),
          h('button', { type: 'button', class: 'btn btn--ghost', onclick: function () {
            if (confirm('Delete this row from the demo?')) { var a = cfg.rows(); a.splice(a.indexOf(r), 1); if (cfg.onDelete) cfg.onDelete(r); save(); rerender(); }
          } }, 'Delete', h('span', { class: 'visually-hidden', text: ' ' + (r[cfg.nameKey] || '') }))));
        tbody.appendChild(tr);
      });
      if (!rows.length) tbody.appendChild(h('tr', null, h('td', { colspan: cfg.columns.length + 1, class: 'empty', text: 'No rows match. Clear the search or filters, or add one.' })));
      count.textContent = rows.length + ' of ' + cfg.rows().length + ' shown. Saved in this browser only.';
      cfg._visible = rows;
    }
    draw();
    cfg._wrap = wrap;
    return wrap;
  }

  /* ---------- tab definitions ---------- */
  var STATUS_V = ['Active', 'In negotiation', 'Expired', 'Terminated'];
  var vendorCfg = {
    id: 'vendors', nameKey: 'vendor', caption: 'Vendors and contracts', addLabel: 'Add vendor', editLabel: 'Edit vendor',
    rows: function () { return state.vendors; }, sort: { key: 'renewal', dir: 1 },
    columns: [
      { key: 'vendor', label: 'Vendor', required: true },
      { key: 'service', label: 'Service' },
      { key: 'owner', label: 'Owner' },
      { key: 'annualSpend', label: 'Annual spend', type: 'number', def: 0 },
      { key: 'renewal', label: 'Renewal date', type: 'date', required: true, def: iso(addDays(90)), cell: function (r) { return fmtDate(r.renewal); } },
      { key: 'alert', label: 'Renewal alert', computed: true, sortVal: function (r) { var a = alertOf(r); return a.days == null ? 99999 : a.days; }, cell: function (r) { return alertChip(alertOf(r)) || '—'; }, csv: function (r) { return alertOf(r).label; } },
      { key: 'status', label: 'Status', type: 'select', options: STATUS_V }
    ],
    filters: [
      { key: 'status', label: 'Status', options: STATUS_V, test: function (r, v) { return r.status === v; } },
      { key: 'alert', label: 'Renewal alert', options: [{ value: 'past', label: 'Past due' }, { value: '30', label: 'Within 30 days' }, { value: '60', label: '31 to 60 days' }, { value: '90', label: '61 to 90 days' }], test: function (r, v) { return alertOf(r).k === v; } }
    ],
    rowClass: function (r) { return r.status === 'Expired' || r.status === 'Terminated' ? 'is-expired' : false; }
  };
  var EVENT_TYPES = ['Internal', 'Client', 'Roadshow', 'Other'];
  var EVENT_STATUS = ['Planning', 'Confirmed', 'Done', 'Cancelled'];
  var eventCfg = {
    id: 'events', nameKey: 'title', caption: 'Events', addLabel: 'Add event', editLabel: 'Edit event',
    rows: function () { return state.events; }, sort: { key: 'date', dir: 1 },
    onDelete: function (r) { delete state.runOfShow[r.id]; },
    columns: [
      { key: 'title', label: 'Event', required: true },
      { key: 'type', label: 'Type', type: 'select', options: EVENT_TYPES },
      { key: 'date', label: 'Date', type: 'date', required: true, def: iso(addDays(14)), cell: function (r) { return fmtDate(r.date); } },
      { key: 'location', label: 'Location' },
      { key: 'status', label: 'Status', type: 'select', options: EVENT_STATUS }
    ],
    filters: [
      { key: 'type', label: 'Type', options: EVENT_TYPES, test: function (r, v) { return r.type === v; } },
      { key: 'status', label: 'Status', options: EVENT_STATUS, test: function (r, v) { return r.status === v; } }
    ]
  };
  var PROJ_STATUS = ['Planning', 'In progress', 'Blocked', 'Done'];
  var PROJ_TYPES = ['Buildout', 'Move'];
  var REQ_CAT = ['Facilities', 'IT'], REQ_PRI = ['Low', 'Medium', 'High'], REQ_STATUS = ['Open', 'In progress', 'Done'];
  var requestCfg = {
    id: 'requests', nameKey: 'title', caption: 'Facilities and IT requests', addLabel: 'Add request', editLabel: 'Edit request',
    rows: function () { return state.requests; }, sort: { key: 'opened', dir: -1 },
    columns: [
      { key: 'title', label: 'Request', required: true },
      { key: 'category', label: 'Type', type: 'select', options: REQ_CAT },
      { key: 'requester', label: 'Requester' },
      { key: 'priority', label: 'Priority', type: 'select', options: REQ_PRI, def: 'Medium', sortVal: function (r) { return REQ_PRI.indexOf(r.priority); } },
      { key: 'status', label: 'Status', type: 'select', options: REQ_STATUS },
      { key: 'opened', label: 'Opened', type: 'date', required: true, def: iso(addDays(0)), cell: function (r) { return fmtDate(r.opened); } }
    ],
    filters: [
      { key: 'category', label: 'Type', options: REQ_CAT, test: function (r, v) { return r.category === v; } },
      { key: 'status', label: 'Status', options: REQ_STATUS, test: function (r, v) { return r.status === v; } },
      { key: 'priority', label: 'Priority', options: REQ_PRI, test: function (r, v) { return r.priority === v; } }
    ]
  };
  var rosCfg = {
    id: 'ros', nameKey: 'item', caption: 'Run-of-show', addLabel: 'Add item', editLabel: 'Edit item',
    rows: function () { return state.runOfShow[ui.selectedEvent] || (state.runOfShow[ui.selectedEvent] = []); },
    sort: { key: 'time', dir: 1 },
    columns: [
      { key: 'time', label: 'Time', type: 'time', required: true, def: '09:00' },
      { key: 'item', label: 'What happens', required: true },
      { key: 'owner', label: 'Owner' },
      { key: 'notes', label: 'Notes' }
    ]
  };

  /* ---------- panels ---------- */
  function overviewPanel(switchTo) {
    var open = state.requests.filter(function (r) { return r.status !== 'Done'; }).length;
    var buckets = { past: 0, '30': 0, '60': 0, '90': 0 };
    state.vendors.forEach(function (v) { var a = alertOf(v); if (buckets[a.k] !== undefined) buckets[a.k]++; });
    var renewing = buckets['30'] + buckets['60'] + buckets['90'];
    var activeProj = state.projects.filter(function (p) { return p.status !== 'Done'; }).length;
    var upcoming = state.events.filter(function (e) { var d = daysUntil(e.date); return d >= 0 && d <= 30 && e.status !== 'Cancelled' && e.status !== 'Done'; }).sort(function (a, b) { return a.date.localeCompare(b.date); });
    var spend = state.vendors.filter(function (v) { return v.status !== 'Terminated'; }).reduce(function (n, v) { return n + (Number(v.annualSpend) || 0); }, 0);
    function kpi(n, l) { return h('div', { class: 'kpi' }, h('b', { text: n }), h('span', { text: l })); }
    function jump(label, count, cls, key) {
      return h('button', { type: 'button', class: 'chip chip--' + cls, onclick: function () { ui.vendors = ui.vendors || { q: '', f: {}, sort: vendorCfg.sort }; ui.vendors.f = { alert: key }; switchTo('vendors'); } }, label + ': ' + count);
    }
    var soon = state.vendors.map(function (v) { return { v: v, a: alertOf(v) }; }).filter(function (x) { return x.a.k !== 'none'; }).sort(function (a, b) { return a.a.days - b.a.days; }).slice(0, 5);
    return h('div', null,
      h('h2', { text: 'Overview' }),
      h('p', { class: 'panel__lede', text: 'A snapshot of what needs attention across vendors, events, projects, and requests.' }),
      h('div', { class: 'kpis' }, kpi(open, 'Open requests'), kpi(renewing, 'Renewals in 90 days'), kpi(activeProj, 'Active projects'), kpi(money(spend), 'Annual vendor spend (sample)')),
      h('h3', { text: 'Vendor renewal alerts' }),
      h('div', { class: 'alerts' }, jump('Past due', buckets.past, 'past', 'past'), jump('Within 30 days', buckets['30'], '30', '30'), jump('31 to 60 days', buckets['60'], '60', '60'), jump('61 to 90 days', buckets['90'], '90', '90')),
      soon.length ? h('ul', null, soon.map(function (x) { return h('li', { style: false }, h('strong', { text: x.v.vendor }), ' — ', x.a.label.toLowerCase(), ' (', fmtDate(x.v.renewal), ')'); })) : h('p', { text: 'No renewals in the next 90 days.' }),
      h('h3', { text: 'Events in the next 30 days' }),
      upcoming.length ? h('ul', null, upcoming.map(function (e) { return h('li', null, h('strong', { text: e.title }), ' — ', fmtDate(e.date), e.location ? ', ' + e.location : ''); })) : h('p', { text: 'Nothing scheduled in the next 30 days.' }));
  }

  function eventsPanel() {
    var wrap = h('div', null, h('h2', { text: 'Calendar & events' }), h('p', { class: 'panel__lede', text: 'Track events, then open the run-of-show for any of them.' }));
    wrap.appendChild(tableTab(eventCfg));
    wrap.appendChild(h('h3', { text: 'Run-of-show' }));
    if (!state.events.length) { wrap.appendChild(h('p', { text: 'Add an event to build its run-of-show.' })); return wrap; }
    if (!ui.selectedEvent || !state.events.some(function (e) { return e.id === ui.selectedEvent; })) {
      ui.selectedEvent = (state.events.slice().sort(function (a, b) { return a.date.localeCompare(b.date); })[0]).id;
    }
    var sel = h('select', { id: 'ros-event' }, state.events.map(function (e) { return h('option', { value: e.id, selected: e.id === ui.selectedEvent }, e.title + ' (' + fmtDate(e.date) + ')'); }));
    sel.addEventListener('change', function () { ui.selectedEvent = sel.value; rerender(); });
    wrap.appendChild(h('div', { class: 'controls' }, h('label', { for: 'ros-event' }, 'Event', sel),
      h('button', { type: 'button', class: 'btn btn--small btn--ghost', onclick: function () {
        var cols = rosCfg.columns, data = rosCfg._visible || rosCfg.rows();
        exportCsv('northfield-sample-run-of-show.csv', cols.map(function (c) { return c.label; }), data.map(function (r) { return cols.map(function (c) { return r[c.key]; }); }));
      } }, 'Export run-of-show to CSV')));
    var rosWrap = tableTab(rosCfg);
    wrap.appendChild(rosWrap);
    return wrap;
  }

  function projectsPanel() {
    var s = ui.projects = ui.projects || { type: '' };
    var wrap = h('div', null, h('h2', { text: 'Projects' }), h('p', { class: 'panel__lede', text: 'Buildouts and moves on a simple status board. Change a card’s status from its menu.' }));
    var typeSel = h('select', { id: 'proj-type' }, [h('option', { value: '' }, 'All')].concat(PROJ_TYPES.map(function (o) { return h('option', { value: o, selected: s.type === o }, o); })));
    typeSel.addEventListener('change', function () { s.type = typeSel.value; rerender(); });
    var cols = [
      { key: 'project', label: 'Project', required: true },
      { key: 'type', label: 'Type', type: 'select', options: PROJ_TYPES },
      { key: 'status', label: 'Status', type: 'select', options: PROJ_STATUS },
      { key: 'owner', label: 'Owner' },
      { key: 'due', label: 'Due', type: 'date', required: true, def: iso(addDays(60)) }
    ];
    function edit(row) {
      editDialog(row ? 'Edit project' : 'Add project', cols, row, function (vals) {
        if (row) Object.keys(vals).forEach(function (k) { row[k] = vals[k]; }); else { vals.id = uid('p'); state.projects.push(vals); }
        save(); rerender();
      });
    }
    wrap.appendChild(h('div', { class: 'controls' }, h('label', { for: 'proj-type' }, 'Type', typeSel), h('button', { type: 'button', class: 'btn btn--small btn--primary', onclick: function () { edit(null); } }, 'Add project')));
    var board = h('div', { class: 'board' });
    PROJ_STATUS.forEach(function (st) {
      var items = state.projects.filter(function (p) { return p.status === st && (!s.type || p.type === s.type); }).sort(function (a, b) { return a.due.localeCompare(b.due); });
      var col = h('section', { class: 'col', 'aria-label': st }, h('h3', null, st, h('span', { text: items.length })));
      items.forEach(function (p) {
        var move = h('select', { 'aria-label': 'Status for ' + p.project }, PROJ_STATUS.map(function (o) { return h('option', { value: o, selected: o === p.status }, o); }));
        move.addEventListener('change', function () { p.status = move.value; save(); rerender(); });
        col.appendChild(h('div', { class: 'pcard' }, h('b', { text: p.project }),
          h('small', { text: p.type + (p.owner ? ' · ' + p.owner : '') }),
          h('small', { text: 'Due ' + fmtDate(p.due) }),
          h('div', { class: 'row' }, move,
            h('button', { type: 'button', class: 'btn btn--ghost', onclick: function () { edit(p); } }, 'Edit', h('span', { class: 'visually-hidden', text: ' ' + p.project })),
            h('button', { type: 'button', class: 'btn btn--ghost', onclick: function () { if (confirm('Delete this project from the demo?')) { state.projects.splice(state.projects.indexOf(p), 1); save(); rerender(); } } }, 'Delete', h('span', { class: 'visually-hidden', text: ' ' + p.project })))));
      });
      if (!items.length) col.appendChild(h('p', { class: 'srnote', text: 'Nothing here.' }));
      board.appendChild(col);
    });
    wrap.appendChild(board);
    return wrap;
  }

  function simplePanel(title, lede, cfg) {
    return h('div', null, h('h2', { text: title }), h('p', { class: 'panel__lede', text: lede }), tableTab(cfg));
  }

  /* ---------- shell ---------- */
  var TABS = [
    { id: 'overview', label: 'Overview' },
    { id: 'events', label: 'Calendar & events' },
    { id: 'vendors', label: 'Vendors & contracts' },
    { id: 'projects', label: 'Projects' },
    { id: 'requests', label: 'Requests' }
  ];
  var current = 'overview', shell, panelEl, tabEls = {}, exportBtn;

  function panelFor(id) {
    if (id === 'overview') return overviewPanel(switchTo);
    if (id === 'events') return eventsPanel();
    if (id === 'vendors') return simplePanel('Vendors & contracts', 'Contracts, owners, spend, and renewal dates, with alerts at 90, 60, and 30 days.', vendorCfg);
    if (id === 'projects') return projectsPanel();
    return simplePanel('Requests', 'Facilities and IT requests in one queue.', requestCfg);
  }
  function rerender() {
    var y = window.scrollY;
    panelEl.textContent = '';
    panelEl.appendChild(panelFor(current));
    exportBtn.hidden = current === 'overview';
    window.scrollTo(0, y);
  }
  function switchTo(id, user) {
    current = id;
    TABS.forEach(function (tb) {
      var on = tb.id === id;
      tabEls[tb.id].setAttribute('aria-selected', on ? 'true' : 'false');
      tabEls[tb.id].tabIndex = on ? 0 : -1;
    });
    panelEl.setAttribute('aria-labelledby', 'tab-' + id);
    rerender();
    t('demo_tab', { tab: id });
  }
  function doExport() {
    var name = 'northfield-sample-' + current + '.csv', hdr, rows;
    function fromCfg(cfg) {
      var cols = cfg.columns;
      var data = (cfg._visible || cfg.rows());
      return { hdr: cols.map(function (c) { return c.label; }), rows: data.map(function (r) { return cols.map(function (c) { return c.csv ? c.csv(r) : r[c.key]; }); }) };
    }
    var out;
    if (current === 'vendors') out = fromCfg(vendorCfg);
    else if (current === 'requests') out = fromCfg(requestCfg);
    else if (current === 'events') out = fromCfg(eventCfg);
    else if (current === 'projects') {
      var cols = ['Project', 'Type', 'Status', 'Owner', 'Due'];
      out = { hdr: cols, rows: state.projects.map(function (p) { return [p.project, p.type, p.status, p.owner, p.due]; }) };
    }
    if (out) exportCsv(name, out.hdr, out.rows);
  }

  function start(data) {
    seedData = data;
    state = load() || build(data);
    root.textContent = '';
    var tablist = h('div', { class: 'tabs', role: 'tablist', 'aria-label': 'Dashboard sections' });
    TABS.forEach(function (tb, i) {
      var b = h('button', { type: 'button', role: 'tab', class: 'tab', id: 'tab-' + tb.id, 'aria-controls': 'demo-panel', 'aria-selected': i === 0 ? 'true' : 'false', tabindex: i === 0 ? '0' : '-1' }, tb.label);
      b.addEventListener('click', function () { switchTo(tb.id); });
      b.addEventListener('keydown', function (e) {
        var idx = TABS.findIndex(function (x) { return x.id === current; }), n = null;
        if (e.key === 'ArrowRight') n = (idx + 1) % TABS.length;
        else if (e.key === 'ArrowLeft') n = (idx + TABS.length - 1) % TABS.length;
        else if (e.key === 'Home') n = 0; else if (e.key === 'End') n = TABS.length - 1;
        if (n === null) return;
        e.preventDefault(); switchTo(TABS[n].id); tabEls[TABS[n].id].focus();
      });
      tabEls[tb.id] = b; tablist.appendChild(b);
    });
    exportBtn = h('button', { type: 'button', class: 'btn btn--small btn--ghost', onclick: doExport }, 'Export to CSV');
    var reset = h('button', { type: 'button', class: 'btn btn--small btn--ghost', onclick: function () {
      if (!confirm('Reset the demo to its original sample data? Your changes in this browser will be removed.')) return;
      try { localStorage.removeItem(KEY); } catch (e) {}
      state = build(seedData); ui = {}; save(); rerender();
    } }, 'Reset');
    panelEl = h('div', { class: 'panel', role: 'tabpanel', id: 'demo-panel', 'aria-labelledby': 'tab-overview', tabindex: '0' });
    shell = h('div', { class: 'demo' },
      h('div', { class: 'demo__top' }, h('p', { class: 'demo__company', text: data.company || 'Northfield Advisory' }), h('div', { class: 'demo__actions' }, exportBtn, reset)),
      tablist, panelEl);
    root.appendChild(shell);
    rerender();
  }

  fetch(root.getAttribute('data-src')).then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); }).then(start).catch(function (e) { console.error(e);
    root.textContent = '';
    root.appendChild(h('p', { class: 'tk__label', text: 'The demo data could not be loaded. Please refresh the page.' }));
  });
})();
