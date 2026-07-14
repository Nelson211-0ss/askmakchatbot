(function() {
    var BAR_HOUR_PALETTE = [
      '#006b3c', '#0d9488', '#d97706', '#6366f1', '#db2777', '#0891b2', '#7c3aed', '#eab308',
      '#059669', '#f97316', '#8b5cf6', '#0ea5e9', '#e11d48', '#64748b', '#84cc16'
    ];

    var PERF_DONUT_COLORS = ['#006b3c', '#a855f7', '#3b82f6', '#ea580c', '#9333ea', '#0d9488', '#ca8a04'];

    /** Line / accent — Makerere institutional green */
    var DASH_ACCENT = '#006b3c';

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

    function loadOverview() {
      AdminCore.destroyCharts();
      var main = document.getElementById('admin-main');
      var cc = chartColors();
      main.innerHTML = '<div class="text-slate-500 dark:text-slate-400 text-sm py-8 text-center">Loading…</div>';
      Promise.all([
        AdminCore.adminFetch('/stats'),
        AdminCore.adminFetch('/stats/timeseries?days=30'),
        AdminCore.adminFetch('/stats/topics?days=90'),
        AdminCore.adminFetch('/activity/recent?limit=20')
      ]).then(function(results) {
        var s = results[0];
        var ts = fillTimeseries(results[1].points || [], 30);
        var perfRaw = results[2].segments || [];
        var topicsDays = results[2].days != null ? results[2].days : 90;
        var activity = results[3].chats || [];
        var trends = s.trends || {};

        AdminCore.escBadge(s.pending_escalations || 0);

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
            AdminCore.loadSection('conversations');
          });
        }
        main.querySelectorAll('[data-quick-section]').forEach(function(btn) {
          btn.addEventListener('click', function() {
            AdminCore.loadSection(btn.getAttribute('data-quick-section'));
          });
        });

        var labels = ts.map(function(p) {
          return overviewChartLabel(p.d);
        });
        var data = ts.map(function(p) {
          return p.c;
        });

        AdminCore.charts.conv = new Chart(document.getElementById('chart-conv'), {
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

        AdminCore.charts.perf = new Chart(document.getElementById('chart-perf'), {
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
            AdminCore.openConversationModal(btn.getAttribute('data-id'));
          });
        });
      }).catch(function() {
        if (main) main.classList.remove('admin-main--dashboard');
        main.innerHTML =
          '<p class="text-red-600 dark:text-red-400 font-medium">Failed to load overview</p>';
      });
    }

  AdminCore.sections['overview'] = loadOverview;
})();
