/**
 * Subscriptions Management Page
 * Handles subscription plans, user assignments, and payment tracking
 */

let plans = [];
let subscriptions = [];
let currentSubscriptionPage = 1;
const SUBS_PER_PAGE = 20;
let _adminAPI = null;

export async function initSubscriptions(adminAPI) {
  _adminAPI = adminAPI;
  // Remove legacy localStorage plans cache — plans now stored in Supabase only
  localStorage.removeItem('admin_subscription_plans');
  try {
    // Load subscription plans
    await loadPlans(adminAPI);

    // Load active subscriptions
    await loadSubscriptions(adminAPI);

    // Setup event listeners
    setupSubscriptionEventListeners(adminAPI);

  } catch (error) {
    console.error('Subscriptions init error:', error);
    showSubError('Failed to load subscriptions');
  }
}

async function loadPlans(adminAPI) {
  try {
    plans = await adminAPI.getSubscriptionPlans();
    displayPlans();
    populatePlanSelect();
  } catch (error) {
    console.error('Error loading plans:', error);
    showSubError('Failed to load subscription plans');
  }
}

function displayPlans() {
  const grid = document.getElementById('plansGrid');

  if (!plans || plans.length === 0) {
    grid.innerHTML = '<p class="text-muted text-center">No subscription plans found</p>';
    return;
  }

  const html = plans.map(plan => `
    <div class="plan-card">
      <div class="plan-name">${plan.name}</div>

      <div class="plan-price">
        $${plan.price_monthly ?? plan.price ?? 0}
        <span style="font-size: 14px; color: var(--text-secondary);">/month</span>
      </div>
      <div style="font-size: 12px; color: var(--text-secondary); margin-top: -8px; margin-bottom: 8px;">
        $${plan.price_yearly ?? 0}/year
        ${(plan.price_monthly ?? plan.price ?? 0) > 0 ? `<span style="color:#25D366;">(save ${Math.round(100 - ((plan.price_yearly ?? 0) / ((plan.price_monthly ?? plan.price ?? 1) * 12)) * 100)}%)</span>` : ''}
      </div>

      <div style="margin-bottom: 16px; font-size: 12px; color: var(--text-secondary);">
        ${plan.description || 'Professional plan'}
      </div>

      <div class="plan-features">
        <li>💬 <strong>${plan.messages_limit >= 999999 ? 'Unlimited' : plan.messages_limit?.toLocaleString()}</strong> Messages/Day</li>
        ${plan.features?.media_upload ? '<li>📎 Media Upload (Images, Videos, PDF)</li>' : ''}
        ${Array.isArray(plan.features?.features) ? plan.features.features.map(f =>
          `<li>✓ ${f}</li>`
        ).join('') : ''}
      </div>

      <div style="display: flex; gap: 8px;">
        <button class="btn btn-sm btn-secondary" style="flex: 1;" onclick="editPlan('${plan.id}')">
          Edit
        </button>
        <button class="btn btn-sm btn-danger" style="flex: 1;" onclick="deletePlanConfirm('${plan.id}')">
          Delete
        </button>
      </div>
    </div>
  `).join('');

  grid.innerHTML = html;
}

function populatePlanSelect() {
  const select = document.getElementById('userPlan');
  const subFilter = document.getElementById('subPlanFilter');

  if (select) {
    select.innerHTML = '<option value="">Select a plan</option>' +
      plans.map(p => `<option value="${p.id}">${p.name} ($${p.price_monthly ?? p.price ?? 0}/mo)</option>`).join('');
  }

  if (subFilter) {
    subFilter.innerHTML = '<option value="">All Plans</option>' +
      plans.map(p => `<option value="${p.id}">${p.name}</option>`).join('');
  }
}

async function loadSubscriptions(adminAPI) {
  try {
    const response = await adminAPI.request('GET', 'subscriptions?select=*,users(email),plans(name)&order=created_at.desc&limit=100');
    subscriptions = Array.isArray(response) ? response : [];
    displaySubscriptions();
  } catch (error) {
    console.error('Error loading subscriptions:', error);
  }
}

