/**
 * Usage Tracking Page
 * Tracks daily/monthly user activity, limits, and generates reports
 */

let usageLogs = [];
let filteredLogs = [];
let currentUsagePage = 1;
const LOGS_PER_PAGE = 25;

export async function initUsage(adminAPI) {
  try {
    // Set default date to today
    const today = new Date().toISOString().split('T')[0];
    const usageDateInput = document.getElementById('usageDate');
    if (usageDateInput) {
      usageDateInput.value = today;
    }

    // Load usage data
    await loadUsageData(adminAPI);

    // Setup event listeners
    setupUsageEventListeners(adminAPI);

  } catch (error) {
    console.error('Usage init error:', error);
    showUsageError('Failed to load usage data');
  }
}

async function loadUsageData(adminAPI) {
  try {
    const events = await adminAPI.request('GET', 'analytics?select=user_id,event_type,created_at&order=created_at.desc&limit=500');
    // Aggregate individual events into counts per user+type+date
    const grouped = {};
    (events || []).forEach(e => {
      const date = e.created_at.split('T')[0];
      const key  = `${e.user_id}|${e.event_type}|${date}`;
      if (!grouped[key]) grouped[key] = { user_id: e.user_id, log_type: e.event_type, log_date: date, count: 0 };
      grouped[key].count++;
    });
    usageLogs = Object.values(grouped);
    filteredLogs = [...usageLogs];
    displayUsageLogs();
    displayUsageSummary();
  } catch (error) {
    console.error('Error loading usage data:', error);
    showUsageError('Failed to load usage logs from database');
  }
}

function displayUsageLogs() {
  const tbody = document.getElementById('usageTableBody');

  if (!filteredLogs || filteredLogs.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" class="text-center text-muted">No usage data found</td></tr>';
    return;
  }

  const startIdx = (currentUsagePage - 1) * LOGS_PER_PAGE;
  const endIdx = startIdx + LOGS_PER_PAGE;
  const pageLogs = filteredLogs.slice(startIdx, endIdx);

  const html = pageLogs.map(log => `
    <tr>
      <td>${log.user_id ? log.user_id.substring(0, 8) + '...' : 'Unknown'}</td>
      <td>
        ${log.log_type === 'message_sent' ? '💬 Messages' :
          log.log_type === 'campaign_created' ? '🚀 Campaigns' :
          log.log_type === 'contact_imported' ? '📇 Contacts' :
          log.log_type === 'template_created' ? '📝 Templates' :
          log.log_type}
      </td>
      <td><strong>${log.count}</strong></td>
      <td>${getLogTypeMax(log.log_type)}</td>
      <td>${formatDate(log.log_date)}</td>
      <td>
        <button class="btn btn-sm" onclick="viewUserUsage('${log.user_id}')">View</button>
      </td>
    </tr>
  `).join('');

  tbody.innerHTML = html;
}

function displayUsageSummary() {
  // Calculate aggregated stats
  if (!usageLogs || usageLogs.length === 0) {
    return;
  }

  const today = new Date().toISOString().split('T')[0];
  const todayLogs = usageLogs.filter(log => log.log_date === today);

  const summary = {
    messages: 0,
    campaigns: 0,
    contacts: 0,
    templates: 0
  };

  todayLogs.forEach(log => {
    if (log.log_type === 'message_sent') summary.messages += log.count;
    if (log.log_type === 'campaign_created') summary.campaigns += log.count;
    if (log.log_type === 'contact_imported') summary.contacts += log.count;
    if (log.log_type === 'template_created') summary.templates += log.count;
  });

  console.log('📊 Today\'s Usage Summary:', summary);
}

function setupUsageEventListeners(adminAPI) {
  // Search users
  document.getElementById('usageUserSearch')?.addEventListener('input', (e) => {
    const query = e.target.value.toLowerCase();
    filteredLogs = usageLogs.filter(log =>
      log.user_id?.toLowerCase().includes(query)
    );
    currentUsagePage = 1;
    displayUsageLogs();
  });

  // Filter by date
  document.getElementById('usageDate')?.addEventListener('change', (e) => {
    const selectedDate = e.target.value;
    filteredLogs = usageLogs.filter(log => log.log_date === selectedDate);
    currentUsagePage = 1;
    displayUsageLogs();
  });

  // Export buttons (add if they exist)
  document.getElementById('exportCSV')?.addEventListener('click', () => {
    exportToCSV();
  });

  document.getElementById('exportJSON')?.addEventListener('click', () => {
    exportToJSON();
  });
}

