/**
 * Analytics Page
 * Advanced business intelligence and reporting
 */

let chartInstances = {};

export async function initAnalytics(adminAPI) {
  try {
    // Load all analytics data
    await loadAnalyticsData(adminAPI);

    // Add export button
    document.getElementById('exportAnalytics')?.addEventListener('click', () => {
      exportAnalyticsReport(adminAPI);
    });

  } catch (error) {
    console.error('Analytics init error:', error);
    showError('Failed to load analytics data');
  }
}

async function loadAnalyticsData(adminAPI) {
  try {
    // Load all data in parallel
    const [
      dailyRevenue,
      monthlyRevenue,
      revenueByPlan,
      planDistribution,
      userGrowth,
      messageVolume,
      topUsers,
      activeInactive
    ] = await Promise.all([
      adminAPI.getDailyRevenue(30),
      adminAPI.getMonthlyRevenue(12),
      adminAPI.getRevenueByPlan(),
      adminAPI.getPlanDistribution(),
      adminAPI.getUserSignupTrends(30),
      adminAPI.getMessageVolumeTrends(30),
      adminAPI.getTopUsersByMessages(10),
      adminAPI.getActiveInactiveUsers()
    ]);

    // Render all charts
    renderDailyRevenueChart(dailyRevenue);
    renderMonthlyRevenueChart(monthlyRevenue);
    renderPlanDistributionChart(planDistribution);
    renderUserGrowthChart(userGrowth);
    renderMessageVolumeChart(messageVolume);
    renderRevenueByPlanChart(revenueByPlan);
    renderTopUsersTable(topUsers);
    renderUserStatusWidget(activeInactive);

  } catch (error) {
    console.error('Error loading analytics data:', error);
    showError('Failed to load analytics data');
  }
}

function renderDailyRevenueChart(data) {
  const ctx = document.getElementById('dailyRevenueChart');
  if (!ctx) return;

  if (chartInstances.dailyRevenue) {
    chartInstances.dailyRevenue.destroy();
  }

  chartInstances.dailyRevenue = new Chart(ctx, {
    type: 'line',
    data: {
      labels: data.map(d => new Date(d.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })),
      datasets: [{
        label: 'Daily Revenue ($)',
        data: data.map(d => d.revenue),
        borderColor: '#25D366',
        backgroundColor: 'rgba(37, 211, 102, 0.1)',
        tension: 0.4,
        fill: true,
        pointRadius: 4,
        pointBackgroundColor: '#25D366',
        pointBorderColor: '#fff',
        pointBorderWidth: 2,
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      plugins: {
        legend: {
          display: false
        }
      },
      scales: {
        y: {
          beginAtZero: true,
          ticks: {
            callback: function(value) {
              return '$' + value.toFixed(0);
            }
          }
        }
      }
    }
  });
}

function renderMonthlyRevenueChart(data) {
  const ctx = document.getElementById('monthlyRevenueChart');
  if (!ctx) return;

  if (chartInstances.monthlyRevenue) {
    chartInstances.monthlyRevenue.destroy();
  }

  chartInstances.monthlyRevenue = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: data.map(d => d.month),
      datasets: [{
        label: 'Monthly Revenue ($)',
        data: data.map(d => d.revenue),
        backgroundColor: '#25D366',
        borderRadius: 8,
        borderSkipped: false,
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      plugins: {
        legend: {
          display: false
        }
      },
      scales: {
        y: {
          beginAtZero: true,
          ticks: {
            callback: function(value) {
              return '$' + value.toFixed(0);
            }
          }
        }
      }
    }
  });
}

function renderPlanDistributionChart(data) {
  const ctx = document.getElementById('planDistributionChart');
  if (!ctx) return;

  if (chartInstances.planDistribution) {
    chartInstances.planDistribution.destroy();
  }

  const colors = ['#25D366', '#128C7E', '#34B7F1'];

  chartInstances.planDistribution = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: data.map(d => d.plan),
      datasets: [{
        data: data.map(d => d.users),
        backgroundColor: colors.slice(0, data.length),
        borderColor: '#fff',
        borderWidth: 2,
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      plugins: {
        legend: {
          position: 'bottom',
          labels: {
            font: { size: 12 },
            padding: 15
          }
        }
      }
    }
  });
}