function displaySubscriptions() {
  const tbody = document.getElementById('subscriptionsTableBody');

  if (!subscriptions || subscriptions.length === 0) {
    tbody.innerHTML = '<tr><td colspan="8" class="text-center text-muted">No active subscriptions</td></tr>';
    return;
  }

  const startIdx = (currentSubscriptionPage - 1) * SUBS_PER_PAGE;
  const endIdx = startIdx + SUBS_PER_PAGE;
  const pageSubs = subscriptions.slice(startIdx, endIdx);

  const html = pageSubs.map(sub => {
    const planName = sub.plans?.name || plans.find(p => p.id === sub.plan_id)?.name || 'Unknown';
    const userEmail = sub.users?.email || '-';

    return `
      <tr>
        <td>${userEmail}</td>
        <td>${planName}</td>
        <td>Manual</td>
        <td>$${sub.amount}</td>
        <td>${formatDate(sub.created_at)}</td>
        <td>-</td>
        <td>
          <span class="status-badge ${sub.status === 'active' ? 'active' : sub.status === 'cancelled' ? 'inactive' : 'suspended'}">
            ${sub.status.charAt(0).toUpperCase() + sub.status.slice(1)}
          </span>
        </td>
        <td>
          <button class="btn btn-sm" onclick="viewSubscriptionDetails('${sub.id}')">Details</button>
          ${sub.status === 'active' ?
            `<button class="btn btn-sm btn-warning" onclick="cancelSubscription('${sub.id}')">Cancel</button>`
            : ''}
        </td>
      </tr>
    `;
  }).join('');

  tbody.innerHTML = html;
}

function setupSubscriptionEventListeners(adminAPI) {
  // Create plan button
  document.getElementById('createPlanBtn')?.addEventListener('click', () => {
    openPlanModal('Create Plan', null);
  });

  // Filter subscriptions by plan
  document.getElementById('subPlanFilter')?.addEventListener('change', (e) => {
    const planId = e.target.value;
    if (planId) {
      subscriptions = subscriptions.filter(s => s.plan_id === planId);
    } else {
      loadSubscriptions(adminAPI);
    }
    displaySubscriptions();
  });

  // Search subscriptions
  document.getElementById('subSearch')?.addEventListener('input', (e) => {
    const query = e.target.value.toLowerCase();
    subscriptions = subscriptions.filter(s =>
      s.user_email?.toLowerCase().includes(query) || false
    );
    currentSubscriptionPage = 1;
    displaySubscriptions();
  });

  // Unlimited checkbox toggle
  document.getElementById('planUnlimited')?.addEventListener('change', (e) => {
    const limitGroup = document.getElementById('planMsgLimitGroup');
    const limitInput = document.getElementById('planMsgLimit');
    if (e.target.checked) {
      limitGroup.style.display = 'none';
      limitInput.removeAttribute('required');
    } else {
      limitGroup.style.display = '';
      limitInput.setAttribute('required', '');
    }
  });

  // Plan form submit
  document.getElementById('planForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = document.getElementById('planId').value;
    const name = document.getElementById('planName').value.trim();
    const price_monthly = parseFloat(document.getElementById('planPriceMonthly').value) || 0;
    const price_yearly  = parseFloat(document.getElementById('planPriceYearly').value) || 0;
    const unlimited = document.getElementById('planUnlimited').checked;
    const msgLimit = unlimited ? 999999 : parseInt(document.getElementById('planMsgLimit').value) || 500;
    const isActive = document.getElementById('planActive').checked;
    const mediaUploadEnabled = document.getElementById('planMediaUpload').checked;

    const plan = {
      id: id || name.toLowerCase().replace(/\s+/g, '_'),
      name,
      price_monthly,
      price_yearly,
      price: price_monthly, // keep price column in sync for backward compat
      messages_limit: msgLimit,
      active: isActive,
      features: {
        media_upload: mediaUploadEnabled
      }
    };

    try {
      await _adminAPI.savePlan(plan);
      window.closeModal('planModal');
      await loadPlans(_adminAPI);
      showSubSuccess('Plan saved successfully');
    } catch (err) {
      showSubError('Failed to save plan: ' + err.message);
    }
  });
}

