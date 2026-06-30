(function() {
  var lastActivity = Date.now();
  var INACTIVITY_MS = 30 * 60 * 1000;
  var pollTimer = null;
  var charts = { conv: null, perf: null, hour: null };

  var adminUsersPager = { page: 1, limit: 100, q: '' };

  var BAR_HOUR_PALETTE = [
    '#006b3c', '#0d9488', '#d97706', '#6366f1', '#db2777', '#0891b2', '#7c3aed', '#eab308',
    '#059669', '#f97316', '#8b5cf6', '#0ea5e9', '#e11d48', '#64748b', '#84cc16'
  ];

  var PERF_DONUT_COLORS = ['#006b3c', '#a855f7', '#3b82f6', '#ea580c', '#9333ea', '#0d9488', '#ca8a04'];

  /** Line / accent — Makerere institutional green */
  var DASH_ACCENT = '#006b3c';

  var SECTION_COPY = {
    overview: { title: 'Dashboard', subtitle: 'Overview of your assistant' },
    escalations: { title: 'Escalations', subtitle: 'Review and resolve hand-offs from users' },
    unresolved: { title: 'Unresolved', subtitle: 'Low-confidence replies to triage' },
    users: { title: 'Users', subtitle: 'Accounts and activity' },
    conversations: { title: 'Conversations', subtitle: 'Browse chat history' },
    feedback: { title: 'Feedback', subtitle: 'Ratings and comments' },
    kb: { title: 'Knowledge Base', subtitle: 'Curated FAQs, PDF uploads, and assistant search index' },
    'kb-tickets': { title: 'Support Tickets', subtitle: 'Student questions awaiting admin review' },
    documents: { title: 'Knowledge base', subtitle: 'Sources the assistant can cite' },
    reference: { title: 'Reference images', subtitle: 'Images linked from documents' },
    ingest: { title: 'Ingestion', subtitle: 'Import and index content' },
    settings: { title: 'Settings', subtitle: 'Model limits and assistant behavior' }
  };

  var PAGE_ICONS = {
    escalations:
      '<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.75"><path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.008v.008H12v-.008Z"/></svg>',
    unresolved:
      '<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.75"><path stroke-linecap="round" stroke-linejoin="round" d="M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.745.361-1.45.999-1.45 1.827v.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 5.25h.008v.008H12v-.008Z"/></svg>',
    conversations:
      '<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.75"><path stroke-linecap="round" stroke-linejoin="round" d="M8.625 12a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H8.25m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H12m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 0 1-2.555-.337A5.972 5.972 0 0 1 12 21c0-3.314-2.686-6-6-6H4.5m15 0v.75c0 1.036-.84 1.875-1.875 1.875H15a3 3 0 0 1-3-3v-.75"/></svg>',
    feedback:
      '<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.75"><path stroke-linecap="round" stroke-linejoin="round" d="M11.48 3.499a.562.562 0 0 1 1.04 0l2.125 5.111a.563.563 0 0 0 .475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 0 0-.182.557l1.285 5.385a.562.562 0 0 1-.84.61l-4.725-2.885a.562.562 0 0 0-.586 0L6.982 20.54a.562.562 0 0 1-.84-.61l1.285-5.384a.563.563 0 0 0-.182-.557l-4.204-3.602a.562.562 0 0 1 .321-.988l5.518-.442a.563.563 0 0 0 .475-.345L11.48 3.5Z"/></svg>',
    reference:
      '<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.75"><path stroke-linecap="round" stroke-linejoin="round" d="m2.25 15.75 5.159-5.159a2.25 2.25 0 0 1 3.182 0l5.159 5.159m-1.5-1.5 1.409-1.409a2.25 2.25 0 0 1 3.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 0 0 1.5-1.5V6a1.5 1.5 0 0 0-1.5-1.5H3A1.5 1.5 0 0 0 1.5 6v12a1.5 1.5 0 0 0 1.5 1.5Zm10.5-11.25h.008v.008H12V8.25Z"/></svg>',
    users:
      '<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.75"><path stroke-linecap="round" stroke-linejoin="round" d="M18 18.72a9.094 9.094 0 0 0 3.741-.479 3 3 0 0 0-4.682-2.72m0 0a9.05 9.05 0 0 1-5.69 0m5.69 0c1.093 0 2.06-.416 2.81-1.09M15 9.75a3 3 0 1 1-6 0 3 3 0 0 1 6 0Zm6 0a3 3 0 1 1-6 0 3 3 0 0 1 6 0Zm-14 0a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z"/></svg>',
    exportCsv:
      '<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.75"><path stroke-linecap="round" stroke-linejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3"/></svg>',
    upload:
      '<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.75"><path stroke-linecap="round" stroke-linejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5m-13.5-9L12 3m0 0 4.5 4.5M12 3v13.5"/></svg>',
    kb:
      '<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.75"><path stroke-linecap="round" stroke-linejoin="round" d="M3.75 12h16.5m-16.5 3.75h16.5M3.75 19.5h16.5M5.625 4.5h12.75a1.875 1.875 0 0 1 0 3.75H5.625a1.875 1.875 0 0 1 0-3.75Z"/></svg>',
    tickets:
      '<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.75"><path stroke-linecap="round" stroke-linejoin="round" d="M16.5 6v.75m0 3v.75m0 3v.75m0 3V18m-9-5.25h5.25M7.5 15h3M3.375 5.25c-.621 0-1.125.504-1.125 1.125v3.026a2.999 2.999 0 0 1 0 5.198v3.026c0 .621.504 1.125 1.125 1.125h17.25c.621 0 1.125-.504 1.125-1.125v-3.026a2.999 2.999 0 0 1 0-5.198V6.375c0-.621-.504-1.125-1.125-1.125H3.375Z"/></svg>',
    settings:
      '<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.75"><path stroke-linecap="round" stroke-linejoin="round" d="M10.5 6h9.75M10.5 6a1.5 1.5 0 1 1-3 0m3 0a1.5 1.5 0 1 0-3 0M3.75 6H7.5m3 12h9.75m-9.75 0a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m-3.75 0H7.5m9-6h3.75m-3.75 0a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m-9.75 0h9.75"/></svg>',
    ingest:
      '<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.75"><path stroke-linecap="round" stroke-linejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3"/></svg>',
    documents:
      '<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.75"><path stroke-linecap="round" stroke-linejoin="round" d="M12 6.042A8.967 8.967 0 0 0 6 3.75c-1.052 0-2.062.18-3 .512v14.25A9.937 9.937 0 0 1 6 17.998c3.087 0 5.738-2.097 9-3a8.957 8.957 0 0 1 3 .512"/></svg>'
  };

  function adminPageFail(msg) {
    return (
      '<div class="admin-page-wrap"><div class="admin-page-alert admin-page-alert--error">' +
      Utils.escapeHtml(msg || 'Something went wrong. Please try again.') +
      '</div></div>'
    );
  }

  function adminPageLoading() {
    return (
      '<div class="admin-page-wrap admin-page-loading">' +
      '<div class="admin-page-loading__bar"></div>' +
      '<div class="admin-page-loading__bar admin-page-loading__bar--sm"></div>' +
      '<div class="admin-page-loading__bar admin-page-loading__bar--lg"></div></div>'
    );
  }

  function adminPageBadge(text, variant) {
    return (
      '<span class="admin-page-badge admin-page-badge--' +
      (variant || 'neutral') +
      '">' +
      Utils.escapeHtml(String(text)) +
      '</span>'
    );
  }

  function adminEscalationBadge(status) {
    var s = String(status || '')
      .toLowerCase()
      .replace(/\s+/g, '_');
    var v = 'neutral';
    if (s === 'pending') v = 'warning';
    else if (s === 'resolved') v = 'success';
    else if (s === 'dismissed') v = 'muted';
    return adminPageBadge(String(status || ''), v);
  }

  function adminPageHead(sectionKey, iconSvg) {
    var c = SECTION_COPY[sectionKey] || { title: '', subtitle: '' };
    return (
      '<div class="admin-page-section-head">' +
      '<span class="admin-page-section-icon" aria-hidden="true">' +
      iconSvg +
      '</span>' +
      '<div><h2 class="admin-page-section-title">' +
      Utils.escapeHtml(c.title) +
      '</h2>' +
      '<p class="admin-page-section-sub">' +
      Utils.escapeHtml(c.subtitle) +
      '</p></div></div>'
    );
  }

  function chartColors() {
    var dark = document.documentElement.classList.contains('dark');
    return {
      tick: dark ? '#94a3b8' : '#64748b',
      grid: dark ? 'rgba(148,163,184,0.14)' : 'rgba(100,116,139,0.12)',
      legend: dark ? '#cbd5e1' : '#475569'
    };
  }

  function formatDashInt(n) {
    if (n == null || n === '' || isNaN(Number(n))) return '—';
    return Number(n).toLocaleString();
  }

  function formatDashPct(n) {
    if (n == null || isNaN(Number(n))) return '—';
    return Number(n).toFixed(1) + '%';
  }

  function formatTrendPct(pct) {
    if (pct === null || pct === undefined) return { cls: 'up', text: 'New' };
    if (pct === 0) return { cls: 'neutral', text: '0%' };
    return { cls: pct >= 0 ? 'up' : 'down', text: (pct > 0 ? '+' : '') + pct + '%' };
  }

  function formatTrendPts(pts) {
    if (pts === null || pts === undefined) return { cls: 'neutral', text: '—' };
    if (pts === 0) return { cls: 'neutral', text: '0 pts' };
    return { cls: pts >= 0 ? 'up' : 'down', text: (pts > 0 ? '+' : '') + pts + ' pts' };
  }

  /** Timeseries `d` may be YYYY-MM-DD or ISO datetime from JSON; parse at local noon to avoid TZ off-by-one. */
  function parseOverviewDay(dayVal) {
    if (dayVal == null || dayVal === '') return null;
    if (Object.prototype.toString.call(dayVal) === '[object Date]' && !isNaN(dayVal.getTime())) {
      return dayVal;
    }
    var s = String(dayVal).trim();
    var ymd = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (ymd) {
      var y = parseInt(ymd[1], 10);
      var mo = parseInt(ymd[2], 10) - 1;
      var da = parseInt(ymd[3], 10);
      return new Date(y, mo, da, 12, 0, 0, 0);
    }
    var d = new Date(s);
    return isNaN(d.getTime()) ? null : d;
  }

  function overviewDayKey(dayVal) {
    var d = parseOverviewDay(dayVal);
    if (!d) {
      var m = String(dayVal != null ? dayVal : '').match(/^(\d{4}-\d{2}-\d{2})/);
      return m ? m[1] : String(dayVal || '');
    }
    var y = d.getFullYear();
    var mo = d.getMonth() + 1;
    var da = d.getDate();
    return y + '-' + (mo < 10 ? '0' : '') + mo + '-' + (da < 10 ? '0' : '') + da;
  }

  function formatDashboardDateRange(tsPoints, windowDays) {
    var days = windowDays || 30;
    var opts = { month: 'short', day: 'numeric', year: 'numeric' };
    var end = new Date();
    end.setHours(12, 0, 0, 0);
    var start = new Date(end.getTime());
    start.setDate(start.getDate() - (days - 1));
    var fallback = function() {
      return start.toLocaleDateString(undefined, opts) + ' – ' + end.toLocaleDateString(undefined, opts);
    };
    if (!tsPoints || tsPoints.length === 0) return fallback();
    var a = parseOverviewDay(tsPoints[0].d);
    var b = parseOverviewDay(tsPoints[tsPoints.length - 1].d);
    if (!a || !b) return fallback();
    return a.toLocaleDateString(undefined, opts) + ' – ' + b.toLocaleDateString(undefined, opts);
  }

  /** Fill every day in the window (zeros on quiet days) so the line chart rises and falls. */
  function fillTimeseries(points, windowDays) {
    var days = windowDays || 30;
    var byDay = {};
    (points || []).forEach(function(p) {
      byDay[overviewDayKey(p.d)] = p.c != null ? p.c : 0;
    });
    var out = [];
    var end = new Date();
    end.setHours(12, 0, 0, 0);
    for (var i = days - 1; i >= 0; i--) {
      var d = new Date(end.getTime());
      d.setDate(d.getDate() - i);
      var key = overviewDayKey(d);
      out.push({ d: key, c: byDay[key] != null ? byDay[key] : 0 });
    }
    return out;
  }

  function overviewChartLabel(dayVal) {
    var d = parseOverviewDay(dayVal);
    if (!d) return String(dayVal || '');
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  }

  function trendArrowSvg(cls) {
    if (cls === 'neutral') return '';
    if (cls === 'up') {
      return '<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="M4.5 15.75l7.5-7.5 7.5 7.5"/></svg>';
    }
    return '<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5"/></svg>';
  }

  function renderTrend(t) {
    return (
      '<span class="admin-dash-kpi-trend admin-dash-kpi-trend--' +
      t.cls +
      '" title="Compared with the prior 7-day period">' +
      trendArrowSvg(t.cls) +
      Utils.escapeHtml(t.text) +
      '</span>'
    );
  }

  function kpiBlock(label, value, trend, iconSvg) {
    var trendHtml = trend ? renderTrend(trend) : '';
    return (
      '<div class="admin-dash-kpi">' +
      '<div class="admin-dash-kpi-top">' +
      '<div class="min-w-0 flex-1">' +
      '<div class="admin-dash-kpi-label">' +
      Utils.escapeHtml(label) +
      '</div>' +
      '<div class="admin-dash-kpi-value">' +
      Utils.escapeHtml(String(value)) +
      '</div>' +
      trendHtml +
      '</div>' +
      '<div class="admin-dash-kpi-icon" aria-hidden="true">' +
      iconSvg +
      '</div>' +
      '</div></div>'
    );
  }

  function touch() { lastActivity = Date.now(); }

  function adminFetch(path, opts) {
    touch();
    opts = opts || {};
    opts.credentials = 'include';
    if (opts.body && typeof opts.body === 'object' && !(opts.body instanceof FormData)) {
      opts.headers = opts.headers || {};
      opts.headers['Content-Type'] = 'application/json';
      opts.body = JSON.stringify(opts.body);
    }
    return fetch('/api/admin' + path, opts).then(function(res) {
      if (res.status === 401) { window.location.href = '/login'; return Promise.reject(); }
      if (res.status === 403) { window.location.href = '/'; return Promise.reject(); }
      var ct = res.headers.get('content-type') || '';
      if (ct.indexOf('application/json') >= 0) return res.json().then(function(j) {
        if (!res.ok) throw new Error(j.error || 'Request failed');
        return j;
      });
      if (!res.ok) throw new Error('Request failed');
      return res.text();
    });
  }

  /**
   * Manual text + PDF → POST /documents and /documents/upload-pdf (vector index for the assistant).
   * @param {string} idPrefix Unique prefix for DOM ids (e.g. kbidx-, docidx-).
   */
  function semanticIndexIngestPanelsHtml(idPrefix) {
    var px = idPrefix;
    var h = '<div class="admin-kb-panels">';
    h += '<article class="admin-kb-panel">';
    h += '<div class="admin-kb-panel__head">';
    h +=
      '<span class="admin-kb-panel__icon" aria-hidden="true"><svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.75"><path stroke-linecap="round" stroke-linejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.875v-1.5a3.375 3.375 0 0 1 3.375-3.375h1.125c.621 0 1.125.504 1.125 1.125v3.375c0 .621-.504 1.125-1.125 1.125h-2.25c-.621 0-1.125-.504-1.125-1.125Zm-6.75 0v-2.625A3.375 3.375 0 0 0 9.375 8.25h-1.5a1.125 1.125 0 0 1-1.125-1.125v-1.5a3.375 3.375 0 0 1 3.375-3.375H9.75"/></svg></span>';
    h += '<div><h3 class="admin-kb-panel__title">Text for search index</h3>';
    h += '<p class="admin-kb-panel__desc">Embed title and body into the assistant\'s retrieval index (semantic search).</p></div></div>';
    h += '<div class="admin-kb-panel__body">';
    h += '<div class="admin-kb-field"><label class="admin-kb-label" for="' + px + 'doc-title">Title</label>';
    h +=
      '<input id="' + px + 'doc-title" type="text" autocomplete="off" placeholder="e.g. Tuition payment deadlines" class="admin-kb-input"></div>';
    h += '<div class="admin-kb-field"><label class="admin-kb-label" for="' + px + 'doc-body">Content</label>';
    h +=
      '<textarea id="' + px + 'doc-body" rows="5" placeholder="Full text students might ask about…" class="admin-kb-textarea"></textarea></div>';
    h += '<div class="admin-kb-field"><label class="admin-kb-label" for="' + px + 'doc-cat">Category tag</label>';
    h +=
      '<input id="' + px + 'doc-cat" type="text" autocomplete="off" placeholder="faq, admissions… (default faq)" class="admin-kb-input"></div>';
    h += '</div>';
    h += '<button type="button" id="' + px + 'doc-save" class="admin-kb-btn admin-kb-btn--primary">Save &amp; embed</button>';
    h += '</article>';

    h += '<article class="admin-kb-panel">';
    h += '<div class="admin-kb-panel__head">';
    h +=
      '<span class="admin-kb-panel__icon" aria-hidden="true"><svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.75"><path stroke-linecap="round" stroke-linejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.875v-1.5a3.375 3.375 0 0 1 3.375-3.375h9.75A3.375 3.375 0 0 1 22.125 6v9.75a3.375 3.375 0 0 1-3.375 3.375h-9.75a3.375 3.375 0 0 1-3.375-3.375V6Z"/><path stroke-linecap="round" stroke-linejoin="round" d="M4.875 6.75h4.875a1.875 1.875 0 0 1 1.875 1.875v9.75a1.875 1.875 0 0 1-1.875 1.875H4.875A1.875 1.875 0 0 1 3 18.375v-9.75A1.875 1.875 0 0 1 4.875 6.75Z"/></svg></span>';
    h += '<div><h3 class="admin-kb-panel__title">Upload PDF</h3>';
    h +=
      '<p class="admin-kb-panel__desc">Text is extracted and chunked automatically. Scan-only PDFs need OCR outside AskMak first.</p></div></div>';
    h += '<div class="admin-kb-panel__body">';
    h += '<div class="admin-kb-field"><label class="admin-kb-label" for="' + px + 'doc-pdf-file">PDF file</label>';
    h += '<input id="' + px + 'doc-pdf-file" type="file" accept="application/pdf,.pdf" class="admin-kb-input admin-kb-input--file"></div>';
    h += '<div class="admin-kb-field"><label class="admin-kb-label" for="' + px + 'doc-pdf-title">Title <span class="admin-kb-optional">optional</span></label>';
    h +=
      '<input id="' + px + 'doc-pdf-title" type="text" autocomplete="off" placeholder="Uses PDF metadata or filename if empty" class="admin-kb-input"></div>';
    h += '<div class="admin-kb-field"><label class="admin-kb-label" for="' + px + 'doc-pdf-cat">Category tag</label>';
    h +=
      '<input id="' + px + 'doc-pdf-cat" type="text" autocomplete="off" placeholder="default faq" class="admin-kb-input"></div>';
    h += '</div>';
    h +=
      '<button type="button" id="' +
      px +
      'doc-pdf-upload" class="admin-kb-btn admin-kb-btn--secondary">Upload PDF &amp; embed</button>';
    h += '</article></div>';
    return h;
  }

  function bindSemanticIndexIngest(prefix, onDone) {
    document.getElementById(prefix + 'doc-save').addEventListener('click', function() {
      var title = document.getElementById(prefix + 'doc-title').value.trim();
      var content = document.getElementById(prefix + 'doc-body').value.trim();
      var category = document.getElementById(prefix + 'doc-cat').value.trim() || 'faq';
      if (!title || !content) { Utils.showToast('Title and content required', 'error'); return; }
      adminFetch('/documents', { method: 'POST', body: { title: title, content: content, category: category } })
        .then(function() {
          Utils.showToast('Saved to search index', 'success');
          document.getElementById(prefix + 'doc-title').value = '';
          document.getElementById(prefix + 'doc-body').value = '';
          if (typeof onDone === 'function') onDone();
        })
        .catch(function(e) { Utils.showToast(e.message || 'Failed', 'error'); });
    });
    document.getElementById(prefix + 'doc-pdf-upload').addEventListener('click', function() {
      var fileInput = document.getElementById(prefix + 'doc-pdf-file');
      var f = fileInput && fileInput.files && fileInput.files[0];
      if (!f) { Utils.showToast('Choose a PDF file', 'error'); return; }
      var fd = new FormData();
      fd.append('file', f);
      var pt = document.getElementById(prefix + 'doc-pdf-title').value.trim();
      if (pt) fd.append('title', pt);
      var pcat = document.getElementById(prefix + 'doc-pdf-cat').value.trim() || 'faq';
      fd.append('category', pcat);
      var btn = document.getElementById(prefix + 'doc-pdf-upload');
      btn.disabled = true;
      adminFetch('/documents/upload-pdf', { method: 'POST', body: fd })
        .then(function(j) {
          Utils.showToast('Added ' + (j.inserted || 0) + ' indexed chunk(s)', 'success');
          fileInput.value = '';
          document.getElementById(prefix + 'doc-pdf-title').value = '';
          if (typeof onDone === 'function') onDone();
        })
        .catch(function(e) { Utils.showToast(e.message || 'Failed', 'error'); })
        .finally(function() { btn.disabled = false; });
    });
  }

  function destroyCharts() {
    ['conv', 'perf', 'hour'].forEach(function(k) {
      if (charts[k]) { charts[k].destroy(); charts[k] = null; }
    });
  }

  function setActiveNav(section) {
    document.querySelectorAll('.admin-nav').forEach(function(btn) {
      btn.removeAttribute('data-active');
      if (btn.getAttribute('data-section') === section) btn.setAttribute('data-active', 'true');
    });
    var copy = SECTION_COPY[section] || { title: section, subtitle: '' };
    document.getElementById('section-title').textContent = copy.title;
    var sub = document.getElementById('section-subtitle');
    if (sub) sub.textContent = copy.subtitle;
    var dateWrap = document.getElementById('admin-date-range-wrap');
    if (dateWrap) {
      if (section === 'overview') dateWrap.classList.remove('hidden');
      else dateWrap.classList.add('hidden');
    }
  }

  function openModal(title, html) {
    document.getElementById('modal-title').textContent = title;
    document.getElementById('modal-body').innerHTML = html;
    document.getElementById('admin-modal').classList.remove('hidden');
  }

  function closeModal() {
    document.getElementById('admin-modal').classList.add('hidden');
  }

  function escBadge(n) {
    var el = document.getElementById('nav-esc-count');
    if (!el) return;
    if (n > 0) { el.textContent = String(n); el.classList.remove('hidden'); }
    else { el.classList.add('hidden'); }
  }

  function loadOverview() {
    destroyCharts();
    var main = document.getElementById('admin-main');
    var cc = chartColors();
    main.innerHTML = '<div class="text-slate-500 dark:text-slate-400 text-sm py-8 text-center">Loading…</div>';
    Promise.all([
      adminFetch('/stats'),
      adminFetch('/stats/timeseries?days=30'),
      adminFetch('/stats/topics?days=90'),
      adminFetch('/activity/recent?limit=20')
    ]).then(function(results) {
      var s = results[0];
      var ts = fillTimeseries(results[1].points || [], 30);
      var perfRaw = results[2].segments || [];
      var topicsDays = results[2].days != null ? results[2].days : 90;
      var activity = results[3].chats || [];
      var trends = s.trends || {};

      escBadge(s.pending_escalations || 0);

      var dateEl = document.getElementById('admin-date-range-text');
      if (dateEl) {
        dateEl.textContent = formatDashboardDateRange(ts, 30);
      }

      var iconChat =
        '<svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.75"><path stroke-linecap="round" stroke-linejoin="round" d="M20.25 8.511c.884.284 1.5 1.128 1.5 2.097v4.286c0 1.136-.847 2.1-1.98 2.193-.343.027-.698.036-1.052.063-.523.049-1.048.098-1.573.098H4.28c-.525 0-1.049-.049-1.573-.098a63.698 63.698 0 01-1.052-.063 2.052 2.052 0 01-1.593-2.086V6.852c0-.97.617-1.813 1.5-2.097V4.511a2.25 2.25 0 012.092-2.245 48.733 48.733 0 017.924 0c.982.058 1.754.849 1.754 1.834V4.393l.087.087"/></svg>';
      var iconUsers =
        '<svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.75"><path stroke-linecap="round" stroke-linejoin="round" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.675 0-5.216-.584-7.499-1.632Z"/></svg>';
      var iconDoc =
        '<svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.75"><path stroke-linecap="round" stroke-linejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5a1.125 1.125 0 01-1.125-1.125V7.875a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z"/></svg>';
      var iconHeart =
        '<svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.75"><path stroke-linecap="round" stroke-linejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z"/></svg>';

      var satVal = s.satisfaction_pct != null ? formatDashPct(s.satisfaction_pct) : '—';
      var satTrend = formatTrendPts(trends.satisfaction_pts_delta);

      var html = '<div class="admin-dash admin-dash-one-screen">';
      html += '<div class="admin-dash-kpi-grid">';
      html += kpiBlock('Total conversations', formatDashInt(s.conversations_total), null, iconChat);
      html += kpiBlock(
        'Active users (7d)',
        formatDashInt(s.active_users_7d),
        formatTrendPct(trends.active_users_7d_pct),
        iconUsers
      );
      html += kpiBlock(
        'Knowledge sources',
        formatDashInt(s.documents_sources != null ? s.documents_sources : '—'),
        formatTrendPct(trends.documents_indexed_week_pct),
        iconDoc
      );
      html += kpiBlock('Satisfaction rate', satVal, satTrend, iconHeart);
      html += '</div>';

      html += '<div class="admin-dash-charts-row">';
      html +=
        '<div class="admin-dash-chart-panel flex flex-col">' +
        '<div class="admin-overview-chart-meta">' +
        '<h3 class="admin-overview-chart-title">Conversations over time</h3>' +
        '<p class="admin-overview-chart-sub">New chats per day · trailing 30 days</p></div>' +
        '<div class="admin-dash-chart-canvas"><canvas id="chart-conv" aria-label="Chat volume chart"></canvas></div></div>';

      html +=
        '<div class="admin-dash-chart-panel flex flex-col">' +
        '<div class="admin-overview-chart-meta">' +
        '<h3 class="admin-overview-chart-title">Top Topics</h3>' +
        '<p class="admin-overview-chart-sub">Requested by users · last ' +
        topicsDays +
        ' days</p></div>' +
        '<div class="admin-dash-chart-canvas"><canvas id="chart-perf" aria-label="Top topics chart"></canvas></div></div>';
      html += '</div>';

      html += '<div class="admin-dash-bottom-row">';
      html += '<div class="admin-dash-side">';
      html += '<div class="admin-dash-activity-card admin-dash-activity-card--recent">';
      html += '<div class="admin-dash-inset-head">';
      html += '<h3 class="admin-dash-inset-title">Recent conversations</h3>';
      html +=
        '<button type="button" class="admin-dash-link" id="dash-view-conv">View all</button>';
      html += '</div>';
      html +=
        '<div class="admin-overview-activity thin-scroll admin-overview-activity--in-card">';
      if (!activity.length) {
        html +=
          '<div class="px-3 py-3 text-slate-500 text-sm admin-overview-activity-row">No chats yet</div>';
      }
      activity.slice(0, 3).forEach(function(ch, idx) {
        var whoRaw = ch.user_id ? ch.full_name || ch.email || 'User' : 'Guest';
        var initial = String(whoRaw).trim().charAt(0) || '?';
        if (whoRaw === 'Guest') initial = 'G';
        initial = initial.toUpperCase();
        var tone = idx % 4;
        var line = Utils.truncate(ch.first_message || ch.title || 'New chat', 96);
        var badge = ch.escalated
          ? '<span class="ml-2 shrink-0 text-[10px] font-semibold uppercase tracking-wide text-red-600 dark:text-red-400">Escalated</span>'
          : '';
        html +=
          '<button type="button" class="admin-overview-activity-row w-full text-left py-2.5 px-3 flex gap-3 items-center admin-open-chat" data-id="' +
          ch.id +
          '">';
        html +=
          '<div class="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white avatar-tone-' +
          tone +
          '">';
        html += Utils.escapeHtml(initial) + '</div>';
        html += '<div class="flex-1 min-w-0">';
        html +=
          '<div class="text-sm font-medium text-slate-800 dark:text-slate-100 leading-snug flex flex-wrap items-baseline gap-x-1">';
        html += '<span>' + Utils.escapeHtml(line) + '</span>' + badge + '</div>';
        html +=
          '<div class="text-xs text-slate-500 dark:text-slate-400 mt-0.5">' +
          Utils.formatTime(ch.updated_at) +
          '</div>';
        html += '</div></button>';
      });
      html += '</div></div></div>';

      html += '<div class="admin-dash-side">';
      var qaIconDoc =
        '<svg xmlns="http://www.w3.org/2000/svg" class="admin-dash-quick-icon shrink-0" width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.75" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5a1.125 1.125 0 01-1.125-1.125V7.875a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z"/></svg>';
      var qaIconUsers =
        '<svg xmlns="http://www.w3.org/2000/svg" class="admin-dash-quick-icon shrink-0" width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.75" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.646-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.253v13m0-13V9.75A3.75 3.75 0 1112 6.253"/></svg>';
      var qaIconChart =
        '<svg xmlns="http://www.w3.org/2000/svg" class="admin-dash-quick-icon shrink-0" width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.75" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z"/></svg>';
      var qaChevron =
        '<svg class="admin-dash-quick-chevron shrink-0 opacity-45" width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5"/></svg>';
      html += '<div class="admin-dash-quick">';
      html += '<div class="admin-dash-inset-head admin-dash-inset-head--quick">';
      html += '<h3 class="admin-dash-inset-title">Quick actions</h3>';
      html += '</div>';
      html +=
        '<button type="button" data-quick-section="documents"><span class="admin-dash-quick-label">' +
        qaIconDoc +
        '<span>Add document</span></span>' +
        qaChevron +
        '</button>';
      html +=
        '<button type="button" data-quick-section="users"><span class="admin-dash-quick-label">' +
        qaIconUsers +
        '<span>Manage users</span></span>' +
        qaChevron +
        '</button>';
      html +=
        '<button type="button" data-quick-section="conversations"><span class="admin-dash-quick-label">' +
        qaIconChart +
        '<span>View analytics</span></span>' +
        qaChevron +
        '</button>';
      html += '</div></div></div>';

      html += '</div>';
      main.innerHTML = html;

      var viewAll = document.getElementById('dash-view-conv');
      if (viewAll) {
        viewAll.addEventListener('click', function() {
          loadSection('conversations');
        });
      }
      main.querySelectorAll('[data-quick-section]').forEach(function(btn) {
        btn.addEventListener('click', function() {
          loadSection(btn.getAttribute('data-quick-section'));
        });
      });

      var labels = ts.map(function(p) {
        return overviewChartLabel(p.d);
      });
      var data = ts.map(function(p) {
        return p.c;
      });

      charts.conv = new Chart(document.getElementById('chart-conv'), {
        type: 'line',
        data: {
          labels: labels,
          datasets: [
            {
              label: 'New chats',
              data: data,
              borderColor: DASH_ACCENT,
              backgroundColor: 'rgba(0,107,60,0.14)',
              fill: true,
              cubicInterpolationMode: 'monotone',
              tension: 0.35,
              pointRadius: 0,
              pointHoverRadius: 6,
              pointHoverBorderWidth: 2,
              pointHoverBackgroundColor: DASH_ACCENT,
              pointHoverBorderColor: '#ffffff',
              borderWidth: 2.5,
              spanGaps: false
            }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          interaction: { mode: 'index', intersect: false },
          animation: {
            duration: 1400,
            easing: 'easeOutQuart'
          },
          plugins: {
            legend: { display: false },
            tooltip: {
              callbacks: {
                title: function(items) {
                  var idx = items[0] && items[0].dataIndex;
                  if (idx == null || !ts[idx]) return '';
                  return overviewDayKey(ts[idx].d);
                }
              }
            }
          },
          scales: {
            x: {
              grid: { display: false },
              ticks: { maxRotation: 0, autoSkip: true, maxTicksLimit: 8, color: cc.tick }
            },
            y: {
              beginAtZero: true,
              grace: '10%',
              ticks: { precision: 0, color: cc.tick },
              grid: { color: cc.grid }
            }
          }
        }
      });

      var perfSlices = perfRaw.filter(function(seg) {
        return (seg.value || 0) > 0;
      });
      var donutLabels = perfSlices.map(function(x) {
        return x.label || '—';
      });
      var donutData = perfSlices.map(function(x) {
        return x.value;
      });
      var donutBg = donutLabels.map(function(_, i) {
        return PERF_DONUT_COLORS[i % PERF_DONUT_COLORS.length];
      });
      if (!donutData.length) {
        donutLabels = ['No user questions in window'];
        donutData = [1];
        donutBg = ['#94a3b8'];
      }

      charts.perf = new Chart(document.getElementById('chart-perf'), {
        type: 'doughnut',
        data: {
          labels: donutLabels,
          datasets: [
            {
              data: donutData,
              backgroundColor: donutBg,
              borderWidth: 0,
              hoverOffset: 8
            }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          cutout: '62%',
          plugins: {
            legend: {
              position: 'right',
              labels: {
                padding: 10,
                usePointStyle: true,
                pointStyle: 'circle',
                boxWidth: 8,
                font: { size: 10 },
                color: cc.legend
              }
            }
          }
        }
      });

      main.querySelectorAll('.admin-open-chat').forEach(function(btn) {
        btn.addEventListener('click', function() {
          openConversationModal(btn.getAttribute('data-id'));
        });
      });
    }).catch(function() {
      if (main) main.classList.remove('admin-main--dashboard');
      main.innerHTML =
        '<p class="text-red-600 dark:text-red-400 font-medium">Failed to load overview</p>';
    });
  }

  function openConversationModal(id) {
    adminFetch('/conversations/' + id).then(function(d) {
      var msgs = d.messages || [];
      var html = '<div class="admin-modal-body max-h-[60vh] overflow-y-auto thin-scroll">';
      msgs.forEach(function(m) {
        var role = m.role;
        var cls =
          role === 'user' ? ' admin-modal-msg--user' : role === 'assistant' ? ' admin-modal-msg--assistant' : '';
        html += '<div class="admin-modal-msg' + cls + '">';
        html += '<span class="admin-modal-msg__role">' + Utils.escapeHtml(role) + '</span>';
        html +=
          '<div class="admin-modal-msg__body prose prose-sm prose-sans dark:prose-invert max-w-none">' +
          (role === 'assistant' ? Utils.renderMarkdown(m.content || '') : Utils.escapeHtml(m.content || '')) +
          '</div>';
        if (m.image_url) {
          html +=
            '<img src="' +
            Utils.escapeHtml(m.image_url) +
            '" class="mt-2 max-h-40 rounded cursor-pointer" onclick="Utils.openLightbox(this.src)">';
        }
        html += '</div>';
      });
      html += '</div>';
      openModal(d.chat.title || 'Conversation', html);
    }).catch(function() { Utils.showToast('Failed to load chat', 'error'); });
  }

  function loadEscalations(statusFilter) {
    var main = document.getElementById('admin-main');
    main.innerHTML = adminPageLoading();
    var qs = '/escalations?limit=50';
    if (statusFilter) qs += '&status=' + encodeURIComponent(statusFilter);
    adminFetch(qs).then(function(d) {
      var rows = d.escalations || [];
      var total = d.total != null ? d.total : rows.length;
      var html = '<div class="admin-page-wrap">' + adminPageHead('escalations', PAGE_ICONS.escalations);
      html += '<div class="admin-page-card"><div class="admin-page-toolbar">';
      html += '<label class="admin-page-toolbar-label" for="esc-filter">Filter</label>';
      html += '<select id="esc-filter" class="admin-page-select">';
      ['', 'pending', 'in_progress', 'resolved', 'dismissed'].forEach(function(s) {
        var sel = statusFilter === s ? ' selected' : '';
        html += '<option value="' + s + '"' + sel + '>' + (s || 'All statuses') + '</option>';
      });
      html += '</select>';
      html += '<span class="admin-page-meta">' + total + ' escalation' + (total === 1 ? '' : 's') + '</span></div>';
      if (!rows.length) {
        html += '<p class="admin-page-empty">No escalations for this filter.</p>';
      } else {
        html += '<div class="admin-page-table-scroll"><table class="admin-page-table"><thead class="admin-page-thead"><tr>';
        html +=
          '<th class="admin-page-th">Date</th><th class="admin-page-th">User</th><th class="admin-page-th">Preview</th><th class="admin-page-th">Status</th><th class="admin-page-th"><span class="sr-only">Actions</span></th></tr></thead><tbody>';
        rows.forEach(function(e) {
          var who = e.user_name || (e.user_email ? e.user_email : 'Guest');
          html += '<tr class="admin-page-tr">';
          html += '<td class="admin-page-td whitespace-nowrap">' + Utils.formatTime(e.created_at) + '</td>';
          html += '<td class="admin-page-td">' + Utils.escapeHtml(who) + '</td>';
          html += '<td class="admin-page-td max-w-xs truncate">' + Utils.escapeHtml(Utils.truncate(e.message_content || '', 60)) + '</td>';
          html +=
            '<td class="admin-page-td">' + adminEscalationBadge(e.status) + '</td>';
          html +=
            '<td class="admin-page-td"><button type="button" class="admin-page-link admin-esc-open" data-id="' +
            e.id +
            '">View</button></td></tr>';
        });
        html += '</tbody></table></div>';
      }
      html += '</div></div>';
      main.innerHTML = html;
      var selEl = document.getElementById('esc-filter');
      if (selEl) selEl.addEventListener('change', function() { loadEscalations(selEl.value || null); });
      main.querySelectorAll('.admin-esc-open').forEach(function(btn) {
        btn.addEventListener('click', function() { openEscalationDetail(btn.getAttribute('data-id')); });
      });
      adminFetch('/stats').then(function(s) { escBadge(s.pending_escalations || 0); }).catch(function() {});
    }).catch(function() { main.innerHTML = adminPageFail('Failed to load escalations.'); });
  }

  function openEscalationDetail(id) {
    adminFetch('/escalations/' + id).then(function(d) {
      var esc = d.escalation;
      var msgs = d.messages || [];
      var who = esc.full_name || esc.email || (esc.guest_token ? 'Guest' : 'Unknown user');
      var html = '<div class="admin-modal-body">';
      html += '<dl class="admin-modal-meta-grid">';
      html += '<div><dt>Status</dt><dd>' + adminEscalationBadge(esc.status) + '</dd></div>';
      html += '<div><dt>User</dt><dd>' + Utils.escapeHtml(who) + '</dd></div>';
      html += '<div class="admin-modal-meta-grid__full"><dt>Chat</dt><dd>' + Utils.escapeHtml(esc.chat_title || 'Conversation') + '</dd></div>';
      html += '<div class="admin-modal-meta-grid__full"><dt>Reason</dt><dd>' + Utils.escapeHtml(esc.reason || '—') + '</dd></div>';
      if (esc.admin_response) {
        html +=
          '<div class="admin-modal-meta-grid__full"><dt>Staff response</dt><dd class="whitespace-pre-wrap">' +
          Utils.escapeHtml(esc.admin_response) +
          '</dd></div>';
      }
      html += '</dl>';
      html += '<div class="max-h-[50vh] overflow-y-auto thin-scroll flex flex-col gap-2">';
      msgs.forEach(function(m) {
        var hl = m.id === esc.message_id ? ' admin-modal-msg--highlight' : '';
        html += '<div class="admin-modal-msg' + hl + '">';
        html += '<span class="admin-modal-msg__role">' + Utils.escapeHtml(m.role) + '</span>';
        html +=
          '<div class="admin-modal-msg__body">' +
          (m.role === 'assistant' ? Utils.renderMarkdown(m.content || '') : Utils.escapeHtml(m.content || '')) +
          '</div>';
        if (m.image_url) {
          html +=
            '<img src="' +
            Utils.escapeHtml(m.image_url) +
            '" class="mt-2 max-h-40 rounded cursor-pointer" onclick="Utils.openLightbox(this.src)">';
        }
        html += '</div>';
      });
      html += '</div>';
      html += '<div class="admin-page-field"><label class="admin-page-label" for="esc-admin-note">Admin response</label>';
      html +=
        '<textarea id="esc-admin-note" rows="3" class="admin-page-textarea" placeholder="Reply to send when resolving…"></textarea></div>';
      html += '<div class="admin-modal-actions">';
      html +=
        '<button type="button" class="admin-page-btn admin-esc-patch" data-id="' +
        id +
        '" data-status="in_progress">In progress</button>';
      html +=
        '<button type="button" class="admin-page-btn admin-esc-patch" data-id="' +
        id +
        '" data-status="dismissed">Dismiss</button>';
      html +=
        '<button type="button" class="admin-page-btn admin-page-btn--primary admin-esc-patch" data-id="' +
        id +
        '" data-status="resolved">Resolve with response</button>';
      html += '</div></div>';
      openModal('Escalation', html);
      document.querySelectorAll('.admin-esc-patch').forEach(function(b) {
        b.addEventListener('click', function() {
          var st = b.getAttribute('data-status');
          var note = document.getElementById('esc-admin-note');
          var body = { status: st };
          if (note && note.value.trim()) body.admin_response = note.value.trim();
          adminFetch('/escalations/' + b.getAttribute('data-id'), { method: 'PATCH', body: body }).then(function() {
            Utils.showToast('Updated', 'success');
            closeModal();
            loadEscalations(null);
          }).catch(function(e) { Utils.showToast(e.message || 'Failed', 'error'); });
        });
      });
    }).catch(function() { Utils.showToast('Failed to load escalation details', 'error'); });
  }

  function loadUnresolved() {
    var main = document.getElementById('admin-main');
    adminFetch('/unresolved?limit=100').then(function(d) {
      var items = d.items || [];
      var html = '<div class="admin-page-wrap">' + adminPageHead('unresolved', PAGE_ICONS.unresolved);
      html += '<div class="admin-page-card"><p class="admin-page-hint">Assistant messages with low confidence or hedge phrases.</p>';
      if (!items.length) {
        html += '<p class="admin-page-empty">No unresolved items detected.</p>';
      } else {
        html += '<div class="admin-page-table-scroll"><table class="admin-page-table"><thead class="admin-page-thead"><tr>';
        html +=
          '<th class="admin-page-th">When</th><th class="admin-page-th">User</th><th class="admin-page-th">Excerpt</th><th class="admin-page-th">Conf</th><th class="admin-page-th">Actions</th></tr></thead><tbody>';
        items.forEach(function(m) {
          var who = m.full_name || m.email || 'Guest';
          html += '<tr class="admin-page-tr">';
          html += '<td class="admin-page-td whitespace-nowrap">' + Utils.formatTime(m.created_at) + '</td>';
          html += '<td class="admin-page-td">' + Utils.escapeHtml(who) + '</td>';
          html +=
            '<td class="admin-page-td max-w-md truncate">' + Utils.escapeHtml(Utils.truncate(m.content || '', 100)) + '</td>';
          html += '<td class="admin-page-td">' + (m.confidence_score != null ? m.confidence_score.toFixed(2) : '—') + '</td>';
          html += '<td class="admin-page-td space-x-2 whitespace-nowrap">';
          html +=
            '<button type="button" class="admin-page-link admin-open-chat" data-id="' + m.chat_id + '">Chat</button>';
          html +=
            '<button type="button" class="text-xs text-gray-600 dark:text-gray-400 admin-unres-dismiss" data-mid="' +
            m.id +
            '">Dismiss</button>';
          html +=
            '<button type="button" class="text-xs text-mak-red admin-unres-esc" data-mid="' +
            m.id +
            '">Escalate</button></td></tr>';
        });
        html += '</tbody></table></div>';
      }
      html += '</div></div>';
      main.innerHTML = html;
      main.querySelectorAll('.admin-open-chat').forEach(function(btn) {
        btn.addEventListener('click', function() { openConversationModal(btn.getAttribute('data-id')); });
      });
      main.querySelectorAll('.admin-unres-dismiss').forEach(function(btn) {
        btn.addEventListener('click', function() {
          adminFetch('/unresolved/' + btn.getAttribute('data-mid'), { method: 'PATCH', body: { action: 'dismiss' } }).then(
            function() {
              Utils.showToast('Dismissed', 'success');
              loadUnresolved();
            }
          ).catch(function(e) { Utils.showToast(e.message || 'Failed', 'error'); });
        });
      });
      main.querySelectorAll('.admin-unres-esc').forEach(function(btn) {
        btn.addEventListener('click', function() {
          adminFetch('/unresolved/' + btn.getAttribute('data-mid'), { method: 'PATCH', body: { action: 'escalate' } }).then(
            function() {
              Utils.showToast('Escalation created', 'success');
              loadUnresolved();
            }
          ).catch(function(e) { Utils.showToast(e.message || 'Failed', 'error'); });
        });
      });
    }).catch(function() { main.innerHTML = adminPageFail('Failed to load unresolved items.'); });
  }

  function adminUsersBadgeRole(role) {
    var r = String(role || 'student').toLowerCase();
    if (r === 'admin') return adminPageBadge('Admin', 'success');
    return adminPageBadge('Student', 'neutral');
  }

  function adminUsersBadgeVerified(ok) {
    if (ok) {
      return (
        '<span class="admin-page-badge admin-page-badge--success">' +
        '<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M4.5 12.75 9 17.25 19.5 6.75"/></svg>Verified</span>'
      );
    }
    return adminPageBadge('Pending', 'warning');
  }

  function loadUsers() {
    var main = document.getElementById('admin-main');
    main.innerHTML = adminPageLoading();

    var qs =
      '?page=' +
      adminUsersPager.page +
      '&limit=' +
      adminUsersPager.limit +
      (adminUsersPager.q ? '&q=' + encodeURIComponent(adminUsersPager.q) : '');

    adminFetch('/users' + qs)
      .then(function(d) {
        var rows = d.users || [];
        var total = typeof d.total === 'number' ? d.total : 0;
        var page = d.page || 1;
        var limit = d.limit || adminUsersPager.limit;
        var sum = d.summary || {};
        var totalPages = Math.max(1, Math.ceil(total / limit));
        var fromIx = total ? (page - 1) * limit + 1 : 0;
        var toIx = Math.min(page * limit, total);

        var html = '<div class="admin-users">';

        html += '<div class="admin-page-hero-card">';
        html += '<div class="admin-page-hero-card__top">';
        html += '<div class="admin-page-hero-card__main">';
        html += '<span class="admin-page-section-icon admin-page-section-icon--hero shrink-0" aria-hidden="true">' + PAGE_ICONS.users + '</span>';
        html += '<div class="min-w-0">';
        html += '<p class="admin-kb-eyebrow">Directory</p>';
        html += '<h2 class="admin-page-section-title" style="font-size:1.25rem">Registered users</h2>';
        html +=
          '<p class="admin-page-section-sub">Everyone who signed up for AskMak. Search by name or email; open a row for chats and memories.</p>';
        html += '</div></div>';
        html += '<div class="admin-page-hero-stat" title="Total registered accounts">';
        html += '<span class="admin-page-hero-stat__value">' + String(sum.total_registered != null ? sum.total_registered : total) + '</span>';
        html += '<span class="admin-page-hero-stat__label">accounts</span></div></div>';

        html += '<div class="admin-page-stat-grid">';
        var statCards = [
          { label: 'Verified email', val: sum.verified },
          { label: 'Awaiting verify', val: sum.pending_verification },
          { label: 'Administrators', val: sum.admins },
          { label: 'This page', val: rows.length, accent: true }
        ];
        statCards.forEach(function(sc) {
          html +=
            '<div class="admin-page-stat' +
            (sc.accent ? ' admin-page-stat--accent' : '') +
            '"><p class="admin-page-stat__label">' +
            Utils.escapeHtml(sc.label) +
            '</p><p class="admin-page-stat__value">' +
            Utils.escapeHtml(String(sc.val != null ? sc.val : '—')) +
            '</p></div>';
        });
        html += '</div></div>';

        html += '<div class="admin-page-search-row">';
        html += '<label class="sr-only" for="admin-users-search">Search users</label>';
        html += '<div class="relative admin-page-search-field">';
        html +=
          '<span class="admin-page-search-icon" aria-hidden="true"><svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="m21 21-4.35-4.35M11 19a8 8 0 1 1 0-16 8 8 0 0 1 0 16Z"/></svg></span>';
        html +=
          '<input id="admin-users-search" type="search" autocomplete="off" placeholder="Search name or email…" value="' +
          Utils.escapeHtml(adminUsersPager.q) +
          '" class="admin-users-input"></div>';
        html += '<button type="button" id="admin-users-search-btn" class="admin-page-btn admin-page-btn--primary">Search</button>';
        html += '</div>';

        var tableBarMeta = '';
        if (adminUsersPager.q) {
          tableBarMeta =
            Utils.escapeHtml(String(total)) +
            ' match' +
            (total === 1 ? '' : 'es') +
            (total ? ' · rows ' + fromIx + '–' + toIx : '');
        } else {
          tableBarMeta = total ? 'Rows ' + fromIx + '–' + toIx + ' · ' + total + ' on file' : 'No accounts yet';
        }
        html += '<p class="admin-page-meta">' + tableBarMeta + '</p>';

        html += '<div class="admin-page-card">';
        html += '<div class="admin-page-table-scroll">';
        html += '<table class="admin-page-table"><thead class="admin-page-thead"><tr>';
        html +=
          '<th class="admin-page-th">Member</th><th class="admin-page-th">Email</th><th class="admin-page-th">Role</th><th class="admin-page-th">Status</th><th class="admin-page-th">Joined</th><th class="admin-page-th">Last active</th><th class="admin-page-th text-right">Chats</th><th class="admin-page-th"><span class="sr-only">Actions</span></th></tr></thead><tbody>';

        if (!rows.length) {
          html +=
            '<tr><td colspan="8"><p class="admin-page-empty">' +
            (adminUsersPager.q
              ? 'No users match <strong>' + Utils.escapeHtml(adminUsersPager.q) + '</strong>. Try another search.'
              : 'No registered users yet. New signups will appear here.') +
            '</p></td></tr>';
        } else {
          rows.forEach(function(u) {
            html += '<tr class="admin-page-tr admin-users-table-row">';
            html += '<td class="admin-page-td font-semibold">' + Utils.escapeHtml(u.full_name || '—') + '</td>';
            html +=
              '<td class="admin-page-td max-w-[14rem] truncate" title="' +
              Utils.escapeHtml(u.email || '') +
              '">' +
              Utils.escapeHtml(u.email || '') +
              '</td>';
            html += '<td class="admin-page-td">' + adminUsersBadgeRole(u.role) + '</td>';
            html += '<td class="admin-page-td">' + adminUsersBadgeVerified(u.email_verified) + '</td>';
            html += '<td class="admin-page-td whitespace-nowrap">' + Utils.escapeHtml(Utils.formatTime(u.created_at)) + '</td>';
            html +=
              '<td class="admin-page-td whitespace-nowrap">' +
              (u.last_active ? Utils.escapeHtml(Utils.formatTime(u.last_active)) : '—') +
              '</td>';
            html += '<td class="admin-page-td text-right tabular-nums font-semibold">' + String(u.chat_count != null ? u.chat_count : 0) + '</td>';
            html += '<td class="admin-page-td text-right whitespace-nowrap">';
            html +=
              '<button type="button" class="admin-page-btn admin-user-open" data-id="' +
              u.id +
              '">View</button> ';
            if (u.role !== 'admin') {
              html +=
                '<button type="button" class="admin-page-btn admin-page-btn--danger admin-user-del" data-id="' +
                u.id +
                '">Delete</button>';
            }
            html += '</td></tr>';
          });
        }
        html += '</tbody></table></div></div>';

        if (total > limit || page > 1) {
          html += '<div class="admin-page-pagination">';
          html +=
            '<p class="admin-page-pagination__info">Page <strong>' +
            page +
            '</strong> of <strong>' +
            totalPages +
            '</strong></p>';
          html += '<div class="admin-page-pagination__actions">';
          html +=
            '<button type="button" id="admin-users-prev" class="admin-page-btn"' +
            (page <= 1 ? ' disabled' : '') +
            '>Previous</button>';
          html +=
            '<button type="button" id="admin-users-next" class="admin-page-btn"' +
            (page >= totalPages ? ' disabled' : '') +
            '>Next</button>';
          html += '</div></div>';
        }

        html += '</div>';
        main.innerHTML = html;

        var searchIn = document.getElementById('admin-users-search');
        function runSearch() {
          adminUsersPager.q = searchIn ? String(searchIn.value || '').trim() : '';
          adminUsersPager.page = 1;
          loadUsers();
        }
        var sb = document.getElementById('admin-users-search-btn');
        if (sb) sb.addEventListener('click', runSearch);
        if (searchIn) {
          searchIn.addEventListener('keydown', function(ev) {
            if (ev.key === 'Enter') {
              ev.preventDefault();
              runSearch();
            }
          });
        }

        var prev = document.getElementById('admin-users-prev');
        if (prev)
          prev.addEventListener('click', function() {
            if (adminUsersPager.page > 1) {
              adminUsersPager.page--;
              loadUsers();
            }
          });
        var next = document.getElementById('admin-users-next');
        if (next)
          next.addEventListener('click', function() {
            adminUsersPager.page++;
            loadUsers();
          });

        main.querySelectorAll('.admin-user-open').forEach(function(btn) {
          btn.addEventListener('click', function() {
            adminFetch('/users/' + btn.getAttribute('data-id')).then(function(ud) {
              var u = ud.user;
              var chats = ud.chats || [];
              var memN = (ud.memories || []).length;
              var fb = ud.feedback || {};
              var mh = '<div class="space-y-4 text-mak-dark dark:text-gray-100">';
              mh +=
                '<div><p class="text-lg font-semibold">' +
                Utils.escapeHtml(u.full_name || '') +
                '</p><p class="text-sm text-mak-green font-medium">' +
                Utils.escapeHtml(u.email || '') +
                '</p></div>';
              mh +=
                '<div class="flex flex-wrap gap-2">' +
                adminUsersBadgeRole(u.role) +
                ' ' +
                adminUsersBadgeVerified(u.email_verified) +
                '</div>';
              mh +=
                '<dl class="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs border border-gray-200 dark:border-gray-700 rounded-xl p-3 bg-gray-50/80 dark:bg-gray-950/40">';
              mh +=
                '<div><dt class="text-gray-500 dark:text-gray-400 uppercase tracking-wide font-semibold">Joined</dt><dd class="font-medium">' +
                Utils.escapeHtml(Utils.formatTime(u.created_at)) +
                '</dd></div>';
              mh +=
                '<div><dt class="text-gray-500 dark:text-gray-400 uppercase tracking-wide font-semibold">Saved memories</dt><dd class="font-medium">' +
                String(memN) +
                '</dd></div>';
              mh +=
                '<div><dt class="text-gray-500 dark:text-gray-400 uppercase tracking-wide font-semibold">Chats (loaded)</dt><dd class="font-medium">' +
                String(chats.length) +
                ' recent</dd></div>';
              mh +=
                '<div><dt class="text-gray-500 dark:text-gray-400 uppercase tracking-wide font-semibold">Feedback</dt><dd class="font-medium">' +
                (fb.up || 0) +
                ' up · ' +
                (fb.down || 0) +
                ' down</dd></div></dl>';
              if (chats.length) {
                mh += '<div><p class="text-[11px] font-semibold uppercase tracking-wide text-gray-500 mb-2">Recent chats</p><ul class="space-y-1.5 max-h-40 overflow-y-auto thin-scroll text-xs">';
                chats.slice(0, 12).forEach(function(ch) {
                  mh +=
                    '<li class="flex justify-between gap-2 border-b border-gray-100 dark:border-gray-800 pb-1">' +
                    '<span class="truncate">' +
                    Utils.escapeHtml(ch.title || 'Chat') +
                    '</span>' +
                    '<span class="shrink-0 text-gray-400">' +
                    Utils.escapeHtml(Utils.formatTime(ch.updated_at)) +
                    '</span></li>';
                });
                mh += '</ul></div>';
              }
              mh += '</div>';
              openModal('User profile', mh);
            });
          });
        });
        main.querySelectorAll('.admin-user-del').forEach(function(btn) {
          btn.addEventListener('click', function() {
            if (!confirm('Delete this user? This removes their chats and linked data.')) return;
            adminFetch('/users/' + btn.getAttribute('data-id'), { method: 'DELETE' }).then(function() {
              Utils.showToast('Deleted', 'success');
              var tp = typeof total === 'number' ? total : 0;
              if (tp > 1 && rows.length === 1 && adminUsersPager.page > 1) adminUsersPager.page--;
              loadUsers();
            }).catch(function(e) { Utils.showToast(e.message || 'Failed', 'error'); });
          });
        });
      })
      .catch(function() {
        main.innerHTML = adminPageFail('Could not load users. Check network and permissions, then reopen this section.');
      });
  }

  function loadConversations() {
    var main = document.getElementById('admin-main');
    adminFetch('/conversations?limit=50').then(function(d) {
      var rows = d.conversations || [];
      var html = '<div class="admin-page-wrap">' + adminPageHead('conversations', PAGE_ICONS.conversations);
      html += '<div class="admin-page-card">';
      if (!rows.length) {
        html += '<p class="admin-page-empty">No conversations yet.</p>';
      } else {
        html += '<div class="admin-page-table-scroll"><table class="admin-page-table"><thead class="admin-page-thead"><tr>';
        html +=
          '<th class="admin-page-th">Updated</th><th class="admin-page-th">Title</th><th class="admin-page-th">Who</th><th class="admin-page-th">Msgs</th><th class="admin-page-th"><span class="sr-only">Actions</span></th></tr></thead><tbody>';
        rows.forEach(function(c) {
          var who = c.user_id ? (c.full_name || c.email || 'User') : 'Guest';
          html += '<tr class="admin-page-tr">';
          html += '<td class="admin-page-td whitespace-nowrap">' + Utils.formatTime(c.updated_at) + '</td>';
          html += '<td class="admin-page-td">' + Utils.escapeHtml(c.title || '') + '</td>';
          html += '<td class="admin-page-td">' + Utils.escapeHtml(who) + '</td>';
          html += '<td class="admin-page-td">' + (c.message_count || 0) + '</td>';
          html +=
            '<td class="admin-page-td"><button type="button" class="admin-page-link admin-open-chat" data-id="' +
            c.id +
            '">View</button></td></tr>';
        });
        html += '</tbody></table></div>';
      }
      html += '</div></div>';
      main.innerHTML = html;
      main.querySelectorAll('.admin-open-chat').forEach(function(btn) {
        btn.addEventListener('click', function() { openConversationModal(btn.getAttribute('data-id')); });
      });
    }).catch(function() { main.innerHTML = adminPageFail('Failed to load conversations.'); });
  }

  function loadFeedback() {
    var main = document.getElementById('admin-main');
    adminFetch('/feedback?limit=100').then(function(d) {
      var rows = d.feedback || [];
      var html = '<div class="admin-page-wrap">' + adminPageHead('feedback', PAGE_ICONS.feedback);
      html += '<div class="admin-page-card"><div class="admin-page-toolbar admin-page-toolbar--end">';
      html +=
        '<button type="button" id="fb-export" class="admin-page-btn-icon">' +
        PAGE_ICONS.exportCsv +
        'Download CSV</button></div>';
      if (!rows.length) {
        html += '<p class="admin-page-empty">No feedback recorded yet.</p>';
      } else {
        html += '<div class="admin-page-table-scroll"><table class="admin-page-table"><thead class="admin-page-thead"><tr>';
        html +=
          '<th class="admin-page-th">Date</th><th class="admin-page-th">Rating</th><th class="admin-page-th">Preview</th></tr></thead><tbody>';
        rows.forEach(function(f) {
          html += '<tr class="admin-page-tr">';
          html += '<td class="admin-page-td whitespace-nowrap">' + Utils.formatTime(f.created_at) + '</td>';
          html +=
            '<td class="admin-page-td">' +
            (f.rating ? adminPageBadge('Positive', 'success') : adminPageBadge('Negative', 'danger')) +
            '</td>';
          html +=
            '<td class="admin-page-td truncate max-w-md">' +
            Utils.escapeHtml(Utils.truncate(f.message_preview || '', 80)) +
            '</td></tr>';
        });
        html += '</tbody></table></div>';
      }
      html += '</div></div>';
      main.innerHTML = html;
      var ex = document.getElementById('fb-export');
      if (ex) ex.addEventListener('click', function() {
        fetch('/api/admin/feedback/export', { credentials: 'include' }).then(function(res) {
          if (!res.ok) throw new Error('Export failed');
          return res.blob();
        }).then(function(blob) {
          var a = document.createElement('a');
          a.href = URL.createObjectURL(blob);
          a.download = 'askmak-feedback.csv';
          a.click();
          URL.revokeObjectURL(a.href);
        }).catch(function() { Utils.showToast('Export failed', 'error'); });
      });
    }).catch(function() { main.innerHTML = adminPageFail('Failed to load feedback.'); });
  }

  function loadDocuments() {
    var main = document.getElementById('admin-main');

    function kbAttrQuotes(s) {
      return Utils.escapeHtml(String(s)).replace(/"/g, '&quot;');
    }

    function loadKbWithQuery(searchQuery) {
      var qTrim = typeof searchQuery === 'string' ? searchQuery.trim() : '';
      adminFetch('/documents?limit=50&q=' + encodeURIComponent(qTrim)).then(function(d) {
      var rows = d.documents || [];
      var totalKb = typeof d.total === 'number' ? d.total : rows.length;
      var listLimit = typeof d.limit === 'number' ? d.limit : 50;
      var tableCaption =
        totalKb > rows.length
          ? 'Showing ' + rows.length + ' of ' + totalKb + ' chunks'
          : rows.length === 1
            ? '1 chunk in the index'
            : rows.length + ' chunks in the index';

      var html = '<div class="admin-kb">';
      html += '<header class="admin-kb-hero">';
      html += '<div class="admin-kb-hero__main">';
      html += '<p class="admin-kb-eyebrow">Retrieval &amp; answers</p>';
      html += '<h2 class="admin-kb-title">Knowledge base</h2>';
      html +=
        '<p class="admin-kb-lede">Add text entries or upload PDFs. Content is chunked, embedded with OpenAI, and matched when users ask questions.</p>';
      html += '</div>';
      html += '<div class="admin-kb-hero__stat" title="Total chunks in the database">';
      html += '<span class="admin-kb-hero__stat-value">' + totalKb + '</span>';
      html += '<span class="admin-kb-hero__stat-label">indexed chunk' + (totalKb === 1 ? '' : 's') + '</span>';
      html += '</div></header>';

      html += semanticIndexIngestPanelsHtml('docidx-');

      html += '<div class="admin-kb-tips" role="note">';
      html += '<span class="admin-kb-tips__icon" aria-hidden="true">';
      html +=
        '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.75"><path stroke-linecap="round" stroke-linejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 0 1 1.063.852l-.708 2.836a.75.75 0 0 0 1.063.853l.041-.021M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9-3.75h.008v.008H12V8.25Z"/></svg>';
      html += '</span>';
      html += '<ul class="admin-kb-tips__list">';
      html += '<li>Embedding can take a few seconds; wait for the confirmation toast.</li>';
      html +=
        '<li>Manual and PDF chunks show <strong>Edit</strong>. FAQ chunks (<code class="text-xs">kb-entry://</code>) are managed from the Knowledge Base page—delete only here.</li>';
      html += '<li>Crawled pages are delete-only here.</li>';
      html += '<li>Large PDFs create many rows—delete one part at a time, or rely on ingestion for bulk refresh.</li>';
      html += '</ul></div>';

      html += '<section class="admin-kb-index admin-kb-section" aria-labelledby="admin-kb-index-heading">';
      html += '<div class="admin-kb-index__head">';
      html += '<div><h3 id="admin-kb-index-heading" class="admin-kb-index__title">Indexed chunks</h3>';
      html += '<p class="admin-kb-index__meta">Up to ' + listLimit + ' newest · ' + Utils.escapeHtml(tableCaption) + '</p></div>';
      html += '</div>';
      html += '<div class="admin-kb-index__toolbar" role="search">';
      html += '<span id="admin-kb-search-desc" class="admin-kb-index__toolbar-label">Find in index</span>';
      html += '<div class="admin-kb-search-field">';
      html +=
        '<input id="admin-kb-search" type="search" class="admin-kb-search-input" placeholder="Title or chunk text…" autocomplete="off" aria-describedby="admin-kb-search-desc" value="' +
        kbAttrQuotes(qTrim) +
        '"></div>';
      html += '<button type="button" id="admin-kb-search-go" class="admin-kb-search-go">Search</button>';
      html += '</div>';
      html += '<div class="admin-kb-table-scroll thin-scroll">';
      html += '<table class="admin-kb-table"><thead><tr>';
      html += '<th class="admin-kb-th admin-kb-col-title">Title</th>';
      html += '<th class="admin-kb-th admin-kb-col-preview">Preview</th>';
      html += '<th class="admin-kb-th admin-kb-col-cat">Category</th>';
      html += '<th class="admin-kb-th admin-kb-col-src">Source</th>';
      html += '<th class="admin-kb-th admin-kb-col-actions"><span class="sr-only">Actions</span></th></tr></thead><tbody>';

      if (!rows.length) {
        var emptyMsg =
          qTrim
            ? 'No chunks match your search. Try another keyword or clear the filter.'
            : 'No chunks yet. Add a manual entry or upload a PDF to get started.';
        html += '<tr><td colspan="5"><div class="admin-kb-empty">' + emptyMsg + '</div></td></tr>';
      } else {
        rows.forEach(function(r) {
          var rawTitle = String(r.title || '');
          var rawCat = String(r.category || '');
          var rawSrc = String(r.source_url || '');
          var prev = String(r.content_preview || '').trim();
          var titleHtml = Utils.escapeHtml(rawTitle);
          var catHtml = Utils.escapeHtml(rawCat);
          var srcHtml = Utils.escapeHtml(rawSrc);
          var previewHtml = prev ? Utils.escapeHtml(Utils.truncate(prev, 140)) : '<span class="admin-kb-preview-placeholder">—</span>';
          var titleAttr = titleHtml.replace(/"/g, '&quot;');
          var catAttr = catHtml.replace(/"/g, '&quot;');
          var srcAttr = srcHtml.replace(/"/g, '&quot;');
          var srcPlain = rawSrc;
          var isKbEntryChunk = rawSrc.indexOf('kb-entry://') === 0;
          var canEdit =
            !isKbEntryChunk &&
            ((r.metadata && r.metadata.manual) ||
              (rawSrc && (srcPlain.indexOf('manual://') === 0 || srcPlain.indexOf('manual-pdf://') === 0)));
          html += '<tr class="admin-kb-tr">';
          html += '<td class="admin-kb-td admin-kb-col-title"><span class="admin-kb-ellipsis" title="' + titleAttr + '">' + titleHtml + '</span></td>';
          html +=
            '<td class="admin-kb-td admin-kb-col-preview"><span class="admin-kb-preview-snippet admin-kb-ellipsis" title="' +
            kbAttrQuotes(prev) +
            '">' +
            previewHtml +
            '</span></td>';
          html +=
            '<td class="admin-kb-td admin-kb-col-cat"><span class="admin-kb-pill" title="' + catAttr + '">' +
            (catHtml || '—') +
            '</span></td>';
          html += '<td class="admin-kb-td admin-kb-col-src"><span class="admin-kb-ellipsis admin-kb-mono" title="' + srcAttr + '">' + srcHtml + '</span></td>';
          html += '<td class="admin-kb-td admin-kb-col-actions"><div class="admin-kb-row-actions">';
          if (canEdit) {
            html +=
              '<button type="button" class="admin-kb-iconbtn admin-kb-iconbtn--edit admin-doc-edit" data-id="' +
              Utils.escapeHtml(String(r.id)) +
              '">Edit</button>';
          }
          html +=
        '<button type="button" class="admin-kb-iconbtn admin-kb-iconbtn--danger admin-doc-del" data-id="' +
            Utils.escapeHtml(String(r.id)) +
            '">Delete</button>';
          html += '</div></td></tr>';
        });
      }

      html += '</tbody></table></div></section></div>';
      main.innerHTML = html;

      bindSemanticIndexIngest('docidx-', function() { loadKbWithQuery(qTrim); });

      function runKbSearch() {
        var inp = document.getElementById('admin-kb-search');
        loadKbWithQuery(inp ? inp.value : '');
      }

      document.getElementById('admin-kb-search-go').addEventListener('click', runKbSearch);
      var searchEl = document.getElementById('admin-kb-search');
      if (searchEl) {
        searchEl.addEventListener('keydown', function(e) {
          if (e.key === 'Enter') { e.preventDefault(); runKbSearch(); }
        });
      }

      main.querySelectorAll('.admin-doc-edit').forEach(function(btn) {
        btn.addEventListener('click', function() {
          var id = btn.getAttribute('data-id');
          adminFetch('/documents/' + id).then(function(d) {
            var doc = d.document;
            var mh = '<div class="admin-kb-form-stack text-sm">';
            mh += '<div class="admin-kb-field"><label class="admin-kb-label" for="edit-doc-title">Title</label>';
            mh +=
              '<input id="edit-doc-title" type="text" class="admin-kb-input" value="' +
              Utils.escapeHtml(doc.title || '') +
              '"></div>';
            mh += '<div class="admin-kb-field"><label class="admin-kb-label" for="edit-doc-cat">Category</label>';
            mh +=
              '<input id="edit-doc-cat" type="text" class="admin-kb-input" value="' +
              Utils.escapeHtml(doc.category || '') +
              '"></div>';
            mh += '<div class="admin-kb-field"><label class="admin-kb-label" for="edit-doc-body">Content</label>';
            mh +=
              '<textarea id="edit-doc-body" rows="12" class="admin-kb-textarea">' +
              Utils.escapeHtml(doc.content || '') +
              '</textarea></div>';
            mh += '<button type="button" id="edit-doc-save" class="admin-kb-btn admin-kb-btn--primary">Save &amp; re-embed</button></div>';
            openModal('Edit document', mh);
            document.getElementById('edit-doc-save').addEventListener('click', function() {
              var body = {
                title: document.getElementById('edit-doc-title').value.trim(),
                content: document.getElementById('edit-doc-body').value.trim(),
                category: document.getElementById('edit-doc-cat').value.trim() || 'faq'
              };
              if (!body.title || !body.content) { Utils.showToast('Title and content required', 'error'); return; }
              adminFetch('/documents/' + id, { method: 'PUT', body: body }).then(function() {
                Utils.showToast('Updated', 'success');
                closeModal();
                loadDocuments();
              }).catch(function(e) { Utils.showToast(e.message || 'Failed', 'error'); });
            });
          }).catch(function() { Utils.showToast('Failed to load', 'error'); });
        });
      });
      main.querySelectorAll('.admin-doc-del').forEach(function(btn) {
        btn.addEventListener('click', function() {
          if (!confirm('Delete this chunk?')) return;
          adminFetch('/documents/' + btn.getAttribute('data-id'), { method: 'DELETE' }).then(function() {
            loadKbWithQuery(qTrim);
          });
        });
      });
      }).catch(function() { main.innerHTML = adminPageFail('Failed to load documents.'); });
    }

    loadKbWithQuery('');
  }

  function loadReference() {
    var main = document.getElementById('admin-main');
    adminFetch('/reference-images').then(function(d) {
      var imgs = d.images || [];
      var html = '<div class="admin-page-wrap">' + adminPageHead('reference', PAGE_ICONS.reference);
      html += '<div class="admin-page-card">';
      html += '<form id="ref-form" class="admin-ref-form">';
      html +=
        '<div class="admin-ref-field"><label for="ref-file-in">Image</label><input id="ref-file-in" type="file" name="image" accept="image/*" required class="block text-sm max-w-[14rem]"></div>';
      html +=
        '<div class="admin-ref-field"><label for="ref-cat-in">Category</label><input id="ref-cat-in" name="category" value="maps" class="w-28"></div>';
      html +=
        '<div class="admin-ref-field"><label for="ref-name-in">Name</label><input id="ref-name-in" name="name" placeholder="campus_map" class="w-36"></div>';
      html += '<button type="submit" class="admin-ref-submit">' + PAGE_ICONS.upload + 'Upload</button></form>';
      if (!imgs.length) {
        html += '<p class="admin-page-empty">No reference images yet.</p>';
      } else {
        html += '<div class="admin-ref-grid">';
        imgs.forEach(function(im) {
          html += '<article class="admin-ref-tile">';
          if (im.url) {
          html +=
            '<img src="' +
            Utils.escapeHtml(im.url) +
            '" alt="" onclick="Utils.openLightbox(this.src)">';
          }
          html += '<div class="admin-ref-tile__body">';
          html +=
            '<span class="admin-ref-tile__title" title="' +
            Utils.escapeHtml(im.key) +
            '">' +
            Utils.escapeHtml(im.display_name || im.key) +
            '</span>';
          html += '<div class="admin-ref-tile__actions">';
          html +=
            '<button type="button" class="admin-page-link admin-ref-edit" data-key="' +
            Utils.escapeHtml(im.key) +
            '">Edit meta</button>';
          html +=
            '<button type="button" class="admin-page-link admin-ref-del" style="color:#b91c1c" data-key="' +
            Utils.escapeHtml(im.key) +
            '">Delete</button></div></div></article>';
        });
        html += '</div>';
      }
      html += '</div></div>';
      main.innerHTML = html;
      var form = document.getElementById('ref-form');
      if (form) form.addEventListener('submit', function(ev) {
        ev.preventDefault();
        var fd = new FormData(form);
        fetch('/api/admin/reference-images', { method: 'POST', body: fd, credentials: 'include' }).then(function(res) {
          if (!res.ok) return res.json().then(function(j) { throw new Error(j.error); });
          return res.json();
        }).then(function() { Utils.showToast('Uploaded', 'success'); loadReference(); })
          .catch(function(e) { Utils.showToast(e.message || 'Failed', 'error'); });
      });
      main.querySelectorAll('.admin-ref-edit').forEach(function(btn) {
        btn.addEventListener('click', function() {
          var key = btn.getAttribute('data-key');
          var im = imgs.filter(function(x) { return x.key === key; })[0] || {};
          var tagsStr = Array.isArray(im.tags) ? im.tags.join(', ') : (im.tags ? String(im.tags) : '');
          var mh = '<div class="admin-modal-body"><p class="admin-page-meta break-all">' + Utils.escapeHtml(key) + '</p>';
          mh += '<div class="admin-page-field"><label class="admin-page-label" for="ref-meta-name">Display name</label>';
          mh += '<input id="ref-meta-name" class="admin-page-input" value="' + Utils.escapeHtml(im.display_name || '') + '"></div>';
          mh += '<div class="admin-page-field"><label class="admin-page-label" for="ref-meta-cat">Category</label>';
          mh += '<input id="ref-meta-cat" class="admin-page-input" value="' + Utils.escapeHtml(im.category || '') + '"></div>';
          mh += '<div class="admin-page-field"><label class="admin-page-label" for="ref-meta-desc">Description</label>';
          mh += '<textarea id="ref-meta-desc" rows="3" class="admin-page-textarea">' + Utils.escapeHtml(im.description || '') + '</textarea></div>';
          mh += '<div class="admin-page-field"><label class="admin-page-label" for="ref-meta-tags">Tags (comma-separated)</label>';
          mh += '<input id="ref-meta-tags" class="admin-page-input" value="' + Utils.escapeHtml(tagsStr) + '"></div>';
          mh += '<div class="admin-modal-actions"><button type="button" id="ref-meta-save" class="admin-page-btn admin-page-btn--primary">Save metadata</button></div></div>';
          openModal('Reference image', mh);
          document.getElementById('ref-meta-save').addEventListener('click', function() {
            var rawTags = document.getElementById('ref-meta-tags').value.split(',').map(function(t) { return t.trim(); }).filter(Boolean);
            adminFetch('/reference-images/' + encodeURIComponent(key), {
              method: 'PUT',
              body: {
                display_name: document.getElementById('ref-meta-name').value.trim() || null,
                category: document.getElementById('ref-meta-cat').value.trim() || null,
                description: document.getElementById('ref-meta-desc').value.trim() || null,
                tags: rawTags
              }
            }).then(function() {
              Utils.showToast('Saved', 'success');
              closeModal();
              loadReference();
            }).catch(function(e) { Utils.showToast(e.message || 'Failed', 'error'); });
          });
        });
      });
      main.querySelectorAll('.admin-ref-del').forEach(function(btn) {
        btn.addEventListener('click', function() {
          var key = btn.getAttribute('data-key');
          if (!confirm('Delete?')) return;
          adminFetch('/reference-images/' + encodeURIComponent(key), { method: 'DELETE' }).then(function() { loadReference(); });
        });
      });
    }).catch(function() { main.innerHTML = adminPageFail('Failed to load reference images.'); });
  }

  function loadIngest() {
    var main = document.getElementById('admin-main');

    function statusClass(st) {
      var s = String(st || '').toLowerCase();
      if (s === 'completed' || s === 'complete' || s === 'done') return 'admin-ingest-status--done';
      if (s === 'started' || s === 'running') return 'admin-ingest-status--run';
      return 'admin-ingest-status--muted';
    }

    function formatStatsSnippet(stats) {
      if (stats == null) return '';
      var o = stats;
      if (typeof stats === 'string') {
        try { o = JSON.parse(stats); } catch (e) { return ''; }
      }
      if (typeof o !== 'object' || o === null) return '';
      var parts = [];
      if (o.chunksCreated != null) parts.push(Utils.escapeHtml(String(o.chunksCreated)) + ' chunks');
      if (o.errors != null && Number(o.errors) > 0) parts.push(Utils.escapeHtml(String(o.errors)) + ' err.');
      return parts.length ? '<span class="admin-ingest-dates">' + parts.join(' · ') + '</span>' : '';
    }

    adminFetch('/ingest/status').then(function(d) {
      var chunks = d.document_chunks != null ? d.document_chunks : 0;
      var runs = d.runs || [];

      var html = '<div class="admin-ingest">';
      html += '<header class="admin-ingest-hero">';
      html += '<div class="admin-ingest-hero__main">';
      html += '<p class="admin-ingest-kicker">Pipeline</p>';
      html += '<h2 class="admin-ingest-title">Web &amp; file ingestion</h2>';
      html +=
        '<p class="admin-ingest-lede">Runs the full crawler and embedding script in the background. Expect several minutes and OpenAI embedding usage.</p>';
      html += '</div>';
      html += '<div class="admin-ingest-actions">';
      html +=
        '<div class="admin-ingest-stat-card" title="Document chunks stored for retrieval">';
      html += '<span class="admin-ingest-stat-value">' + chunks + '</span>';
      html += '<span class="admin-ingest-stat-label">chunks in DB</span></div>';
      html += '</div>';
      html += '</header>';

      html += '<section class="admin-ingest-panel" aria-labelledby="admin-ingest-start-heading">';
      html += '<h3 id="admin-ingest-start-heading" class="admin-ingest-panel-title">Bulk refresh</h3>';
      html += '<p class="admin-ingest-panel-sub">Start a new run. Recent activity appears below.</p>';
      html += '<div class="flex flex-wrap items-center gap-3">';
      html += '<button type="button" id="btn-ingest" class="admin-ingest-btn">Start ingestion</button>';
      html += '<span class="admin-ingest-hint">Uses ingest.js · status rows update after the script finishes.</span>';
      html += '</div></section>';

      html += '<section class="admin-ingest-panel" aria-labelledby="admin-ingest-runs-heading">';
      html += '<h3 id="admin-ingest-runs-heading" class="admin-ingest-panel-title">Recent runs</h3>';
      html += '<p class="admin-ingest-panel-sub">Newest first (last ' + Utils.escapeHtml(String(runs.length)) + ')</p>';

      if (!runs.length) {
        html += '<p class="admin-ingest-empty">No ingestion history yet.</p>';
      } else {
        html += '<div role="list">';
        runs.forEach(function(r) {
          var badgeClass = statusClass(r.status);
          var src = Utils.escapeHtml(String(r.source || '—'));
          var stDisp = Utils.escapeHtml(String(r.status || ''));
          var started = Utils.formatDate(r.started_at);
          var finished =
            r.finished_at ?
              Utils.formatDate(r.finished_at) :
              null;
          var timeLine =
            Utils.escapeHtml(started) + (finished ? ' → ' + Utils.escapeHtml(finished) : '');
          html += '<div class="admin-ingest-row" role="listitem">';
          html += '<span class="admin-ingest-row-time">' + timeLine + '</span>';
          html += '<span class="admin-ingest-status ' + badgeClass + '">' + stDisp + '</span>';
          html += '<span class="admin-ingest-row-main">' + src + '</span>';
          html += formatStatsSnippet(r.stats);
          html += '</div>';
        });
        html += '</div>';
      }
      html += '</section></div>';

      main.innerHTML = html;

      document.getElementById('btn-ingest').addEventListener('click', function() {
        var b = document.getElementById('btn-ingest');
        b.disabled = true;
        adminFetch('/ingest', { method: 'POST', body: { source: 'all' } })
          .then(function() {
            Utils.showToast('Ingestion started in background', 'success');
            loadIngest();
          })
          .catch(function(e) {
            Utils.showToast(e.message || 'Failed', 'error');
          })
          .finally(function() {
            var btn = document.getElementById('btn-ingest');
            if (btn) btn.disabled = false;
          });
      });
    }).catch(function() { main.innerHTML = adminPageFail('Failed to load ingestion status.'); });
  }

  function loadSettings() {
    var main = document.getElementById('admin-main');
    adminFetch('/settings').then(function(d) {
      var s = d.settings || {};
      function pickStr(v) { return v == null ? '' : String(v); }
      function pickNum(v, def) {
        if (v == null || v === '') return def;
        if (typeof v === 'number' && !isNaN(v)) return Math.round(v);
        var n = parseInt(String(v), 10);
        return isNaN(n) ? def : n;
      }
      function pickFloat(v, def) {
        if (v == null || v === '') return def;
        if (typeof v === 'number' && !isNaN(v)) return v;
        var f = parseFloat(String(v));
        return isNaN(f) ? def : f;
      }
      function pickBool(v, def) {
        if (v === true || v === 'true') return true;
        if (v === false || v === 'false') return false;
        return def;
      }

      var prompt = pickStr(s.system_prompt);
      var guestRate = pickNum(s.guest_rate_limit, 20);
      var authRate = pickNum(s.auth_rate_limit, 100);
      var confidence = pickFloat(s.confidence_escalation_threshold, 0.65);
      var maxTool = pickNum(s.max_tool_depth, 3);
      var guestRetention = pickNum(s.guest_chat_retention_days, 30);
      var guestEnabled = pickBool(s.guest_mode_enabled, true);
      var domains = pickStr(s.allowed_fetch_domains) || '*.mak.ac.ug';

      var schemaMissing = !!(d.note && String(d.note).indexOf('admin_schema') >= 0);

      var html = '<div class="admin-page-wrap admin-settings">';
      html += '<div class="admin-settings-hero"><div>';
      html += '<h2>Platform settings</h2>';
      html += '<p>Configure prompts, safeguards, guest access, and tool limits stored in your database.</p>';
      if (schemaMissing) {
        html += '<p class="admin-settings-warning">' + Utils.escapeHtml(d.note || '') + '</p>';
      }
      html += '</div><span class="admin-settings-badge">Admin</span></div>';

      html += '<div class="admin-settings-grid">';
      html += '<section class="admin-settings-card admin-settings-card--full">';
      html += '<h3>Assistant persona</h3>';
      html += '<div class="admin-settings-field"><label for="set-prompt">System prompt</label>';
      html +=
        '<textarea id="set-prompt" class="admin-settings-textarea admin-settings-textarea--prompt" rows="6">' +
        Utils.escapeHtml(prompt) +
        '</textarea>';
      html += '<p class="admin-settings-hint">Base instructions injected for every AskMak reply. Tone, scope (Makerere-only), escalation rules, etc.</p></div></section>';

      html += '<section class="admin-settings-card">';
      html += '<h3>Message rate limits</h3>';
      html += '<div class="admin-settings-row admin-settings-row--2">';
      html += '<div class="admin-settings-field"><label for="set-guest">Guest messages per hour</label>';
      html += '<input id="set-guest" type="number" min="1" max="9999" class="admin-settings-input" value="' + guestRate + '">';
      html += '<p class="admin-settings-hint">Per guest token / session cap before slowdown.</p></div>';
      html += '<div class="admin-settings-field"><label for="set-auth">Signed-in messages per hour</label>';
      html += '<input id="set-auth" type="number" min="1" max="9999" class="admin-settings-input" value="' + authRate + '">';
      html += '<p class="admin-settings-hint">Per authenticated user.</p></div></div></section>';

      html += '<section class="admin-settings-card">';
      html += '<h3>Quality & tooling</h3>';
      html += '<div class="admin-settings-field"><label for="set-confidence">Escalation confidence threshold</label>';
      html += '<input id="set-confidence" type="number" min="0" max="1" step="0.01" class="admin-settings-input" value="' + confidence + '">';
      html += '<p class="admin-settings-hint">0–1. Below this retrieval confidence suggests staff review / escalation workflows.</p></div>';
      html += '<div class="admin-settings-field"><label for="set-max-tool">Max tool recursion depth</label>';
      html += '<input id="set-max-tool" type="number" min="1" max="12" class="admin-settings-input" value="' + maxTool + '">';
      html += '<p class="admin-settings-hint">How deeply chained tool calls may run.</p></div></section>';

      html += '<section class="admin-settings-card">';
      html += '<h3>Guest experience</h3>';
      html += '<label class="admin-settings-check" for="set-guest-enabled">';
      html += '<input type="checkbox" id="set-guest-enabled"' + (guestEnabled ? ' checked' : '') + '>';
      html += '<span><strong>Guest mode</strong> Allow chats without signing in (subject to retention and hourly caps).</span></label>';
      html += '<div class="admin-settings-field admin-settings-field--spaced"><label for="set-guest-retention">Guest chat retention (days)</label>';
      html += '<input id="set-guest-retention" type="number" min="1" max="730" class="admin-settings-input" value="' + guestRetention + '">';
      html += '<p class="admin-settings-hint">How long anonymised guest threads are retained for support.</p></div></section>';

      html += '<section class="admin-settings-card">';
      html += '<h3>Fetching & URLs</h3>';
      html += '<div class="admin-settings-field"><label for="set-domains">Allowed fetch domain pattern</label>';
      html += '<input id="set-domains" type="text" autocomplete="off" class="admin-settings-input" value="' + Utils.escapeHtml(domains) + '" placeholder="*.mak.ac.ug">';
      html += '<p class="admin-settings-hint">Wildcard pattern restricting outbound page fetches.</p></div></section>';

      html += '<section class="admin-settings-card admin-settings-card--full admin-settings-card--muted">';
      html += '<h3>Environment (read-only)</h3>';
      html += '<p class="admin-settings-note">API keys and network endpoints are configured in <code>.env</code>; chat models listed here mirror the running server.</p>';
      html += '<dl class="admin-settings-env">';
      html += '<dt>Chat model</dt><dd>' + Utils.escapeHtml(d.openai_model || '—') + '</dd>';
      html += '<dt>Embedding model</dt><dd>' + Utils.escapeHtml(d.embedding_model || '—') + '</dd>';
      html += '</dl></section></div>';

      html += '<div class="admin-settings-actions">';
      html += '<button type="button" id="set-save" class="admin-settings-save">Save all settings</button>';
      html += '<span class="admin-settings-save-hint">Updates apply on the next request.</span></div></div>';

      main.innerHTML = html;

      document.getElementById('set-save').addEventListener('click', function() {
        var gr = parseInt(document.getElementById('set-guest').value, 10);
        var ar = parseInt(document.getElementById('set-auth').value, 10);
        var conf = parseFloat(document.getElementById('set-confidence').value);
        var mtd = parseInt(document.getElementById('set-max-tool').value, 10);
        var gret = parseInt(document.getElementById('set-guest-retention').value, 10);
        if (isNaN(gr) || gr < 1) { Utils.showToast('Guest rate must be ≥ 1', 'error'); return; }
        if (isNaN(ar) || ar < 1) { Utils.showToast('Auth rate must be ≥ 1', 'error'); return; }
        if (isNaN(conf) || conf < 0 || conf > 1) { Utils.showToast('Confidence must be between 0 and 1', 'error'); return; }
        if (isNaN(mtd) || mtd < 1) { Utils.showToast('Tool depth must be ≥ 1', 'error'); return; }
        if (isNaN(gret) || gret < 1) { Utils.showToast('Retention must be ≥ 1 day', 'error'); return; }
        var domVal = document.getElementById('set-domains').value.trim();
        if (!domVal) { Utils.showToast('Domain pattern required', 'error'); return; }
        var payload = {
          system_prompt: document.getElementById('set-prompt').value,
          guest_rate_limit: gr,
          auth_rate_limit: ar,
          confidence_escalation_threshold: conf,
          max_tool_depth: mtd,
          guest_chat_retention_days: gret,
          guest_mode_enabled: document.getElementById('set-guest-enabled').checked,
          allowed_fetch_domains: domVal
        };
        adminFetch('/settings', { method: 'PUT', body: payload }).then(function() {
          Utils.showToast('Saved', 'success');
          loadSettings();
        }).catch(function(e) { Utils.showToast(e.message || 'Failed', 'error'); });
      });
    }).catch(function() { main.innerHTML = adminPageFail('Failed to load settings.'); });
  }

  function loadKb() {
    var main = document.getElementById('admin-main');
    main.innerHTML = adminPageLoading();
    adminFetch('/kb?limit=100').then(function(d) {
      var rows = d.entries || [];
      var html = '<div class="admin-page-wrap">' + adminPageHead('kb', PAGE_ICONS.kb);
      html += '<div class="admin-kb-tips" role="note"><span class="admin-kb-tips__icon" aria-hidden="true">';
      html +=
        '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.75"><path stroke-linecap="round" stroke-linejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 0 1 1.063.852l-.708 2.836a.75.75 0 0 0 1.063.853l.041-.021M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9-3.75h.008v.008H12V8.25Z"/></svg></span>';
      html += '<p class="admin-kb-tips__list" style="margin:0;list-style:none;padding:0">';
      html +=
        '<strong>Text or PDF</strong> below feeds the assistant\'s vector search index. <strong>Curated entries</strong> are the browsable FAQ for students. Open ';
      html +=
        '<button type="button" id="kb-goto-docs" class="admin-page-link">AI Documents</button> to manage indexed chunks.</p></div>';
      html += '<div class="admin-kb">' + semanticIndexIngestPanelsHtml('kbidx-');

      html += '<div class="admin-kb-tips" role="note">';
      html += '<span class="admin-kb-tips__icon" aria-hidden="true">';
      html +=
        '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.75"><path stroke-linecap="round" stroke-linejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 0 1 1.063.852l-.708 2.836a.75.75 0 0 0 1.063.853l.041-.021M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9-3.75h.008v.008H12V8.25Z"/></svg>';
      html += '</span>';
      html += '<ul class="admin-kb-tips__list">';
      html += '<li>PDF uploads: up to 25MB; embeddings may take a few seconds.</li>';
      html +=
        '<li><strong>Published</strong> curated FAQ entries are synced into the assistant search index automatically; drafts are removed from the index until you publish.</li>';
      html += '</ul></div>';

      html += '<section class="admin-page-card" aria-labelledby="admin-kb-faq-heading">';
      html += '<div class="admin-page-toolbar admin-page-toolbar--loose">';
      html += '<div class="admin-page-section-block__text">';
      html += '<h2 id="admin-kb-faq-heading">Curated FAQ entries</h2>';
      html += '<p>Listed for students when they browse the Knowledge Base.</p></div>';
      html += '<button type="button" id="kb-new-btn" class="admin-page-btn admin-page-btn--primary">Add entry</button>';
      html += '</div>';

      if (!rows.length) {
        html += '<p class="admin-page-empty">No curated entries yet. Add one, or feed PDF/text above for indexing only.</p>';
      } else {
        html += '<div class="admin-page-table-scroll"><table class="admin-page-table"><thead class="admin-page-thead"><tr>';
        html += '<th class="admin-page-th">Category</th><th class="admin-page-th">Title</th><th class="admin-page-th">Status</th><th class="admin-page-th"><span class="sr-only">Actions</span></th></tr></thead><tbody>';
        rows.forEach(function(r) {
          var status = r.is_published ? adminPageBadge('Published', 'success') : adminPageBadge('Draft', 'muted');
          html += '<tr class="admin-page-tr">';
          html += '<td class="admin-page-td">' + Utils.escapeHtml(r.category) + '</td>';
          html += '<td class="admin-page-td font-semibold">' + Utils.escapeHtml(r.title) + '</td>';
          html += '<td class="admin-page-td">' + status + '</td>';
          html += '<td class="admin-page-td text-right whitespace-nowrap">';
          html += '<button type="button" class="admin-page-link kb-edit-btn" data-id="' + r.id + '">Edit</button> ';
          html += '<button type="button" class="admin-page-link kb-delete-btn" style="color:#b91c1c" data-id="' + r.id + '">Delete</button>';
          html += '</td></tr>';
        });
        html += '</tbody></table></div>';
      }
      html += '</section></div></div>';

      main.innerHTML = html;

      bindSemanticIndexIngest('kbidx-');

      document.getElementById('kb-goto-docs').addEventListener('click', function() {
        loadSection('documents');
      });
      document.getElementById('kb-new-btn').addEventListener('click', function() { openKbModal(); });
      
      main.querySelectorAll('.kb-edit-btn').forEach(function(btn) {
        btn.addEventListener('click', function() {
          adminFetch('/kb/' + btn.getAttribute('data-id')).then(function(res) {
            openKbModal(res.entry);
          });
        });
      });

      main.querySelectorAll('.kb-delete-btn').forEach(function(btn) {
        btn.addEventListener('click', function() {
          if (confirm('Delete this entry?')) {
            adminFetch('/kb/' + btn.getAttribute('data-id'), { method: 'DELETE' }).then(function() {
              Utils.showToast('Deleted', 'success');
              loadKb();
            });
          }
        });
      });
    }).catch(function(err) {
      var msg =
        err && typeof err.message === 'string' && err.message.trim()
          ? err.message
          : 'Failed to load KB entries (check network or sign in again)';
      main.innerHTML = adminPageFail(msg);
    });
  }

  function openKbModal(entry = null) {
    var isEdit = !!entry;
    var html = '<form id="kb-form" class="admin-modal-body">';
    html += '<div class="admin-page-field"><label class="admin-page-label" for="kbf-category">Category</label>';
    html += '<input type="text" id="kbf-category" class="admin-page-input" value="' + Utils.escapeHtml(entry ? entry.category : '') + '" required></div>';
    html += '<div class="admin-page-field"><label class="admin-page-label" for="kbf-title">Title / Question</label>';
    html += '<input type="text" id="kbf-title" class="admin-page-input" value="' + Utils.escapeHtml(entry ? entry.title : '') + '" required></div>';
    html += '<div class="admin-page-field"><label class="admin-page-label" for="kbf-content">Content / Answer</label>';
    html += '<textarea id="kbf-content" rows="6" class="admin-page-textarea" required>' + Utils.escapeHtml(entry ? entry.content : '') + '</textarea></div>';
    html += '<label class="admin-modal-check" for="kbf-published">';
    html += '<input type="checkbox" id="kbf-published" ' + (!entry || entry.is_published ? 'checked' : '') + '>';
    html += '<span>Published (visible to students and synced to assistant search when published)</span></label>';
    html += '<div class="admin-modal-actions">';
    html += '<button type="button" class="admin-page-btn" onclick="document.getElementById(\'modal-close\').click()">Cancel</button>';
    html += '<button type="submit" class="admin-page-btn admin-page-btn--primary">Save</button></div></form>';
    
    openModal(isEdit ? 'Edit Knowledge Base Entry' : 'New Knowledge Base Entry', html);

    document.getElementById('kb-form').addEventListener('submit', function(e) {
      e.preventDefault();
      var payload = {
        category: document.getElementById('kbf-category').value,
        title: document.getElementById('kbf-title').value,
        content: document.getElementById('kbf-content').value,
        is_published: document.getElementById('kbf-published').checked
      };
      var path = isEdit ? '/kb/' + entry.id : '/kb';
      var method = isEdit ? 'PUT' : 'POST';

      adminFetch(path, { method: method, body: payload })
        .then(function(res) {
          var sync = res && res.index_sync;
          if (sync && sync.ok === false) {
            var detail = sync.error ? String(sync.error) : 'unknown error';
            Utils.showToast('Saved, but assistant index sync failed: ' + detail, 'warning');
          } else {
            Utils.showToast('Saved successfully', 'success');
          }
          closeModal();
          loadKb();
        })
        .catch(function(err) { Utils.showToast(err.message, 'error'); });
    });
  }

  function loadKbTickets(statusFilter = '') {
    var main = document.getElementById('admin-main');
    main.innerHTML = adminPageLoading();
    var qs = '/kb-tickets?limit=50' + (statusFilter ? '&status=' + encodeURIComponent(statusFilter) : '');

    adminFetch(qs).then(function(d) {
      var rows = d.tickets || [];

      var badge = document.getElementById('nav-ticket-count');
      if (badge) {
        if (d.pending_count > 0) {
          badge.textContent = d.pending_count;
          badge.classList.remove('hidden');
        } else {
          badge.classList.add('hidden');
        }
      }

      var html = '<div class="admin-page-wrap">' + adminPageHead('kb-tickets', PAGE_ICONS.tickets);
      html += '<div class="admin-page-card"><div class="admin-page-toolbar admin-page-toolbar--loose">';
      html += '<span class="admin-page-toolbar-label">Show</span>';
      html +=
        '<select id="kbt-filter" class="admin-page-select"><option value="">All tickets</option><option value="pending"' +
        (statusFilter === 'pending' ? ' selected' : '') +
        '>Pending</option><option value="resolved"' +
        (statusFilter === 'resolved' ? ' selected' : '') +
        '>Resolved</option></select></div>';

      if (!rows.length) {
        html += '<p class="admin-page-empty">No support tickets found for this filter.</p>';
      } else {
        html += '<div class="admin-page-table-scroll"><table class="admin-page-table"><thead class="admin-page-thead"><tr>';
        html +=
          '<th class="admin-page-th">Date</th><th class="admin-page-th">Student</th><th class="admin-page-th">Category</th><th class="admin-page-th">Question</th><th class="admin-page-th">Status</th><th class="admin-page-th"><span class="sr-only">Actions</span></th></tr></thead><tbody>';

        rows.forEach(function(r) {
          var statusHtml =
            r.status === 'pending' ? adminPageBadge('Pending', 'warning') : adminPageBadge('Resolved', 'success');
          html += '<tr class="admin-page-tr">';
          html += '<td class="admin-page-td whitespace-nowrap">' + Utils.formatTime(r.created_at) + '</td>';
          html += '<td class="admin-page-td">' + Utils.escapeHtml(r.student_email) + '</td>';
          html += '<td class="admin-page-td">' + Utils.escapeHtml(r.category) + '</td>';
          html += '<td class="admin-page-td font-semibold truncate max-w-xs">' + Utils.escapeHtml(r.title) + '</td>';
          html += '<td class="admin-page-td">' + statusHtml + '</td>';
          html +=
            '<td class="admin-page-td text-right"><button type="button" class="admin-page-link kbt-view-btn" data-id="' +
            r.id +
            '">Review</button></td></tr>';
        });
        html += '</tbody></table></div>';
      }
      html += '</div></div>';
      main.innerHTML = html;

      document.getElementById('kbt-filter').addEventListener('change', function(e) {
        loadKbTickets(e.target.value);
      });

      main.querySelectorAll('.kbt-view-btn').forEach(function(btn) {
        btn.addEventListener('click', function() {
          adminFetch('/kb-tickets/' + btn.getAttribute('data-id')).then(function(res) {
            openTicketModal(res.ticket);
          });
        });
      });
    }).catch(function() { main.innerHTML = adminPageFail('Failed to load support tickets.'); });
  }

  function openTicketModal(t) {
    var isPending = t.status === 'pending';
    var html = '<div class="admin-modal-body">';

    html += '<dl class="admin-modal-meta-grid">';
    html += '<div><dt>Student</dt><dd>' + Utils.escapeHtml(t.student_email) + '</dd></div>';
    html += '<div><dt>Category</dt><dd>' + Utils.escapeHtml(t.category) + '</dd></div>';
    html += '<div class="admin-modal-meta-grid__full"><dt>Question</dt><dd>' + Utils.escapeHtml(t.title) + '</dd></div>';
    html += '</dl>';

    if (isPending) {
      html += '<form id="ticket-resolve-form" class="admin-modal-body" style="padding:0">';
      html += '<div class="admin-page-field"><label class="admin-page-label" for="kbt-response">Your answer</label>';
      html += '<p class="admin-page-meta" style="margin:0 0 0.35rem">This will be emailed to the student.</p>';
      html +=
        '<textarea id="kbt-response" rows="6" class="admin-page-textarea" placeholder="Type the answer here…" required></textarea></div>';
      html += '<label class="admin-modal-check" for="kbt-save-kb">';
      html += '<input type="checkbox" id="kbt-save-kb" checked>';
      html += '<span>Also publish this answer to the public FAQ Knowledge Base</span></label>';
      html += '<div class="admin-modal-actions">';
      html +=
        '<button type="submit" class="admin-page-btn admin-page-btn--primary">Resolve &amp; email student</button></div></form>';
    } else {
      html += '<div class="admin-page-field"><span class="admin-page-label">Admin answer (sent to student)</span>';
      html += '<div class="admin-modal-msg admin-modal-msg__body whitespace-pre-wrap">' + Utils.escapeHtml(t.admin_response) + '</div></div>';
    }

    html += '</div>';
    openModal('Ticket Details', html);

    if (isPending) {
      document.getElementById('ticket-resolve-form').addEventListener('submit', function(e) {
        e.preventDefault();
        var btn = this.querySelector('button[type="submit"]');
        btn.disabled = true;
        btn.textContent = 'Sending...';

        var payload = {
          admin_response: document.getElementById('kbt-response').value,
          save_as_kb_entry: document.getElementById('kbt-save-kb').checked
        };
        
        adminFetch('/kb-tickets/' + t.id, { method: 'PATCH', body: payload }).then(function(res) {
          if (res.email_sent) Utils.showToast('Resolved and email sent to student', 'success');
          else Utils.showToast('Resolved, but email delivery skipped/failed', 'warning');
          
          if (res.kb_entry_id) Utils.showToast('Added to public FAQ', 'success');
          if (res.index_sync && res.index_sync.ok === false) {
            var d = res.index_sync.error ? String(res.index_sync.error) : 'unknown error';
            Utils.showToast('FAQ saved, but assistant index sync failed: ' + d, 'warning');
          }
          
          closeModal();
          loadKbTickets('pending');
        }).catch(function(err) { 
          Utils.showToast(err.message, 'error'); 
          btn.disabled = false;
          btn.textContent = 'Resolve & Email Student';
        });
      });
    }
  }

  /** Collapse fixed admin nav when a section is chosen on narrow viewports (lg breakpoint). */
  function closeMobileAdminSidebar() {
    if (
      typeof window.matchMedia === 'undefined' ||
      !window.matchMedia('(max-width: 1023px)').matches
    ) {
      return;
    }
    var sidebar = document.getElementById('admin-sidebar');
    var overlay = document.getElementById('sidebar-overlay');
    if (sidebar) {
      sidebar.classList.add('admin-sidebar-mobile-hidden');
      sidebar.setAttribute('aria-hidden', 'true');
    }
    if (overlay) overlay.classList.add('hidden');
  }

  function openMobileAdminSidebar() {
    if (
      typeof window.matchMedia !== 'undefined' &&
      !window.matchMedia('(max-width: 1023px)').matches
    ) {
      return;
    }
    var sidebar = document.getElementById('admin-sidebar');
    var overlay = document.getElementById('sidebar-overlay');
    if (sidebar) {
      sidebar.classList.remove('admin-sidebar-mobile-hidden');
      sidebar.setAttribute('aria-hidden', 'false');
    }
    if (overlay) overlay.classList.remove('hidden');
  }

  function loadSection(name) {
    closeMobileAdminSidebar();
    setActiveNav(name);
    destroyCharts();
    var mainEl = document.getElementById('admin-main');
    if (mainEl) {
      if (name === 'overview') mainEl.classList.add('admin-main--dashboard');
      else mainEl.classList.remove('admin-main--dashboard');
    }
    if (name === 'overview') loadOverview();
    else if (name === 'escalations') loadEscalations(null);
    else if (name === 'unresolved') loadUnresolved();
    else if (name === 'users') loadUsers();
    else if (name === 'conversations') loadConversations();
    else if (name === 'feedback') loadFeedback();
    else if (name === 'documents') loadDocuments();
    else if (name === 'kb') loadKb();
    else if (name === 'kb-tickets') loadKbTickets();
    else if (name === 'reference') loadReference();
    else if (name === 'ingest') loadIngest();
    else if (name === 'settings') loadSettings();
  }


  function poll() {
    adminFetch('/stats').then(function(s) { escBadge(s.pending_escalations || 0); }).catch(function() {});
  }

  function init() {
    fetch('/api/auth/me', { credentials: 'include' }).then(function(r) {
      if (!r.ok) { window.location.href = '/login'; return; }
      return r.json();
    }).then(function(data) {
      if (
        !data ||
        !data.user ||
        String(data.user.role || '')
          .trim()
          .toLowerCase() !== 'admin'
      ) {
        window.location.href = '/';
        return;
      }
      var displayName = data.user.full_name || data.user.email || 'Admin';
      document.getElementById('admin-user-label').textContent = displayName;
      var av = document.getElementById('admin-user-avatar');
      if (av) av.textContent = (displayName.trim().charAt(0) || '?').toUpperCase();
      var asideEl = document.getElementById('admin-sidebar');
      if (
        asideEl &&
        typeof window.matchMedia !== 'undefined' &&
        window.matchMedia('(min-width: 1024px)').matches
      ) {
        asideEl.setAttribute('aria-hidden', 'false');
      }
      document.querySelectorAll('.admin-nav').forEach(function(btn) {
        btn.addEventListener('click', function() { loadSection(btn.getAttribute('data-section')); });
      });
      var loSide = document.getElementById('admin-logout-sidebar');
      if (loSide) {
        loSide.addEventListener('click', function() {
          fetch('/api/auth/logout', { method: 'POST', credentials: 'include' }).then(function() {
            window.location.href = '/';
          });
        });
      }
      document.getElementById('modal-close').addEventListener('click', closeModal);
      document.getElementById('admin-modal').addEventListener('click', function(e) { if (e.target.id === 'admin-modal') closeModal(); });
      document.getElementById('sidebar-open').addEventListener('click', openMobileAdminSidebar);
      document.getElementById('sidebar-close').addEventListener('click', closeMobileAdminSidebar);
      document.getElementById('sidebar-overlay').addEventListener('click', closeMobileAdminSidebar);
      var tt = document.getElementById('theme-toggle-admin');
      if (tt) tt.addEventListener('click', function() { Theme.toggle(); });
      ['mousemove', 'keydown', 'click'].forEach(function(ev) {
        document.addEventListener(ev, touch, true);
      });
      setInterval(function() {
        if (Date.now() - lastActivity > INACTIVITY_MS) {
          fetch('/api/auth/logout', { method: 'POST', credentials: 'include' }).finally(function() {
            window.location.href = '/login';
          });
        }
      }, 60000);
      pollTimer = setInterval(poll, 60000);
      loadSection('overview');
    }).catch(function() { window.location.href = '/login'; });
  }

  document.addEventListener('DOMContentLoaded', init);
})();
