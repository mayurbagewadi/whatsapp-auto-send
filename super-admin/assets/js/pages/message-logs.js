/**
 * Message Logs Page
 * View, filter by date, download Excel, delete by date
 */

let logsCurrentPage = 1;
const LOGS_PER_PAGE = 10;
let logsTotalCount  = 0;
let logsSelectedDate = '';
let logsAdminAPI = null;
let logsGroups = [];

export async function initMessageLogs(adminAPI) {
  logsAdminAPI = adminAPI;
  logsSelectedDate = todayDate();
  document.getElementById('logsDatePicker').value = logsSelectedDate;
  await loadLogs();
  setupLogsEventListeners();
}

function todayDate() {
  return new Date().toISOString().split('T')[0];
}

async function loadLogs() {
  showLogsLoading(true);
  const { groups } = await logsAdminAPI.getGroupedMessageLogs(logsSelectedDate);
  logsGroups = groups;
  logsTotalCount = groups.length;
  renderLogs(groups);
  renderLogsPagination();
  document.getElementById('logsTotalCount').textContent = `${groups.length} bulk send(s)`;
  showLogsLoading(false);
}

function renderLogs(groups) {
  const tbody = document.getElementById('logsTableBody');
  if (!groups.length) {
    tbody.innerHTML = `<tr><td colspan="9" class="text-center text-muted" style="padding:32px">No messages found for this date</td></tr>`;
    return;
  }

  tbody.innerHTML = groups.map((group, idx) => {
    const user = group.user || {};
    const msg = group.message ? (group.message.length > 60 ? group.message.substring(0, 60) + '…' : group.message) : '--';
    const dateStr = new Date(group.sent_at).toLocaleDateString('en-GB');
    const statusBadge = group.failedCount > 0
      ? `<span class="badge badge-warning">${group.sentCount} Sent, ${group.failedCount} Failed</span>`
      : `<span class="badge badge-success">${group.sentCount} Sent</span>`;
    return `
      <tr>
        <td>${escHtml(user.company_name || '--')}</td>
        <td>${escHtml(user.email || '--')}</td>
        <td>${escHtml(user.phone || '--')}</td>
        <td style="font-weight:600;">send ${group.recipientCount}</td>
        <td title="${escHtml(group.message || '')}">${escHtml(msg)}</td>
        <td>${statusBadge}</td>
        <td>${dateStr}</td>
        <td style="text-align:center;"><button class="btn-eye" onclick="window.openDetailModal(${idx})">👁️</button></td>
      </tr>`;
  }).join('');
}

function renderLogsPagination() {
  document.getElementById('logsPagination').innerHTML = '';
}

window.openDetailModal = function(idx) {
  const group = logsGroups[idx];
  if (!group) return;

  const modal = document.getElementById('logsDetailModal');
  if (!modal) return;

  const user = group.user || {};
  const dateStr = new Date(group.sent_at).toLocaleDateString('en-GB');
  const timeStr = new Date(group.sent_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });

  let recipientsList = '';
  if (group.recipients && group.recipients.length > 0) {
    recipientsList = group.recipients.map(r => {
      const statusIcon = r.status === 'sent' ? '✓' : '✗';
      return `<tr><td>${r.recipient_phone}</td><td><span class="badge badge-${r.status === 'sent' ? 'success' : 'danger'}">${statusIcon} ${r.status}</span></td><td>${r.error || '--'}</td></tr>`;
    }).join('');
  }

  const html = `
    <div class="modal-content">
      <div class="modal-header">
        <h3 style="font-size:18px;margin:0;color:#25D366;">📨 Bulk Send Details</h3>
        <button class="modal-close" onclick="window.closeLogsDetailModal()">&times;</button>
      </div>
      <div class="modal-body" style="max-height:600px;overflow-y:auto;padding:16px;font-size:13px;">
        <style>
          .modal-body strong { color: #25D366; }
        </style>
        <div style="margin-bottom:16px;">
          <p><strong>User:</strong> ${escHtml(user.email)} (${escHtml(user.phone)})</p>
          <p><strong>Company:</strong> ${escHtml(user.company_name || '--')}</p>
          <p><strong>Sent Date:</strong> ${dateStr}</p>
          <p><strong>Sent Time:</strong> ${timeStr}</p>
        </div>
        <div style="margin-bottom:16px;border-top:1px solid var(--border-color);padding-top:12px;">
          <p><strong>Message:</strong></p>
          <p style="background:var(--bg-secondary);padding:12px;border-radius:4px;">${escHtml(group.message || '--')}</p>
        </div>
        <div style="margin-bottom:16px;border-top:1px solid #ccc;padding-top:12px;">
          <p><strong>Recipients (${group.recipientCount} total):</strong></p>
          <p style="font-size:13px;color:#666;">${group.sentCount} Sent${group.failedCount > 0 ? `, ${group.failedCount} Failed` : ''}</p>
          <div style="overflow-x:auto;">
            <table class="data-table" style="font-size:13px;">
              <thead><tr><th>Phone</th><th>Status</th><th>Error</th></tr></thead>
              <tbody>${recipientsList}</tbody>
            </table>
          </div>
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-secondary" onclick="window.closeLogsDetailModal()">Close</button>
        <button class="btn btn-secondary" onclick="window.downloadBatchCSV(${idx})">⬇ Download CSV</button>
      </div>
    </div>
  `;

  modal.innerHTML = html;
  modal.style.display = 'flex';
};