async function editPlan(planId) {
  const plan = plans.find(p => p.id === planId);
  if (!plan) return;
  openPlanModal('Edit Plan', plan);
}

async function deletePlanConfirm(planId) {
  const plan = plans.find(p => p.id === planId);
  if (!plan) return;
  try {
    await _adminAPI.deletePlan(planId);
    await loadPlans(_adminAPI);
    showSubSuccess(`Plan "${plan.name}" deleted`);
  } catch (err) {
    showSubError('Failed to delete plan: ' + err.message);
  }
}

async function viewUsers(planId) {
  const plan = plans.find(p => p.id === planId);
  if (!plan) return;

  try {
    const adminAPI = window.adminAPI;
    // Get all users with this plan
    const response = await adminAPI.adminAPI?.request('GET', `users?subscription_plan_id=eq.${planId}&limit=1000`) || [];
    const users = Array.isArray(response) ? response : [];

    alert(`${plan.name} Plan - ${users.length} Users`);
  } catch (error) {
    console.error('Error viewing users:', error);
  }
}

async function viewSubscriptionDetails(subscriptionId) {
  try {
    const adminAPI = window.adminAPI;
    const sub = subscriptions.find(s => s.id === subscriptionId);

    if (!sub) {
      showSubError('Subscription not found');
      return;
    }

    const planName = sub.plans?.name || plans.find(p => p.id === sub.plan_id)?.name || 'Unknown';
    const details = `
Subscription Details
─────────────────────
Plan: ${planName}
Status: ${sub.status}
Amount: $${sub.amount}
Created: ${formatDate(sub.created_at)}
    `;

    alert(details);
  } catch (error) {
    console.error('Error viewing subscription:', error);
    showSubError('Failed to load subscription details');
  }
}

async function cancelSubscription(subscriptionId) {
  if (!confirm('Are you sure you want to cancel this subscription?')) {
    return;
  }

  try {
    const adminAPI = window.adminAPI;
    await adminAPI.cancelSubscription(subscriptionId);
    showSubSuccess('Subscription cancelled');
    await loadSubscriptions(adminAPI);
  } catch (error) {
    console.error('Error cancelling subscription:', error);
    showSubError('Failed to cancel subscription: ' + error.message);
  }
}

function openPlanModal(title, plan) {
  document.getElementById('planModalTitle').textContent = title;
  document.getElementById('planId').value = plan?.id || '';
  document.getElementById('planName').value = plan?.name || '';
  document.getElementById('planPriceMonthly').value = plan?.price_monthly ?? plan?.price ?? '';
  document.getElementById('planPriceYearly').value = plan?.price_yearly ?? '';

  const unlimited = plan ? plan.messages_limit >= 999999 : false;
  document.getElementById('planUnlimited').checked = unlimited;
  document.getElementById('planMsgLimit').value = unlimited ? '' : (plan?.messages_limit || '');
  document.getElementById('planMsgLimitGroup').style.display = unlimited ? 'none' : '';

  // Load media upload setting
  const mediaUploadEnabled = plan?.features?.media_upload || false;
  document.getElementById('planMediaUpload').checked = mediaUploadEnabled;

  document.getElementById('planActive').checked = plan ? plan.active !== false : true;

  document.getElementById('planModal').style.display = 'flex';
}

function formatDate(dateString) {
  if (!dateString) return '-';
  const date = new Date(dateString);
  return date.toLocaleDateString();
}

function showSubSuccess(message) {
  console.log('✓ ' + message);
  window.showToast?.(message, 'success');
}

function showSubError(message) {
  console.error('✗ ' + message);
  window.showToast?.(message, 'error');
}

// Make functions globally available
window.editPlan = editPlan;
window.deletePlanConfirm = deletePlanConfirm;
window.viewSubscriptionDetails = viewSubscriptionDetails;
window.cancelSubscription = cancelSubscription;