async function viewUserUsage(userId) {
  try {
    const adminAPI = window.adminAPI;

    // Get all logs for this user
    const userLogs = usageLogs.filter(log => log.user_id === userId);

    if (userLogs.length === 0) {
      alert('No usage data for this user');
      return;
    }

    // Aggregate by log type
    const summary = {};
    userLogs.forEach(log => {
      if (!summary[log.log_type]) {
        summary[log.log_type] = 0;
      }
      summary[log.log_type] += log.count;
    });

    // Build detailed view
    let details = `📊 User Usage Details\n`;
    details += `User ID: ${userId}\n`;
    details += `────────────────────────\n`;
    details += `Total Records: ${userLogs.length}\n\n`;
    details += `📈 Activity Summary:\n`;
    details += `💬 Messages Sent: ${summary.message_sent || 0}\n`;
    details += `🚀 Campaigns: ${summary.campaign_created || 0}\n`;
    details += `📇 Contacts: ${summary.contact_imported || 0}\n`;
    details += `📝 Templates: ${summary.template_created || 0}\n`;

    // Calculate daily average
    const uniqueDays = [...new Set(userLogs.map(l => l.log_date))].length;
    if (uniqueDays > 0) {
      const totalMessages = summary.message_sent || 0;
      const dailyAvg = Math.round(totalMessages / uniqueDays);
      details += `\n📅 Daily Average: ${dailyAvg} messages/day`;
    }

    alert(details);
  } catch (error) {
    console.error('Error viewing user usage:', error);
    showUsageError('Failed to load user usage details');
  }
}

function exportToCSV() {
  if (!filteredLogs || filteredLogs.length === 0) {
    alert('No data to export');
    return;
  }

  // Build CSV header
  const header = ['User ID', 'Log Type', 'Count', 'Date', 'Timestamp'].join(',');

  // Build CSV rows
  const rows = filteredLogs.map(log => [
    log.user_id || 'Unknown',
    log.log_type,
    log.count,
    log.log_date,
    new Date(log.created_at).toISOString()
  ].map(val => `"${val}"`).join(','));

  // Combine
  const csv = [header, ...rows].join('\n');

  // Download
  downloadFile(csv, 'usage_logs.csv', 'text/csv');
  showUsageSuccess(`Exported ${filteredLogs.length} records to CSV`);
}

function exportToJSON() {
  if (!filteredLogs || filteredLogs.length === 0) {
    alert('No data to export');
    return;
  }

  // Create JSON structure
  const data = {
    exportDate: new Date().toISOString(),
    totalRecords: filteredLogs.length,
    logs: filteredLogs.map(log => ({
      userId: log.user_id,
      logType: log.log_type,
      count: log.count,
      date: log.log_date,
      timestamp: log.created_at
    }))
  };

  const json = JSON.stringify(data, null, 2);

  // Download
  downloadFile(json, 'usage_logs.json', 'application/json');
  showUsageSuccess(`Exported ${filteredLogs.length} records to JSON`);
}

function downloadFile(content, filename, mimeType) {
  const blob = new Blob([content], { type: mimeType });
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.URL.revokeObjectURL(url);
}

function getLogTypeMax(logType) {
  // Return max based on plan (this is simplified - in reality would look up user's plan)
  const maxLimits = {
    'message_sent': '5,000',
    'campaign_created': '50',
    'contact_imported': '5,000',
    'template_created': 'Unlimited'
  };
  return maxLimits[logType] || '-';
}

function formatDate(dateString) {
  if (!dateString) return '-';
  const date = new Date(dateString + 'T00:00:00Z');
  return date.toLocaleDateString();
}

function showUsageSuccess(message) {
  console.log('✓ ' + message);
}

function showUsageError(message) {
  console.error('✗ ' + message);
}

// Make functions globally available
window.viewUserUsage = viewUserUsage;
window.exportToCSV = exportToCSV;
window.exportToJSON = exportToJSON;
