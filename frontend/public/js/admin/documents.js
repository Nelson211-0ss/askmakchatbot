(function() {
    function loadDocuments() {
      var main = document.getElementById('admin-main');

      function kbAttrQuotes(s) {
        return Utils.escapeHtml(String(s)).replace(/"/g, '&quot;');
      }

      function loadKbWithQuery(searchQuery) {
        var qTrim = typeof searchQuery === 'string' ? searchQuery.trim() : '';
        AdminCore.adminFetch('/documents?limit=50&q=' + encodeURIComponent(qTrim)).then(function(d) {
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

        html += AdminCore.semanticIndexIngestPanelsHtml('docidx-');

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

        AdminCore.bindSemanticIndexIngest('docidx-', function() { loadKbWithQuery(qTrim); });

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
            AdminCore.adminFetch('/documents/' + id).then(function(d) {
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
              AdminCore.openModal('Edit document', mh);
              document.getElementById('edit-doc-save').addEventListener('click', function() {
                var body = {
                  title: document.getElementById('edit-doc-title').value.trim(),
                  content: document.getElementById('edit-doc-body').value.trim(),
                  category: document.getElementById('edit-doc-cat').value.trim() || 'faq'
                };
                if (!body.title || !body.content) { Utils.showToast('Title and content required', 'error'); return; }
                AdminCore.adminFetch('/documents/' + id, { method: 'PUT', body: body }).then(function() {
                  Utils.showToast('Updated', 'success');
                  AdminCore.closeModal();
                  loadDocuments();
                }).catch(function(e) { Utils.showToast(e.message || 'Failed', 'error'); });
              });
            }).catch(function() { Utils.showToast('Failed to load', 'error'); });
          });
        });
        main.querySelectorAll('.admin-doc-del').forEach(function(btn) {
          btn.addEventListener('click', function() {
            if (!confirm('Delete this chunk?')) return;
            AdminCore.adminFetch('/documents/' + btn.getAttribute('data-id'), { method: 'DELETE' }).then(function() {
              loadKbWithQuery(qTrim);
            });
          });
        });
        }).catch(function() { main.innerHTML = AdminCore.adminPageFail('Failed to load documents.'); });
      }

      loadKbWithQuery('');
    }

  AdminCore.sections['documents'] = loadDocuments;
})();
