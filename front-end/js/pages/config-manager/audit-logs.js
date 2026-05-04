initLayout('Audit Logs');

/* ── Helpers ─────────────────────────────────────── */
function escLog(str) {
  return String(str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function formatLogTime(ts) {
  if (!ts) return '—';
  const d = new Date(ts);
  if (isNaN(d.getTime())) return String(ts);
  return d.toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' });
}

function getSeverity(action) {
  const a = String(action || '').toLowerCase();
  if (a.includes('delete') || a.includes('reject') || a.includes('flagg')) return 'High';
  if (a.includes('update') || a.includes('return') || a.includes('escalat')) return 'Medium';
  return 'Low';
}

function severityBadge(sev) {
  const map = {
    High:   { bg:'#EF444420', color:'#EF4444', border:'#EF4444' },
    Medium: { bg:'#F59E0B20', color:'#F59E0B', border:'#F59E0B' },
    Low:    { bg:'#10B98120', color:'#10B981', border:'#10B981' }
  };
  const s = map[sev] || map.Low;
  return `<span class="badge" style="background:${s.bg};color:${s.color};border-color:${s.border}40;">${sev}</span>`;
}

function statusBadge(status) {
  const ok = String(status || 'Success') === 'Success';
  return ok
    ? '<span class="badge" style="background:#10B98120;color:#10B981;border-color:#10B98140;">Success</span>'
    : '<span class="badge" style="background:#EF444420;color:#EF4444;border-color:#EF444440;">Failed</span>';
}

/* ── State ───────────────────────────────────────── */
let allLogs     = [];
let currentPage = 1;
const PAGE_SIZE = 15;
let filterSev   = 'all';
let filterSearch= '';

/* ── Render ──────────────────────────────────────── */
function renderLogs() {
  const query = filterSearch.toLowerCase();
  const filtered = allLogs.filter(log => {
    const sev = getSeverity(log.action);
    const matchSev = filterSev === 'all' || sev === filterSev;
    const matchQ   = !query ||
      String(log.user || '').toLowerCase().includes(query) ||
      String(log.action || '').toLowerCase().includes(query) ||
      String(log.entityType || '').toLowerCase().includes(query) ||
      String(log.entityName || '').toLowerCase().includes(query);
    return matchSev && matchQ;
  });

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  if (currentPage > totalPages) currentPage = 1;

  const start  = (currentPage - 1) * PAGE_SIZE;
  const page   = filtered.slice(start, start + PAGE_SIZE);

  const tbody = document.getElementById('logs-tbody');
  if (!tbody) return;

  tbody.innerHTML = page.map(log => {
    const sev = getSeverity(log.action);
    const resource = [log.entityType, log.entityName].filter(Boolean).join(' • ') || '—';
    return `<tr>
      <td style="color:var(--text-secondary);white-space:nowrap;">${escLog(formatLogTime(log.timestamp))}</td>
      <td style="color:var(--text-primary);font-weight:500;">${escLog(log.user || '—')}</td>
      <td style="color:var(--text-secondary);">${escLog(log.userRole || '—')}</td>
      <td style="color:var(--text-primary);">${escLog(log.action || '—')}</td>
      <td style="color:var(--text-secondary);">${escLog(resource)}</td>
      <td>${severityBadge(sev)}</td>
      <td>${statusBadge(log.status)}</td>
    </tr>`;
  }).join('') || '<tr><td colspan="7" style="text-align:center;color:var(--text-secondary);padding:32px;">No logs match the current filters.</td></tr>';

  // Pagination info
  const info = document.querySelector('.pagination-info');
  if (info) {
    if (filtered.length === 0) {
      info.textContent = 'No logs found';
    } else {
      info.textContent = `Showing ${start + 1}–${Math.min(start + PAGE_SIZE, filtered.length)} of ${filtered.length} logs`;
    }
  }

  // Page buttons
  const prevBtn = document.querySelector('[data-action="prev"]');
  const nextBtn = document.querySelector('[data-action="next"]');
  if (prevBtn) prevBtn.disabled = currentPage <= 1;
  if (nextBtn) nextBtn.disabled = currentPage >= totalPages;

  // Total count badge
  const countBadge = document.getElementById('log-total-count');
  if (countBadge) countBadge.textContent = allLogs.length;
}

/* ── Export ──────────────────────────────────────── */
function exportLogs() {
  const header  = ['Timestamp', 'User', 'Role', 'Action', 'Resource', 'Severity', 'Status'].join('\t');
  const rows    = allLogs.map(log => [
    formatLogTime(log.timestamp),
    log.user || '',
    log.userRole || '',
    log.action || '',
    [log.entityType, log.entityName].filter(Boolean).join(' > '),
    getSeverity(log.action),
    log.status || 'Success'
  ].join('\t'));
  const blob    = new Blob([header + '\n' + rows.join('\n')], { type: 'text/plain' });
  const url     = URL.createObjectURL(blob);
  const a       = document.createElement('a');
  a.href        = url;
  a.download    = `finstack-audit-logs-${new Date().toISOString().slice(0,10)}.txt`;
  a.click();
  URL.revokeObjectURL(url);
}

/* ── Init ────────────────────────────────────────── */
window.FinStackStore.ready.then(() => {
  // Load all logs sorted newest first
  allLogs = (window.FinStackStore.getAuditLogs() || []).slice().reverse();

  renderLogs();

  // Search
  const searchEl = document.getElementById('log-search');
  if (searchEl) {
    searchEl.addEventListener('input', () => {
      filterSearch = searchEl.value.trim();
      currentPage  = 1;
      renderLogs();
    });
  }

  // Severity filter
  const sevEl = document.getElementById('log-severity-filter');
  if (sevEl) {
    sevEl.addEventListener('change', () => {
      filterSev   = sevEl.value;
      currentPage = 1;
      renderLogs();
    });
  }

  // Pagination
  document.querySelector('[data-action="prev"]')?.addEventListener('click', () => {
    if (currentPage > 1) { currentPage--; renderLogs(); }
  });
  document.querySelector('[data-action="next"]')?.addEventListener('click', () => {
    currentPage++; renderLogs();
  });

  // Export button
  document.getElementById('export-logs-btn')?.addEventListener('click', exportLogs);

  // Refresh button
  document.getElementById('refresh-logs-btn')?.addEventListener('click', () => {
    allLogs = (window.FinStackStore.getAuditLogs() || []).slice().reverse();
    currentPage = 1;
    renderLogs();
  });
});