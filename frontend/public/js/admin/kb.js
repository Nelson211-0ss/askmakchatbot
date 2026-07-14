(function() {
    function loadKb() {
      var main = document.getElementById('admin-main');
      main.innerHTML = AdminCore.adminPageLoading();
      AdminCore.adminFetch('/kb?limit=100').then(function(d) {
        var rows = d.entries || [];
        var html = '<div class="admin-page-wrap">' + AdminCore.adminPageHead('kb', AdminCore.PAGE_ICONS.kb);
        html += '<div class="admin-kb-tips" role="note"><span class="admin-kb-tips__icon" aria-hidden="true">';
        html +=
          '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.75"><path stroke-linecap="round" stroke-linejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 0 1 1.063.852l-.708 2.836a.75.75 0 0 0 1.063.853l.041-.021M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9-3.75h.008v.008H12V8.25Z"/></svg></span>';
        html += '<p class="admin-kb-tips__list" style="margin:0;list-style:none;padding:0">';
        html +=
          '<strong>Text or PDF</strong> below feeds the assistant\'s vector search index. <strong>Curated entries</strong> are the browsable FAQ for students. Open ';
        html +=
          '<button type="button" id="kb-goto-docs" class="admin-page-link">AI Documents</button> to manage indexed chunks.</p></div>';
        html += '<div class="admin-kb">' + AdminCore.semanticIndexIngestPanelsHtml('kbidx-');

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
            var status = r.is_published ? AdminCore.adminPageBadge('Published', 'success') : AdminCore.adminPageBadge('Draft', 'muted');
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

        AdminCore.bindSemanticIndexIngest('kbidx-');

        document.getElementById('kb-goto-docs').addEventListener('click', function() {
          AdminCore.loadSection('documents');
        });
        document.getElementById('kb-new-btn').addEventListener('click', function() { openKbModal(); });
        
        main.querySelectorAll('.kb-edit-btn').forEach(function(btn) {
          btn.addEventListener('click', function() {
            AdminCore.adminFetch('/kb/' + btn.getAttribute('data-id')).then(function(res) {
              openKbModal(res.entry);
            });
          });
        });

        main.querySelectorAll('.kb-delete-btn').forEach(function(btn) {
          btn.addEventListener('click', function() {
            if (confirm('Delete this entry?')) {
              AdminCore.adminFetch('/kb/' + btn.getAttribute('data-id'), { method: 'DELETE' }).then(function() {
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
        main.innerHTML = AdminCore.adminPageFail(msg);
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
      
      AdminCore.openModal(isEdit ? 'Edit Knowledge Base Entry' : 'New Knowledge Base Entry', html);

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

        AdminCore.adminFetch(path, { method: method, body: payload })
          .then(function(res) {
            var sync = res && res.index_sync;
            if (sync && sync.ok === false) {
              var detail = sync.error ? String(sync.error) : 'unknown error';
              Utils.showToast('Saved, but assistant index sync failed: ' + detail, 'warning');
            } else {
              Utils.showToast('Saved successfully', 'success');
            }
            AdminCore.closeModal();
            loadKb();
          })
          .catch(function(err) { Utils.showToast(err.message, 'error'); });
      });
    }

  AdminCore.sections['kb'] = loadKb;
})();
