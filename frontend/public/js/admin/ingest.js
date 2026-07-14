(function() {
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

      AdminCore.adminFetch('/ingest/status').then(function(d) {
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
          AdminCore.adminFetch('/ingest', { method: 'POST', body: { source: 'all' } })
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
      }).catch(function() { main.innerHTML = AdminCore.adminPageFail('Failed to load ingestion status.'); });
    }

  AdminCore.sections['ingest'] = loadIngest;
})();