window.closeLogsDetailModal = function() {
  const modal = document.getElementById('logsDetailModal');
  if (modal) modal.style.display = 'none';
};

window.downloadBatchCSV = function(idx) {
  const group = logsGroups[idx];
  if (!group) return;

  const headers = ['Recipient Phone', 'Status', 'Message', 'Sent Date', 'Sent Time', 'Error'];
  const dateStr = new Date(group.sent_at).toLocaleDateString('en-GB');
  const timeStr = new Date(group.sent_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });

  const rows = group.recipients.map(r => [
    `'${r.recipient_phone}`,
    r.status,
    group.message || '',
    dateStr,
    timeStr,
    r.error || ''
  ].map(v => `"${String(v).replace(/"/g, '""')}"`));

  const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const user = group.user || {};
  const filename = `${dateStr}_batch_${user.email.split('@')[0]}.csv`;

  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
  showLogsMessage(`Downloaded: ${filename}`, 'success');
};

function setupLogsEventListeners() {
  document.getElementById('logsDatePicker').addEventListener('change', async (e) => {
    logsSelectedDate = e.target.value;
    logsCurrentPage  = 1;
    await loadLogs();
  });

  document.getElementById('logsDeleteBtn').addEventListener('click', async () => {
    if (!logsSelectedDate) return;
    if (!confirm(`Delete ALL message logs for ${logsSelectedDate}? This cannot be undone.`)) return;
    const res = await logsAdminAPI.deleteMessageLogsByDate(logsSelectedDate);
    if (res.success) {
      logsCurrentPage = 1;
      await loadLogs();
      showLogsMessage('Logs deleted successfully', 'success');
    } else {
      showLogsMessage('Failed to delete logs', 'error');
    }
  });

  document.getElementById('logsDownloadBtn').addEventListener('click', async () => {
    if (!logsSelectedDate) return;
    showLogsMessage('Preparing download…', 'info');
    const logs = await logsAdminAPI.getAllMessageLogsByDate(logsSelectedDate);
    if (!logs.length) { showLogsMessage('No data for this date', 'info'); return; }
    downloadExcel(logs, logsSelectedDate);
  });
}

function downloadExcel(logs, date) {
  const headers = ['Company', 'User Email', 'User Phone', 'Recipient Phone', 'Message', 'Status', 'Time', 'Error'];
  const rows = logs.map(log => {
    const user = log.users || {};
    return [
      user.company_name || '',
      user.email || '',
      user.phone || '',
      log.recipient_phone,
      log.message || '',
      log.status,
      new Date(log.sent_at).toLocaleString(),
      log.error || ''
    ].map(v => `"${String(v).replace(/"/g, '""')}"`);
  });

  const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url  = URL.createObjectURL(blob);

  const first   = logs[0]?.users || {};
  const company = (first.company_name || 'Unknown').replace(/[^a-zA-Z0-9]/g, '_');
  const email   = (first.email || 'Unknown').split('@')[0].replace(/[^a-zA-Z0-9]/g, '_');
  const filename = `${date}_${company}_${email}.csv`;

  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
  showLogsMessage(`Downloaded: ${filename}`, 'success');
}

function showLogsLoading(show) {
  document.getElementById('logsLoading').style.display = show ? 'block' : 'none';
  document.getElementById('logsTable').style.display   = show ? 'none'  : 'table';
}

function showLogsMessage(msg, type) {
  const el = document.getElementById('logsMessage');
  el.textContent  = msg;
  el.className    = `alert alert-${type === 'success' ? 'success' : type === 'error' ? 'danger' : 'info'}`;
  el.style.display = 'block';
  setTimeout(() => { el.style.display = 'none'; }, 3000);
}

function escHtml(str) {
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/\"/g,'&quot;');
}
