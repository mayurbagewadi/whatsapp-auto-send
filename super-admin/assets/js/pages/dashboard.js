/**
 * Dashboard Page
 * Displays admin overview and key metrics
 */

let dashboardRefreshInterval = null;

export async function initDashboard(adminAPI) {
  try {
    // Load initial dashboard data
    await loadDashboardData(adminAPI);

    // Start real-time refresh every 5 seconds
    startRealTimeRefresh(adminAPI);

  } catch (error) {
    console.error('Dashboard init error:', error);
    showError('Failed to load dashboard data');
  }
}

async function loadDashboardData(adminAPI) {
  try {
    // Get stats
    const result = await adminAPI.getDashboardStats();
    const data = result?.stats;
    if (data) {
      document.getElementById('totalUsers').textContent          = (data.totalUsers || 0).toLocaleString();
      document.getElementById('activeUsers').textContent         = (data.activeUsers || 0).toLocaleString();
      document.getElementById('suspendedUsers').textContent      = (data.suspendedUsers || 0).toLocaleString();
      document.getElementById('activeSubscriptions').textContent = (data.activeSubscriptions || 0).toLocaleString();
      document.getElementById('monthlyRevenue').textContent      = `$${(data.monthlyRevenue || 0).toFixed(2)}`;
      document.getElementById('totalMessages').textContent       = (data.totalMessages || 0).toLocaleString();
    }

    // Get real-time extension metrics
    const metrics = await adminAPI.getRealTimeMetrics();
    displayExtensionMetrics(metrics);

    // Get active extension users
    const activeUsers = await adminAPI.getActiveExtensionUsers();
    displayActiveExtensionUsers(activeUsers);

    // Load recent audit activity
    const auditLogs = await adminAPI.getAuditLogs(5);
    displayRecentActivity(auditLogs);

    // Load violation statistics
    const violationStats = await adminAPI.getViolationStats();
    displayViolationStats(violationStats);

    // Load recent violations
    const violations = await adminAPI.getAllViolations(10, 7);
    displayRecentViolations(violations);

  } catch (error) {
    console.error('Error loading dashboard data:', error);
    showError('Failed to load dashboard data');
  }
}

function displayExtensionMetrics(metrics) {
  // Create a metrics display section
  let metricsDiv = document.getElementById('extensionMetrics');

  if (!metricsDiv) {
    metricsDiv = document.createElement('div');
    metricsDiv.id = 'extensionMetrics';
    metricsDiv.style.cssText = 'margin: 16px 0; padding: 16px; background: var(--bg-secondary); border-radius: 12px; border-left: 4px solid var(--primary);';

    const statsContainer = document.querySelector('.stats-grid');
    if (statsContainer) {
      statsContainer.parentNode.insertBefore(metricsDiv, statsContainer.nextSibling);
    }
  }

  const html = `
    <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 0;">
      <div style="text-align: center;">
        <div style="font-size: 12px; color: var(--text-secondary); margin-bottom: 4px;">📱 Online Now</div>
        <div style="font-size: 20px; font-weight: 700; color: var(--primary);">${metrics.activeUsers || 0}</div>
      </div>
      <div style="text-align: center;">
        <div style="font-size: 12px; color: var(--text-secondary); margin-bottom: 4px;">💬 Messages Today</div>
        <div style="font-size: 20px; font-weight: 700; color: var(--primary);">${(metrics.messagesToday || 0).toLocaleString()}</div>
      </div>
      <div style="text-align: center;">
        <div style="font-size: 12px; color: var(--text-secondary); margin-bottom: 4px;">🚀 Campaigns Today</div>
        <div style="font-size: 20px; font-weight: 700; color: var(--primary);">${metrics.campaignToday || 0}</div>
      </div>
      <div style="text-align: center;">
        <div style="font-size: 12px; color: var(--text-secondary); margin-bottom: 4px;">📇 Contacts Imported</div>
        <div style="font-size: 20px; font-weight: 700; color: var(--primary);">${(metrics.contactsToday || 0).toLocaleString()}</div>
      </div>
    </div>
    <div style="font-size: 11px; color: var(--text-muted); text-align: right; margin-top: 8px;">
      Last updated: ${new Date(metrics.timestamp).toLocaleTimeString()}
    </div>
  `;

  metricsDiv.innerHTML = html;
}

function displayActiveExtensionUsers(users) {
  let usersDiv = document.getElementById('activeExtensionUsers');

  if (!usersDiv) {
    usersDiv = document.createElement('div');
    usersDiv.id = 'activeExtensionUsers';
    const statsContainer = document.querySelector('.stats-grid');
    if (statsContainer) {
      statsContainer.parentNode.insertBefore(usersDiv, statsContainer.nextSibling);
    }
  }

  if (!users || users.length === 0) {
    usersDiv.innerHTML = '';
    return;
  }

  const html = `
    <div style="margin-top: 16px; padding: 12px; background: rgba(76, 175, 80, 0.1); border-radius: 8px; border-left: 3px solid var(--success);">
      <div style="font-size: 12px; font-weight: 600; color: var(--text-secondary); margin-bottom: 8px;">🟢 ACTIVE EXTENSION USERS (Last 5 min)</div>
      <div style="max-height: 120px; overflow-y: auto;">
        ${users.slice(0, 5).map(user => `
          <div style="font-size: 12px; padding: 4px 0; color: var(--text-primary);">
            ${user.full_name || user.email}
            <span style="color: var(--text-secondary);">(${user.plan_name})</span>
            <span style="font-size: 10px; color: var(--text-muted);">${new Date(user.last_activity).toLocaleTimeString()}</span>
          </div>
        `).join('')}
        ${users.length > 5 ? `<div style="font-size: 11px; color: var(--text-muted); padding-top: 4px;">+ ${users.length - 5} more users</div>` : ''}
      </div>
    </div>
  `;

  usersDiv.innerHTML = html;
}

