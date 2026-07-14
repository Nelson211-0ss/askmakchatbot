(function() {
    function loadFeedback() {
      var main = document.getElementById('admin-main');
      AdminCore.adminFetch('/feedback?limit=100').then(function(d) {
        var rows = d.feedback || [];
        var html = '<div class="admin-page-wrap">' + AdminCore.adminPageHead('feedback', AdminCore.PAGE_ICONS.feedback);
        html += '<div class="admin-page-card"><div class="admin-page-toolbar admin-page-toolbar--end">';
        html +=
          '<button type="button" id="fb-export" class="admin-page-btn-icon">' +
          AdminCore.PAGE_ICONS.exportCsv +
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
              (f.rating ? AdminCore.adminPageBadge('Positive', 'success') : AdminCore.adminPageBadge('Negative', 'danger')) +
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
      }).catch(function() { main.innerHTML = AdminCore.adminPageFail('Failed to load feedback.'); });
    }

  AdminCore.sections['feedback'] = loadFeedback;
})();
