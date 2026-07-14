(function() {
    function loadKbTickets(statusFilter = '') {
      var main = document.getElementById('admin-main');
      main.innerHTML = AdminCore.adminPageLoading();
      var qs = '/kb-tickets?limit=50' + (statusFilter ? '&status=' + encodeURIComponent(statusFilter) : '');

      AdminCore.adminFetch(qs).then(function(d) {
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

        var html = '<div class="admin-page-wrap">' + AdminCore.adminPageHead('kb-tickets', AdminCore.PAGE_ICONS.tickets);
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
              r.status === 'pending' ? AdminCore.adminPageBadge('Pending', 'warning') : AdminCore.adminPageBadge('Resolved', 'success');
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
            AdminCore.adminFetch('/kb-tickets/' + btn.getAttribute('data-id')).then(function(res) {
              openTicketModal(res.ticket);
            });
          });
        });
      }).catch(function() { main.innerHTML = AdminCore.adminPageFail('Failed to load support tickets.'); });
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
      AdminCore.openModal('Ticket Details', html);

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
          
          AdminCore.adminFetch('/kb-tickets/' + t.id, { method: 'PATCH', body: payload }).then(function(res) {
            if (res.email_sent) Utils.showToast('Resolved and email sent to student', 'success');
            else Utils.showToast('Resolved, but email delivery skipped/failed', 'warning');
            
            if (res.kb_entry_id) Utils.showToast('Added to public FAQ', 'success');
            if (res.index_sync && res.index_sync.ok === false) {
              var d = res.index_sync.error ? String(res.index_sync.error) : 'unknown error';
              Utils.showToast('FAQ saved, but assistant index sync failed: ' + d, 'warning');
            }
            
            AdminCore.closeModal();
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

  AdminCore.sections['kb-tickets'] = loadKbTickets;
})();