function startRealTimeRefresh(adminAPI) {
  if (dashboardRefreshInterval) {
    clearInterval(dashboardRefreshInterval);
  }

  dashboardRefreshInterval = setInterval(async () => {
    try {
      // Refresh only extension metrics and active users (fast updates)
      const metrics = await adminAPI.getRealTimeMetrics();
      displayExtensionMetrics(metrics);

      const activeUsers = await adminAPI.getActiveExtensionUsers();
      displayActiveExtensionUsers(activeUsers);
    } catch (error) {
      console.error('Real-time refresh error:', error);
    }
  }, 5000); // Refresh every 5 seconds

  console.log('📊 Real-time dashboard refresh started');
}

// Stop refresh when page unloads
window.addEventListener('beforeunload', () => {
  if (dashboardRefreshInterval) {
    clearInterval(dashboardRefreshInterval);
  }
});

function displayRecentActivity(logs) {
  const container = document.getElementById('recentActivity');

  if (!logs || logs.length === 0) {
    container.innerHTML = '<p class="text-muted text-center">No recent activity</p>';
    return;
  }

  const html = logs.map(log => `
    <div class="activity-item">
      <div>
        <strong>${formatAction(log.action)}</strong>
        <p class="text-muted" style="font-size: 12px; margin-top: 4px;">
          ${log.target_user_id ? `User: ${log.target_user_id.substring(0, 8)}...` : 'System'}
        </p>
      </div>
      <span class="activity-time">${formatTime(log.created_at)}</span>
    </div>
  `).join('');

  container.innerHTML = html;
}

function formatAction(action) {
  const actionMap = {
    'create_user': '➕ Created User',
    'update_user': '✏️ Updated User',
    'delete_user': '🗑️ Deleted User',
    'suspend_user': '⏸️ Suspended User',
    'unsuspend_user': '▶️ Unsuspended User',
    'update_subscription': '💳 Updated Subscription',
    'admin_login_success': '🔓 Admin Login',
    'admin_logout': '🔒 Admin Logout'
  };

  return actionMap[action] || action;
}

function formatTime(timestamp) {
  if (!timestamp) return 'Unknown';

  const date = new Date(timestamp);
  const now = new Date();
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;

  return date.toLocaleDateString();
}

function displayViolationStats(stats) {
  const container = document.getElementById('dashboardContent');
  if (!container) return;

  const statsHtml = `
    <div style="margin-top: 20px; padding: 16px; background: #fff3cd; border-left: 4px solid #ff9800; border-radius: 8px;">
      <div style="font-weight: 600; margin-bottom: 8px;">⚠️ Limit Violations (Last 7 Days)</div>
      <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; font-size: 12px;">
        <div>
          <div style="color: #666;">Total Violations</div>
          <div style="font-size: 20px; font-weight: 700; color: #ff9800;">${stats.totalViolations}</div>
        </div>
        <div>
          <div style="color: #666;">Affected Users</div>
          <div style="font-size: 20px; font-weight: 700; color: #ff9800;">${stats.usersWithViolations}</div>
        </div>
        <div>
          <div style="color: #666;">Most Common</div>
          <div style="font-size: 14px; font-weight: 600; color: #ff9800;">
            ${stats.topActions?.[0]?.action || 'None'}
          </div>
        </div>
      </div>
    </div>
  `;

  // Insert after other stats
  const recentActivitySection = document.querySelector('[class*="section"]:last-of-type');
  if (recentActivitySection) {
    recentActivitySection.insertAdjacentHTML('afterend', statsHtml);
  }
}

function displayRecentViolations(violations) {
  const container = document.getElementById('dashboardContent');
  if (!container || !violations || violations.length === 0) return;

  let html = `
    <div style="margin-top: 20px;">
      <div style="font-weight: 600; margin-bottom: 12px; font-size: 14px; color: #666; text-transform: uppercase; letter-spacing: 0.5px;">
        Recent Violations
      </div>
      <div style="background: white; border: 1px solid #ddd; border-radius: 8px; overflow: hidden;">
  `;

  violations.forEach((v, idx) => {
    const actionEmoji = {
      'message_sent': '💬',
      'contact_imported': '📇',
      'campaign_created': '🚀'
    }[v.action_type] || '⚠️';

    html += `
      <div style="padding: 12px; border-bottom: ${idx < violations.length - 1 ? '1px solid #eee' : 'none'}; display: flex; justify-content: space-between; align-items: center; font-size: 12px;">
        <div>
          <div style="font-weight: 600;">${actionEmoji} ${v.user_email}</div>
          <div style="color: #999; font-size: 11px;">${v.action_type}: ${v.current_usage}/${v.limit_value}</div>
        </div>
        <div style="text-align: right;">
          <div style="color: #666; font-size: 11px;">${formatTime(v.violation_at)}</div>
          <div style="color: #999; font-size: 10px;">${v.plan_name}</div>
        </div>
      </div>
    `;
  });

  html += `
      </div>
    </div>
  `;

  container.insertAdjacentHTML('beforeend', html);
}

function showError(message) {
  const container = document.getElementById('recentActivity');
  container.innerHTML = `<p class="text-error text-center">${message}</p>`;
}
