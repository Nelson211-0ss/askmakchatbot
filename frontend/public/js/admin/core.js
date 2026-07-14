var AdminCore = {};

(function() {
    var charts = { conv: null, perf: null, hour: null };

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

    function touch() { AdminCore.lastActivity = Date.now(); }

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

  AdminCore.lastActivity = Date.now();
  AdminCore.sections = {};
  AdminCore.charts = charts;
  AdminCore.SECTION_COPY = SECTION_COPY;
  AdminCore.PAGE_ICONS = PAGE_ICONS;
  AdminCore.adminPageFail = adminPageFail;
  AdminCore.adminPageLoading = adminPageLoading;
  AdminCore.adminPageBadge = adminPageBadge;
  AdminCore.adminPageHead = adminPageHead;
  AdminCore.touch = touch;
  AdminCore.adminFetch = adminFetch;
  AdminCore.semanticIndexIngestPanelsHtml = semanticIndexIngestPanelsHtml;
  AdminCore.bindSemanticIndexIngest = bindSemanticIndexIngest;
  AdminCore.destroyCharts = destroyCharts;
  AdminCore.openModal = openModal;
  AdminCore.closeModal = closeModal;
  AdminCore.escBadge = escBadge;
  AdminCore.openConversationModal = openConversationModal;
})();