function renderUserGrowthChart(data) {
  const ctx = document.getElementById('userGrowthChart');
  if (!ctx) return;

  if (chartInstances.userGrowth) {
    chartInstances.userGrowth.destroy();
  }

  chartInstances.userGrowth = new Chart(ctx, {
    type: 'line',
    data: {
      labels: data.map(d => new Date(d.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })),
      datasets: [{
        label: 'Cumulative Users',
        data: data.map(d => d.cumulative),
        borderColor: '#34B7F1',
        backgroundColor: 'rgba(52, 183, 241, 0.1)',
        tension: 0.4,
        fill: true,
        pointRadius: 3,
        pointBackgroundColor: '#34B7F1',
      }, {
        label: 'Daily Signups',
        data: data.map(d => d.signups),
        borderColor: '#FF9800',
        backgroundColor: 'rgba(255, 152, 0, 0.05)',
        tension: 0.4,
        yAxisID: 'y1',
        pointRadius: 3,
        pointBackgroundColor: '#FF9800',
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      plugins: {
        legend: {
          position: 'top'
        }
      },
      scales: {
        y: {
          type: 'linear',
          position: 'left',
          beginAtZero: true,
          ticks: {
            color: '#34B7F1'
          }
        },
        y1: {
          type: 'linear',
          position: 'right',
          beginAtZero: true,
          ticks: {
            color: '#FF9800'
          },
          grid: {
            drawOnChartArea: false,
          }
        }
      }
    }
  });
}

function renderMessageVolumeChart(data) {
  const ctx = document.getElementById('messageVolumeChart');
  if (!ctx) return;

  if (chartInstances.messageVolume) {
    chartInstances.messageVolume.destroy();
  }

  chartInstances.messageVolume = new Chart(ctx, {
    type: 'line',
    data: {
      labels: data.map(d => new Date(d.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })),
      datasets: [{
        label: 'Messages Sent',
        data: data.map(d => d.messages),
        borderColor: '#4CAF50',
        backgroundColor: 'rgba(76, 175, 80, 0.1)',
        tension: 0.4,
        fill: true,
        pointRadius: 3,
        pointBackgroundColor: '#4CAF50',
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      plugins: {
        legend: {
          display: false
        }
      },
      scales: {
        y: {
          beginAtZero: true,
          ticks: {
            callback: function(value) {
              return value.toLocaleString();
            }
          }
        }
      }
    }
  });
}

function renderRevenueByPlanChart(data) {
  const ctx = document.getElementById('revenueByPlanChart');
  if (!ctx) return;

  if (chartInstances.revenueByPlan) {
    chartInstances.revenueByPlan.destroy();
  }

  const colors = ['#25D366', '#128C7E', '#34B7F1'];

  chartInstances.revenueByPlan = new Chart(ctx, {
    type: 'pie',
    data: {
      labels: data.map(d => d.plan),
      datasets: [{
        data: data.map(d => d.revenue),
        backgroundColor: colors.slice(0, data.length),
        borderColor: '#fff',
        borderWidth: 2,
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      plugins: {
        legend: {
          position: 'bottom',
          labels: {
            font: { size: 12 },
            padding: 15
          }
        }
      }
    }
  });
}

function renderTopUsersTable(users) {
  const tbody = document.getElementById('topUsersBody');
  if (!tbody) return;

  if (users.length === 0) {
    tbody.innerHTML = '<tr><td colspan="4" class="text-center text-muted">No data available</td></tr>';
    return;
  }

  const maxMessages = Math.max(...users.map(u => u.messages));

  tbody.innerHTML = users.map((user, idx) => {
    const percentage = ((user.messages / maxMessages) * 100).toFixed(1);
    return `
      <tr>
        <td><span class="analytics-rank">#${idx + 1}</span></td>
        <td>${user.email}</td>
        <td>${user.messages.toLocaleString()}</td>
        <td><span class="analytics-percentage">${percentage}%</span></td>
      </tr>
    `;
  }).join('');
}

function renderUserStatusWidget(stats) {
  const widget = document.getElementById('userStatusWidget');
  if (!widget) return;

  const total = stats.active + stats.inactive;
  const activePercent = total > 0 ? ((stats.active / total) * 100).toFixed(1) : 0;
  const inactivePercent = total > 0 ? ((stats.inactive / total) * 100).toFixed(1) : 0;

  widget.innerHTML = `
    <div style="padding: 20px;">
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px;">
        <div>
          <div style="font-size: 28px; font-weight: 700; color: #25D366;">${stats.active}</div>
          <div style="font-size: 12px; color: #999;">Active Users</div>
          <div style="font-size: 11px; color: #666; margin-top: 4px;">${activePercent}% of total</div>
        </div>
        <div>
          <div style="font-size: 28px; font-weight: 700; color: #F44336;">${stats.inactive}</div>
          <div style="font-size: 12px; color: #999;">Inactive Users</div>
          <div style="font-size: 11px; color: #666; margin-top: 4px;">${inactivePercent}% of total</div>
        </div>
      </div>
      <div style="margin-top: 15px; padding-top: 15px; border-top: 1px solid #eee;">
        <div style="font-size: 11px; color: #999;">Total: ${total} Users</div>
      </div>
    </div>
  `;
}

async function exportAnalyticsReport(adminAPI) {
  try {
    alert('📊 Export functionality coming soon!\n\nSupported formats: PDF, PNG, CSV');
  } catch (error) {
    console.error('Export error:', error);
    showError('Failed to export report');
  }
}

function showError(message) {
  alert(`❌ ${message}`);
}
