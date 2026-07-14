(function() {
    function adminEscalationBadge(status) {
      var s = String(status || '')
        .toLowerCase()
        .replace(/\s+/g, '_');
      var v = 'neutral';
      if (s === 'pending') v = 'warning';
      else if (s === 'resolved') v = 'success';
      else if (s === 'dismissed') v = 'muted';
      return AdminCore.adminPageBadge(String(status || ''), v);
    }

    function loadEscalations(statusFilter) {
      var main = document.getElementById('admin-main');
      main.innerHTML = AdminCore.adminPageLoading();
      var qs = '/escalations?limit=50';
      if (statusFilter) qs += '&status=' + encodeURIComponent(statusFilter);
      AdminCore.adminFetch(qs).then(function(d) {
        var rows = d.escalations || [];
        var total = d.total != null ? d.total : rows.length;
        var html = '<div class="admin-page-wrap">' + AdminCore.adminPageHead('escalations', AdminCore.PAGE_ICONS.escalations);
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
        AdminCore.adminFetch('/stats').then(function(s) { AdminCore.escBadge(s.pending_escalations || 0); }).catch(function() {});
      }).catch(function() { main.innerHTML = AdminCore.adminPageFail('Failed to load escalations.'); });
    }

    function openEscalationDetail(id) {
      AdminCore.adminFetch('/escalations/' + id).then(function(d) {
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
        AdminCore.openModal('Escalation', html);
        document.querySelectorAll('.admin-esc-patch').forEach(function(b) {
          b.addEventListener('click', function() {
            var st = b.getAttribute('data-status');
            var note = document.getElementById('esc-admin-note');
            var body = { status: st };
            if (note && note.value.trim()) body.admin_response = note.value.trim();
            AdminCore.adminFetch('/escalations/' + b.getAttribute('data-id'), { method: 'PATCH', body: body }).then(function() {
              Utils.showToast('Updated', 'success');
              AdminCore.closeModal();
              loadEscalations(null);
            }).catch(function(e) { Utils.showToast(e.message || 'Failed', 'error'); });
          });
        });
      }).catch(function() { Utils.showToast('Failed to load escalation details', 'error'); });
    }

  AdminCore.sections['escalations'] = loadEscalations;
})();
