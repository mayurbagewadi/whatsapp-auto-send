/**
 * Admin API Wrapper — Supabase REST API (service role)
 * Queries Supabase tables directly. Localhost only.
 */

import ADMIN_CONFIG from '../../config/admin-config.js';
import { adminAuth } from './admin-auth.js';

class AdminAPI {
  constructor() {
    this.projectUrl = ADMIN_CONFIG.supabaseProjectUrl;
    this.apiKey     = ADMIN_CONFIG.supabaseServiceRoleKey;
    this.restUrl    = `${this.projectUrl}/rest/v1`;
  }

  getHeaders(extra = {}) {
    return {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${this.apiKey}`,
      'apikey': this.apiKey,
      'Prefer': 'return=representation',
      ...extra
    };
  }

  async request(method, endpoint, body = null) {
    const url = `${this.restUrl}/${endpoint}`;
    const options = { method, headers: this.getHeaders() };
    if (body) options.body = JSON.stringify(body);

    const response = await fetch(url, options);
    const data = await response.json();

    if (!response.ok) throw new Error(data.message || `API Error: ${response.status}`);
    return data;
  }

  // ============================================
  // DASHBOARD
  // ============================================

  async getDashboardStats() {
    try {
      const [users, subs] = await Promise.all([
        this.request('GET', 'users?select=id,status,plan,messages_sent_total'),
        this.request('GET', 'subscriptions?select=amount&status=eq.active').catch(() => [])
      ]);
      const total        = users.length;
      const active       = users.filter(u => u.status === 'active').length;
      const suspended    = total - active;
      const totalMessages = users.reduce((s, u) => s + (u.messages_sent_total || 0), 0);
      const monthlyRevenue = subs.reduce((s, sub) => s + parseFloat(sub.amount || 0), 0);
      return {
        stats: {
          totalUsers: total,
          activeUsers: active,
          suspendedUsers: suspended,
          totalMessages,
          activeSubscriptions: subs.length,
          monthlyRevenue
        }
      };
    } catch (e) {
      return { stats: { totalUsers: 0, activeUsers: 0, suspendedUsers: 0, totalMessages: 0, activeSubscriptions: 0, monthlyRevenue: 0 } };
    }
  }

  async getRealTimeMetrics() {
    try {
      const users = await this.request('GET', 'users?select=id,status,messages_sent_today');
      const activeUsers   = users.filter(u => u.status === 'active').length;
      const messagesToday = users.reduce((s, u) => s + (u.messages_sent_today || 0), 0);
      return { activeUsers, messagesToday, campaignToday: 0, contactsToday: 0, timestamp: new Date().toISOString() };
    } catch (e) {
      return { activeUsers: 0, messagesToday: 0, campaignToday: 0, contactsToday: 0, timestamp: new Date().toISOString() };
    }
  }

  // ============================================
  // USERS
  // ============================================

  async getAllUsers(page = 1, limit = 20, filters = {}) {
    const offset = (page - 1) * limit;
    let endpoint = `users?select=*&limit=${limit}&offset=${offset}&order=created_at.desc`;
    if (filters.search) endpoint += `&email=ilike.*${encodeURIComponent(filters.search)}*`;
    if (filters.status === 'active')    endpoint += '&status=eq.active';
    if (filters.status === 'suspended') endpoint += '&status=eq.suspended';

    const users = await this.request('GET', endpoint);
    return { users: users || [], total: users?.length || 0 };
  }

  async getUser(userId) {
    const users = await this.request('GET', `users?id=eq.${userId}`);
    return users[0] || null;
  }

  async createUser(userData) {
    return this.request('POST', 'users', userData);
  }

  async updateUser(userId, updates) {
    // If plan is being changed, sync messages_limit and create subscription record
    if (updates.plan) {
      try {
        const planRows = await this.request('GET', `plans?id=eq.${updates.plan}&select=messages_limit,price_monthly,price`);
        if (planRows && planRows.length > 0 && planRows[0].messages_limit != null) {
          updates.messages_limit = planRows[0].messages_limit;

          // Cancel any existing active subscription for this user
          await this.request('PATCH', `subscriptions?user_id=eq.${userId}&status=eq.active`, { status: 'cancelled' }).catch(() => {});

          // Create new subscription record
          const amount = planRows[0].price_monthly ?? planRows[0].price ?? 0;
          await this.request('POST', 'subscriptions', {
            user_id: userId,
            plan_id: updates.plan,
            status: 'active',
            amount: amount
          }).catch(err => console.warn('[updateUser] subscription record failed:', err));
        } else {
          console.warn(`[updateUser] Plan "${updates.plan}" not found or missing messages_limit. planRows:`, planRows);
        }
      } catch (err) {
        console.error('[updateUser] Failed to sync plan data:', err);
      }
    }
    return this.request('PATCH', `users?id=eq.${userId}`, updates);
  }

  async cancelSubscription(subscriptionId) {
    return this.request('PATCH', `subscriptions?id=eq.${subscriptionId}`, { status: 'cancelled' });
  }

  async deleteUser(userId) {
    return this.request('DELETE', `users?id=eq.${userId}`);
  }

  async suspendUser(userId) {
    return this.request('PATCH', `users?id=eq.${userId}`, { status: 'suspended' });
  }

  async unsuspendUser(userId) {
    return this.request('PATCH', `users?id=eq.${userId}`, { status: 'active' });
  }

  async getUsersCount() {
    const response = await fetch(`${this.restUrl}/users?select=count`, {
      headers: { ...this.getHeaders(), 'Prefer': 'count=exact' }
    });
    const range = response.headers.get('content-range');
    return { success: true, count: parseInt(range?.split('/')[1] || 0) };
  }

  // ============================================
  // SUBSCRIPTIONS / PLANS
  // ============================================

  async getSubscriptionPlans() {
    return this.request('GET', 'plans?select=*&order=display_order.asc');
  }

  async savePlan(plan) {
    const url = `${this.restUrl}/plans`;
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        ...this.getHeaders(),
        'Prefer': 'resolution=merge-duplicates,return=representation'
      },
      body: JSON.stringify(plan)
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.message || `API Error: ${response.status}`);

    // Sync media_plan_settings so the extension quota check stays in sync
    await fetch(`${this.restUrl}/media_plan_settings`, {
      method: 'POST',
      headers: {
        ...this.getHeaders(),
        'Prefer': 'resolution=merge-duplicates,return=representation'
      },
      body: JSON.stringify({
        plan_id: plan.id,
        media_upload_enabled: plan.features?.media_upload ?? false
      })
    });

    return data;
  }

  async deletePlan(planId) {
    // Step 1: Find a fallback plan (any other plan that is not being deleted)
    const allPlans = await this.request('GET', `plans?id=neq.${planId}&select=id,messages_limit&limit=1`).catch(() => []);
    const fallback = allPlans && allPlans.length > 0 ? allPlans[0] : null;

    // Step 2: Reassign users on this plan to fallback (prevents users_plan_fkey violation)
    if (fallback) {
      await this.request('PATCH', `users?plan=eq.${planId}`, { plan: fallback.id, messages_limit: fallback.messages_limit }).catch(e => console.warn('[deletePlan] users reassign failed:', e.message));
    }

    // Step 3: Remove all subscriptions referencing this plan
    await this.request('DELETE', `subscriptions?plan_id=eq.${planId}`).catch(e => console.warn('[deletePlan] subscriptions cleanup failed:', e.message));

    // Step 4: Delete the plan
    return this.request('DELETE', `plans?id=eq.${planId}`);
  }

  async getSubscriptions(status = null, page = 1) {
    let endpoint = `users?select=id,email,plan,status,created_at&limit=50&offset=${(page - 1) * 50}&order=created_at.desc`;
    if (status === 'active')    endpoint += '&status=eq.active';
    if (status === 'suspended') endpoint += '&status=eq.suspended';
    const users = await this.request('GET', endpoint);
    return users || [];
  }

  // ============================================
  // SELECTORS
  // ============================================

  async getSelectors() {
    return this.request('GET', 'selectors?select=*');
  }

  async updateSelector(selectorId, selectors) {
    return this.request('PATCH', `selectors?id=eq.${selectorId}`, { selectors });
  }

  // ============================================
  // AUDIT LOGS (local)
  // ============================================

  async getAuditLogs(limit = 10) {
    return await adminAuth.getAuditLog(limit);
  }

  // ============================================
  // ANALYTICS — connected to Supabase tables
  // ============================================

  async getDailyRevenue(days = 30) {
    try {
      const since = new Date(Date.now() - days * 86400000).toISOString();
      const subs = await this.request('GET', `subscriptions?select=amount,created_at&status=eq.active&created_at=gte.${since}&order=created_at.asc`);
      const byDate = {};
      subs.forEach(s => {
        const date = s.created_at.split('T')[0];
        byDate[date] = (byDate[date] || 0) + parseFloat(s.amount || 0);
      });
      return Object.entries(byDate).map(([date, revenue]) => ({ date, revenue }));
    } catch { return []; }
  }

  async getMonthlyRevenue(months = 12) {
    try {
      const since = new Date(Date.now() - months * 30 * 86400000).toISOString();
      const subs = await this.request('GET', `subscriptions?select=amount,created_at&status=eq.active&created_at=gte.${since}`);
      const byMonth = {};
      subs.forEach(s => {
        const month = new Date(s.created_at).toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
        byMonth[month] = (byMonth[month] || 0) + parseFloat(s.amount || 0);
      });
      return Object.entries(byMonth).map(([month, revenue]) => ({ month, revenue }));
    } catch { return []; }
  }

  async getUsersByPlan() {
    try {
      const users = await this.request('GET', 'users?select=plan');
      const counts = { free: 0, pro: 0, enterprise: 0 };
      users.forEach(u => { if (counts[u.plan] !== undefined) counts[u.plan]++; });
      return counts;
    } catch { return { free: 0, pro: 0, enterprise: 0 }; }
  }

  async getPlanDistribution() {
    try {
      const users = await this.request('GET', 'users?select=plan');
      const counts = {};
      users.forEach(u => { counts[u.plan] = (counts[u.plan] || 0) + 1; });
      return Object.entries(counts).map(([plan, users]) => ({ plan, users }));
    } catch { return []; }
  }

  async getUserSignups()         { return []; }

  async getUserSignupTrends(days = 30) {
    try {
      const since = new Date(Date.now() - days * 86400000).toISOString();
      const users = await this.request('GET', `users?select=created_at&created_at=gte.${since}&order=created_at.asc`);
      const byDate = {};
      users.forEach(u => {
        const date = u.created_at.split('T')[0];
        byDate[date] = (byDate[date] || 0) + 1;
      });
      let cumulative = 0;
      return Object.entries(byDate).map(([date, signups]) => {
        cumulative += signups;
        return { date, signups, cumulative };
      });
    } catch { return []; }
  }

  async getMessageVolume()       { return []; }

  async getMessageVolumeTrends(days = 30) {
    try {
      const since = new Date(Date.now() - days * 86400000).toISOString();
      const events = await this.request('GET', `analytics?select=created_at&event_type=eq.message_sent&created_at=gte.${since}&order=created_at.asc`);
      const byDate = {};
      events.forEach(e => {
        const date = e.created_at.split('T')[0];
        byDate[date] = (byDate[date] || 0) + 1;
      });
      return Object.entries(byDate).map(([date, messages]) => ({ date, messages }));
    } catch { return []; }
  }

  async getRevenueByPlan() {
    try {
      const subs = await this.request('GET', 'subscriptions?select=amount,plan_id&status=eq.active');
      const byPlan = {};
      subs.forEach(s => {
        byPlan[s.plan_id] = (byPlan[s.plan_id] || 0) + parseFloat(s.amount || 0);
      });
      return Object.entries(byPlan).map(([plan, revenue]) => ({ plan, revenue }));
    } catch { return []; }
  }

  async getTopUsersByMessages(limit = 10) {
    try {
      const users = await this.request('GET', `users?select=id,email,messages_sent_total&order=messages_sent_total.desc&limit=${limit}`);
      return users.map(u => ({ email: u.email, messages: u.messages_sent_total || 0 }));
    } catch { return []; }
  }

  async getActiveExtensionUsers() {
    try {
      const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
      const users = await this.request('GET', `users?select=id,email,plan,last_active_at&last_active_at=gte.${fiveMinAgo}&order=last_active_at.desc&limit=10`);
      return users.map(u => ({ email: u.email, plan_name: u.plan, last_activity: u.last_active_at }));
    } catch { return []; }
  }

  async getDailyUsageLogs() {
    try {
      const data = await this.request('GET', 'analytics?select=user_id,event_type,created_at&order=created_at.desc&limit=100');
      return { data: data || [] };
    } catch { return { data: [] }; }
  }

  async getViolationStats()  { return { totalViolations: 0, usersWithViolations: 0, topActions: [] }; }
  async getAllViolations()   { return []; }

  async getActiveInactiveUsers() {
    try {
      const result = await this.getDashboardStats();
      return { active: result.stats.activeUsers, inactive: result.stats.suspendedUsers };
    } catch (e) {
      return { active: 0, inactive: 0 };
    }
  }

  async getMessageLogs(date, page = 1, perPage = 10) {
    try {
      const offset = (page - 1) * perPage;
      const dateStart = `${date}T00:00:00.000Z`;
      const dateEnd   = `${date}T23:59:59.999Z`;
      const url = `${this.restUrl}/message_logs?select=id,recipient_phone,message,status,error,sent_at,user_id,users(email,phone,company_name)&sent_at=gte.${dateStart}&sent_at=lte.${dateEnd}&order=sent_at.desc&limit=${perPage}&offset=${offset}`;
      const res = await fetch(url, { headers: { ...this.getHeaders(), 'Prefer': 'count=exact' } });
      const total = parseInt(res.headers.get('Content-Range')?.split('/')[1] || '0', 10);
      const data  = await res.json();
      return { logs: Array.isArray(data) ? data : [], total };
    } catch (error) {
      console.error('[getMessageLogs] error:', error);
      return { logs: [], total: 0 };
    }
  }

  async getAllMessageLogsByDate(date) {
    try {
      const dateStart = `${date}T00:00:00.000Z`;
      const dateEnd   = `${date}T23:59:59.999Z`;
      const url = `${this.restUrl}/message_logs?select=id,recipient_phone,message,status,error,sent_at,user_id,users(email,phone,company_name)&sent_at=gte.${dateStart}&sent_at=lte.${dateEnd}&order=sent_at.desc`;
      const res  = await fetch(url, { headers: this.getHeaders() });
      const data = await res.json();
      return Array.isArray(data) ? data : [];
    } catch (error) {
      console.error('[getAllMessageLogsByDate] error:', error);
      return [];
    }
  }

  async deleteMessageLogsByDate(date) {
    try {
      const dateStart = `${date}T00:00:00.000Z`;
      const dateEnd   = `${date}T23:59:59.999Z`;
      const url = `${this.restUrl}/message_logs?sent_at=gte.${dateStart}&sent_at=lte.${dateEnd}`;
      await fetch(url, { method: 'DELETE', headers: this.getHeaders() });
      return { success: true };
    } catch (error) {
      console.error('[deleteMessageLogsByDate] error:', error);
      return { success: false };
    }
  }

  async getGroupedMessageLogs(date) {
    try {
      const dateStart = `${date}T00:00:00.000Z`;
      const dateEnd   = `${date}T23:59:59.999Z`;
      const url = `${this.restUrl}/message_logs?select=batch_id,message,sent_at,user_id,recipient_phone,status,error,users(email,phone,company_name)&sent_at=gte.${dateStart}&sent_at=lte.${dateEnd}&order=sent_at.desc`;
      const res = await fetch(url, { headers: this.getHeaders() });
      const allLogs = await res.json();

      if (!Array.isArray(allLogs)) return { groups: [] };

      const grouped = {};
      allLogs.forEach(log => {
        const key = `${log.batch_id || 'no-batch'}_${log.user_id}_${log.message}`;
        if (!grouped[key]) {
          grouped[key] = {
            batch_id: log.batch_id,
            user_id: log.user_id,
            message: log.message,
            sent_at: log.sent_at,
            user: log.users || {},
            recipients: []
          };
        }
        grouped[key].recipients.push(log);
      });

      const groups = Object.values(grouped).map(group => ({
        batch_id: group.batch_id,
        user: group.user,
        message: group.message,
        sent_at: group.sent_at,
        recipientCount: group.recipients.length,
        sentCount: group.recipients.filter(r => r.status === 'sent').length,
        failedCount: group.recipients.filter(r => r.status === 'failed').length,
        recipients: group.recipients
      }));

      return { groups };
    } catch (error) {
      console.error('[getGroupedMessageLogs] error:', error);
      return { groups: [] };
    }
  }

  async getMessageLogsByBatch(batchId) {
    try {
      const url = `${this.restUrl}/message_logs?select=id,recipient_phone,message,status,error,sent_at,batch_id&batch_id=eq.${batchId}&order=sent_at.desc`;
      const res = await fetch(url, { headers: this.getHeaders() });
      const data = await res.json();
      return Array.isArray(data) ? data : [];
    } catch (error) {
      console.error('[getMessageLogsByBatch] error:', error);
      return [];
    }
  }
}

// Export singleton
export const adminAPI = new AdminAPI();
export default AdminAPI;
