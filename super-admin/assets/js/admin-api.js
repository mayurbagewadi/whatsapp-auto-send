/**
 * Admin API Wrapper for Supabase
 * Uses service_role key for full database access
 * Only runs locally - NEVER expose publicly
 */

import ADMIN_CONFIG from '../../config/admin-config.js';

class AdminAPI {
  constructor() {
    this.projectUrl = ADMIN_CONFIG.supabaseProjectUrl;
    this.apiKey = ADMIN_CONFIG.supabaseServiceRoleKey; // Full access key
    this.restUrl = `${this.projectUrl}/rest/v1`;
    this.rpcUrl = `${this.projectUrl}/rest/v1/rpc`;
  }

  /**
   * Build headers for API requests
   */
  getHeaders() {
    return {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${this.apiKey}`,
      'apikey': this.apiKey,
      'Prefer': 'return=representation'
    };
  }

  /**
   * Build query string from filters
   * Supports operators: eq, neq, gt, gte, lt, lte, in, like, ilike
   */
  buildQueryString(filters) {
    if (!filters || Object.keys(filters).length === 0) return '';

    return Object.entries(filters)
      .map(([key, value]) => {
        if (typeof value === 'object') {
          // Handle operator objects: { $gt: 100 }
          const operator = Object.keys(value)[0];
          const val = value[operator];
          return `${key}=${operator}.${encodeURIComponent(JSON.stringify(val))}`;
        }
        return `${key}=eq.${encodeURIComponent(JSON.stringify(value))}`;
      })
      .join('&');
  }

  /**
   * Make API request
   */
  async request(method, endpoint, data = null, filters = null) {
    const queryString = this.buildQueryString(filters);
    const url = queryString
      ? `${this.restUrl}/${endpoint}?${queryString}`
      : `${this.restUrl}/${endpoint}`;

    const options = {
      method,
      headers: this.getHeaders(),
    };

    if (data) {
      options.body = JSON.stringify(data);
    }

    try {
      const response = await fetch(url, options);
      const responseData = await response.json();

      if (!response.ok) {
        throw new Error(responseData.message || `API Error: ${response.status}`);
      }

      return responseData;
    } catch (error) {
      console.error('Admin API Error:', error);
      throw error;
    }
  }

  /**
   * Call PostgreSQL RPC function
   */
  async rpc(functionName, params = {}) {
    const url = `${this.rpcUrl}/${functionName}`;

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify(params),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || `RPC Error: ${response.status}`);
      }

      return data;
    } catch (error) {
      console.error('RPC Error:', error);
      throw error;
    }
  }

  // ============================================
  // USER MANAGEMENT
  // ============================================

  /**
   * Get all users with subscription info
   */
  async getAllUsers(limit = 100, offset = 0) {
    return this.request('GET', 'users', null, { limit, offset });
  }

  /**
   * Get single user by ID
   */
  async getUser(userId) {
    const response = await this.request('GET', `users?id=eq.${userId}`);
    return response[0] || null;
  }

  /**
   * Get user by email
   */
  async getUserByEmail(email) {
    const response = await this.request('GET', `users?email=eq.${email}`);
    return response[0] || null;
  }

  /**
   * Create new user
   */
  async createUser(userData) {
    const user = {
      email: userData.email,
      full_name: userData.full_name || '',
      subscription_plan_id: userData.subscription_plan_id || null,
      subscription_status: userData.subscription_status || 'active',
      is_active: userData.is_active !== false,
    };

    return this.request('POST', 'users', user);
  }

  /**
   * Update user
   */
  async updateUser(userId, updates) {
    return this.request('PATCH', `users?id=eq.${userId}`, updates);
  }

  /**
   * Suspend user
   */
  async suspendUser(userId, reason = '') {
    return this.updateUser(userId, {
      is_suspended: true,
      suspension_reason: reason,
      suspended_at: new Date().toISOString(),
    });
  }

  /**
   * Unsuspend user
   */
  async unsuspendUser(userId) {
    return this.updateUser(userId, {
      is_suspended: false,
      suspension_reason: null,
      suspended_at: null,
    });
  }

  /**
   * Delete user (soft delete)
   */
  async deleteUser(userId) {
    return this.updateUser(userId, { is_active: false });
  }

  // ============================================
  // SUBSCRIPTION MANAGEMENT
  // ============================================

  /**
   * Get all subscription plans
   */
  async getSubscriptionPlans() {
    return this.request('GET', 'subscription_plans?is_active=eq.true');
  }

  /**
   * Get subscription plan by ID
   */
  async getSubscriptionPlan(planId) {
    const response = await this.request('GET', `subscription_plans?id=eq.${planId}`);
    return response[0] || null;
  }

  /**
   * Create subscription plan
   */
  async createSubscriptionPlan(planData) {
    return this.request('POST', 'subscription_plans', planData);
  }

  /**
   * Update subscription plan
   */
  async updateSubscriptionPlan(planId, updates) {
    return this.request('PATCH', `subscription_plans?id=eq.${planId}`, updates);
  }

  /**
   * Get user subscription
   */
  async getUserSubscription(userId) {
    const response = await this.request('GET', `subscriptions?user_id=eq.${userId}`);
    return response[0] || null;
  }

  /**
   * Assign plan to user (creates/updates subscription)
   */
  async assignPlanToUser(userId, planId, billingCycle = 'monthly') {
    const plan = await this.getSubscriptionPlan(planId);
    if (!plan) throw new Error('Plan not found');

    const now = new Date();
    const endDate = new Date(now);
    endDate.setMonth(billingCycle === 'yearly' ? endDate.getMonth() + 12 : endDate.getMonth() + 1);

    const subscriptionData = {
      user_id: userId,
      plan_id: planId,
      status: 'active',
      billing_cycle: billingCycle,
      current_period_start: now.toISOString(),
      current_period_end: endDate.toISOString(),
      amount: billingCycle === 'yearly' ? plan.price_yearly : plan.price_monthly,
      auto_renew: true,
    };

    // Check if subscription exists
    const existing = await this.getUserSubscription(userId);

    if (existing) {
      return this.request('PATCH', `subscriptions?id=eq.${existing.id}`, subscriptionData);
    } else {
      return this.request('POST', 'subscriptions', subscriptionData);
    }
  }

  /**
   * Cancel subscription
   */
  async cancelSubscription(subscriptionId) {
    return this.request('PATCH', `subscriptions?id=eq.${subscriptionId}`, {
      status: 'cancelled',
      cancelled_at: new Date().toISOString(),
      auto_renew: false,
    });
  }

  /**
   * Get payment history for user
   */
  async getUserPayments(userId) {
    return this.request('GET', `payments?user_id=eq.${userId}&order=created_at.desc`);
  }

  // ============================================
  // USAGE TRACKING
  // ============================================

  /**
   * Get user usage logs
   */
  async getUserUsageLogs(userId, logType = null, limit = 100) {
    let filters = { user_id: userId };
    if (logType) filters.log_type = logType;

    return this.request('GET', 'usage_logs?order=created_at.desc', null, filters);
  }

  /**
   * Get daily usage for user
   */
  async getDailyUsage(userId, logDate) {
    return this.request('GET', `usage_logs?user_id=eq.${userId}&log_date=eq.${logDate}`);
  }

  /**
   * Get monthly usage summary for user
   */
  async getMonthlyUsageSummary(userId, year, month) {
    const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
    const endDate = new Date(year, month, 0).toISOString().split('T')[0];

    const response = await this.request(
      'GET',
      `usage_logs?user_id=eq.${userId}&log_date=gte.${startDate}&log_date=lte.${endDate}`
    );

    // Aggregate by log type
    const summary = {};
    response.forEach(log => {
      if (!summary[log.log_type]) {
        summary[log.log_type] = 0;
      }
      summary[log.log_type] += log.count;
    });

    return summary;
  }

  /**
   * Check if user has exceeded limits
   */
  async checkUsageLimits(userId) {
    return this.rpc('check_usage_limits', { p_user_id: userId });
  }

  /**
   * Record usage event (increment daily count)
   */
  async recordUsage(userId, logType, count = 1) {
    return this.rpc('record_usage', {
      p_user_id: userId,
      p_log_type: logType,
      p_count: count
    });
  }

  // ============================================
  // DASHBOARD & ANALYTICS
  // ============================================

  /**
   * Get dashboard statistics
   */
  async getDashboardStats() {
    return this.rpc('get_admin_dashboard_stats', {});
  }

  /**
   * Get total users count
   */
  async getUsersCount(isActive = null) {
    let filters = {};
    if (isActive !== null) filters.is_active = isActive;

    const response = await this.request('GET', 'users', null, filters);
    return response.length;
  }

  /**
   * Get active subscriptions count
   */
  async getActiveSubscriptionsCount() {
    const response = await this.request('GET', 'subscriptions?status=eq.active');
    return response.length;
  }

  /**
   * Get revenue for date range
   */
  async getRevenueByDateRange(startDate, endDate) {
    const response = await this.request(
      'GET',
      `payments?status=eq.completed&created_at=gte.${startDate}&created_at=lte.${endDate}`
    );

    return response.reduce((sum, payment) => sum + parseFloat(payment.amount || 0), 0);
  }

  // ============================================
  // AUDIT LOGGING
  // ============================================

  /**
   * Log admin action
   */
  async logAuditAction(adminUserId, action, targetUserId, oldValues, newValues) {
    const auditLog = {
      admin_user_id: adminUserId,
      action,
      target_user_id: targetUserId,
      old_values: oldValues,
      new_values: newValues,
      ip_address: await this.getClientIp(),
      user_agent: navigator.userAgent,
    };

    return this.request('POST', 'admin_audit_logs', auditLog);
  }

  /**
   * Get audit logs
   */
  async getAuditLogs(limit = 100) {
    return this.request('GET', `admin_audit_logs?order=created_at.desc&limit=${limit}`);
  }

  /**
   * Get audit logs for specific user action
   */
  async getAuditLogsForUser(targetUserId) {
    return this.request('GET', `admin_audit_logs?target_user_id=eq.${targetUserId}&order=created_at.desc`);
  }

  /**
   * Get client IP address (approximate)
   */
  async getClientIp() {
    try {
      const response = await fetch('https://api.ipify.org?format=json');
      const data = await response.json();
      return data.ip;
    } catch (error) {
      return 'unknown';
    }
  }

  // ============================================
  // UTILITY METHODS
  // ============================================

  /**
   * Test connection to Supabase
   */
  async testConnection() {
    try {
      const response = await fetch(`${this.restUrl}`, {
        headers: this.getHeaders(),
      });
      return response.ok;
    } catch (error) {
      console.error('Connection test failed:', error);
      return false;
    }
  }

  /**
   * Get API status
   */
  async getStatus() {
    try {
      const stats = await this.getDashboardStats();
      return {
        status: 'healthy',
        timestamp: Date.now(),
        stats
      };
    } catch (error) {
      return {
        status: 'error',
        timestamp: Date.now(),
        error: error.message
      };
    }
  }

  // ============================================
  // EXTENSION SYNC METHODS
  // ============================================

  /**
   * Get active extension users (online in last 5 minutes)
   */
  async getActiveExtensionUsers() {
    try {
      return await this.rpc('get_active_extension_users', {});
    } catch (error) {
      console.error('Error fetching active users:', error);
      return [];
    }
  }

  /**
   * Get user subscription info (for extension)
   */
  async getUserSubscriptionInfo(userId) {
    try {
      return await this.rpc('get_user_subscription_info', {
        p_user_id: userId
      });
    } catch (error) {
      console.error('Error fetching subscription info:', error);
      return null;
    }
  }

  /**
   * Get daily usage for user
   */
  async getUserDailyUsage(userId) {
    try {
      return await this.rpc('get_daily_usage_all', {
        p_user_id: userId
      });
    } catch (error) {
      console.error('Error fetching daily usage:', error);
      return [];
    }
  }

  /**
   * Get extension activity stats
   */
  async getExtensionActivityStats() {
    try {
      // Get active users count
      const activeUsers = await this.getActiveExtensionUsers();

      // Get total session count today
      const sessionLogs = await this.request(
        'GET',
        `usage_logs?log_type=eq.extension_session&log_date=eq.${new Date().toISOString().split('T')[0]}`
      );

      return {
        activeUsers: activeUsers.length,
        totalSessions: Array.isArray(sessionLogs) ? sessionLogs.length : 0,
        onlineNow: activeUsers,
        lastUpdate: new Date().toISOString()
      };
    } catch (error) {
      console.error('Error fetching activity stats:', error);
      return {
        activeUsers: 0,
        totalSessions: 0,
        onlineNow: [],
        error: error.message
      };
    }
  }

  /**
   * Get user extension activity timeline
   */
  async getUserExtensionActivity(userId, days = 7) {
    try {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);
      const startDateStr = startDate.toISOString().split('T')[0];

      const response = await this.request(
        'GET',
        `usage_logs?user_id=eq.${userId}&log_date=gte.${startDateStr}&order=created_at.desc`
      );

      return Array.isArray(response) ? response : [];
    } catch (error) {
      console.error('Error fetching user activity:', error);
      return [];
    }
  }

  /**
   * Get real-time extension metrics
   */
  async getRealTimeMetrics() {
    try {
      const today = new Date().toISOString().split('T')[0];

      // Get today's message count
      const messageLogs = await this.request(
        'GET',
        `usage_logs?log_type=eq.message_sent&log_date=eq.${today}`
      );

      // Get today's campaign count
      const campaignLogs = await this.request(
        'GET',
        `usage_logs?log_type=eq.campaign_created&log_date=eq.${today}`
      );

      // Get today's contact imports
      const contactLogs = await this.request(
        'GET',
        `usage_logs?log_type=eq.contact_imported&log_date=eq.${today}`
      );

      const messagesToday = messageLogs.reduce((sum, log) => sum + (log.count || 0), 0);
      const campaignToday = campaignLogs.reduce((sum, log) => sum + (log.count || 0), 0);
      const contactsToday = contactLogs.reduce((sum, log) => sum + (log.count || 0), 0);

      return {
        messagesToday,
        campaignToday,
        contactsToday,
        activeUsers: (await this.getActiveExtensionUsers()).length,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      console.error('Error fetching real-time metrics:', error);
      return {
        messagesToday: 0,
        campaignToday: 0,
        contactsToday: 0,
        activeUsers: 0,
        error: error.message
      };
    }
  }

  /**
   * Record a limit violation for a user
   */
  async recordViolation(userId, actionType) {
    try {
      const result = await this.rpcCall('record_limit_violation', {
        p_user_id: userId,
        p_action_type: actionType
      });

      console.log('Violation recorded:', result);
      return result;
    } catch (error) {
      console.error('Error recording violation:', error);
      throw error;
    }
  }

  /**
   * Get violations for a specific user
   */
  async getUserViolations(userId, days = 7) {
    try {
      const violations = await this.rpcCall('get_user_violations', {
        p_user_id: userId,
        p_days: days
      });

      return violations || [];
    } catch (error) {
      console.error('Error fetching user violations:', error);
      return [];
    }
  }

  /**
   * Get all violations across all users (admin)
   */
  async getAllViolations(limit = 100, days = 7) {
    try {
      const violations = await this.rpcCall('get_all_violations', {
        p_limit: limit,
        p_days: days
      });

      return violations || [];
    } catch (error) {
      console.error('Error fetching all violations:', error);
      return [];
    }
  }

  /**
   * Get violation statistics
   */
  async getViolationStats() {
    try {
      const violations = await this.request('GET', 'limit_violations');

      if (!violations || violations.length === 0) {
        return {
          totalViolations: 0,
          usersWithViolations: 0,
          topActions: [],
          violation_summary: 'No violations recorded'
        };
      }

      const usersSet = new Set(violations.map(v => v.user_id));
      const actionCounts = {};

      violations.forEach(v => {
        actionCounts[v.action_type] = (actionCounts[v.action_type] || 0) + 1;
      });

      const topActions = Object.entries(actionCounts)
        .sort((a, b) => b[1] - a[1])
        .map(([action, count]) => ({ action, count }));

      return {
        totalViolations: violations.length,
        usersWithViolations: usersSet.size,
        topActions,
        lastViolation: violations[0]?.violation_at
      };
    } catch (error) {
      console.error('Error fetching violation stats:', error);
      return {
        totalViolations: 0,
        usersWithViolations: 0,
        topActions: [],
        error: error.message
      };
    }
  }

  /**
   * Check if user can perform action (with limit check)
   */
  async canPerformAction(userId, actionType) {
    try {
      const result = await this.rpcCall('can_perform_action', {
        p_user_id: userId,
        p_action_type: actionType
      });

      return result && result[0];
    } catch (error) {
      console.error('Error checking action limit:', error);
      return null;
    }
  }

  /**
   * Get daily revenue for last N days
   */
  async getDailyRevenue(days = 30) {
    try {
      const data = await this.request('GET', 'payments?status=eq.completed&select=paid_at,amount');

      const revenueByDay = {};
      data.forEach(payment => {
        if (!payment.paid_at) return;
        const day = payment.paid_at.split('T')[0];
        revenueByDay[day] = (revenueByDay[day] || 0) + (payment.amount || 0);
      });

      // Generate last N days
      const result = [];
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);

      for (let i = 0; i < days; i++) {
        const date = new Date(startDate);
        date.setDate(date.getDate() + i);
        const dateStr = date.toISOString().split('T')[0];
        result.push({
          date: dateStr,
          revenue: revenueByDay[dateStr] || 0
        });
      }

      return result;
    } catch (error) {
      console.error('Error fetching daily revenue:', error);
      return [];
    }
  }

  /**
   * Get monthly revenue for last N months
   */
  async getMonthlyRevenue(months = 12) {
    try {
      const data = await this.request('GET', 'payments?status=eq.completed&select=paid_at,amount');

      const revenueByMonth = {};
      data.forEach(payment => {
        if (!payment.paid_at) return;
        const month = payment.paid_at.substring(0, 7); // YYYY-MM
        revenueByMonth[month] = (revenueByMonth[month] || 0) + (payment.amount || 0);
      });

      // Generate last N months
      const result = [];
      const startDate = new Date();
      startDate.setMonth(startDate.getMonth() - months);

      for (let i = 0; i < months; i++) {
        const date = new Date(startDate);
        date.setMonth(date.getMonth() + i);
        const monthStr = date.getFullYear() + '-' + String(date.getMonth() + 1).padStart(2, '0');
        result.push({
          month: monthStr,
          revenue: revenueByMonth[monthStr] || 0
        });
      }

      return result;
    } catch (error) {
      console.error('Error fetching monthly revenue:', error);
      return [];
    }
  }

  /**
   * Get revenue by plan
   */
  async getRevenueByPlan() {
    try {
      const plans = await this.request('GET', 'subscription_plans?select=id,name');
      const payments = await this.request('GET', 'payments?status=eq.completed&select=subscription_id,amount');
      const subscriptions = await this.request('GET', 'subscriptions?select=id,plan_id');

      // Map subscriptions to plans
      const planMap = {};
      plans.forEach(plan => {
        planMap[plan.id] = { name: plan.name, revenue: 0 };
      });

      // Map payments to plans
      subscriptions.forEach(sub => {
        const plan = planMap[sub.plan_id];
        if (plan) {
          const subPayments = payments.filter(p => p.subscription_id === sub.id);
          plan.revenue += subPayments.reduce((sum, p) => sum + (p.amount || 0), 0);
        }
      });

      return Object.entries(planMap).map(([id, data]) => ({
        plan: data.name,
        revenue: data.revenue
      }));
    } catch (error) {
      console.error('Error fetching revenue by plan:', error);
      return [];
    }
  }

  /**
   * Get user signup trends
   */
  async getUserSignupTrends(days = 30) {
    try {
      const data = await this.request('GET', 'users?select=created_at');

      const signupsByDay = {};
      data.forEach(user => {
        if (!user.created_at) return;
        const day = user.created_at.split('T')[0];
        signupsByDay[day] = (signupsByDay[day] || 0) + 1;
      });

      // Generate cumulative signups
      const result = [];
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);
      let cumulativeSignups = 0;

      for (let i = 0; i < days; i++) {
        const date = new Date(startDate);
        date.setDate(date.getDate() + i);
        const dateStr = date.toISOString().split('T')[0];
        cumulativeSignups += signupsByDay[dateStr] || 0;
        result.push({
          date: dateStr,
          signups: signupsByDay[dateStr] || 0,
          cumulative: cumulativeSignups
        });
      }

      return result;
    } catch (error) {
      console.error('Error fetching user signup trends:', error);
      return [];
    }
  }

  /**
   * Get plan distribution
   */
  async getPlanDistribution() {
    try {
      const data = await this.request('GET', 'users?select=subscription_plan_id');
      const plans = await this.request('GET', 'subscription_plans?select=id,name');

      const planMap = {};
      plans.forEach(plan => {
        planMap[plan.id] = { name: plan.name, count: 0 };
      });

      data.forEach(user => {
        if (planMap[user.subscription_plan_id]) {
          planMap[user.subscription_plan_id].count++;
        }
      });

      return Object.entries(planMap).map(([id, data]) => ({
        plan: data.name,
        users: data.count
      }));
    } catch (error) {
      console.error('Error fetching plan distribution:', error);
      return [];
    }
  }

  /**
   * Get message volume trends
   */
  async getMessageVolumeTrends(days = 30) {
    try {
      const today = new Date();
      const startDate = new Date(today);
      startDate.setDate(startDate.getDate() - days);

      const result = [];
      for (let i = 0; i < days; i++) {
        const date = new Date(startDate);
        date.setDate(date.getDate() + i);
        const dateStr = date.toISOString().split('T')[0];

        const logs = await this.request('GET',
          `usage_logs?log_type=eq.message_sent&log_date=eq.${dateStr}&select=count`
        );

        const totalMessages = logs.reduce((sum, log) => sum + (log.count || 0), 0);
        result.push({
          date: dateStr,
          messages: totalMessages
        });
      }

      return result;
    } catch (error) {
      console.error('Error fetching message volume trends:', error);
      return [];
    }
  }

  /**
   * Get top users by message volume
   */
  async getTopUsersByMessages(limit = 10) {
    try {
      const logs = await this.request('GET', 'usage_logs?log_type=eq.message_sent&select=user_id,count');
      const users = await this.request('GET', 'users?select=id,email,full_name');

      // Aggregate by user
      const userMessages = {};
      logs.forEach(log => {
        userMessages[log.user_id] = (userMessages[log.user_id] || 0) + (log.count || 0);
      });

      // Sort and map
      return Object.entries(userMessages)
        .sort((a, b) => b[1] - a[1])
        .slice(0, limit)
        .map(([userId, count]) => {
          const user = users.find(u => u.id === userId);
          return {
            email: user?.email || 'Unknown',
            messages: count
          };
        });
    } catch (error) {
      console.error('Error fetching top users:', error);
      return [];
    }
  }

  // ─── Message Logs ────────────────────────────────────────────────────────

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
      console.error('Error fetching message logs:', error);
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
      console.error('Error fetching all logs by date:', error);
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
      console.error('Error deleting message logs:', error);
      return { success: false };
    }
  }

  /**
   * Get active vs inactive users count
   */
  async getActiveInactiveUsers() {
    try {
      const users = await this.request('GET', 'users?select=id,is_active,is_suspended');

      const active = users.filter(u => u.is_active && !u.is_suspended).length;
      const inactive = users.filter(u => !u.is_active || u.is_suspended).length;

      return {
        active,
        inactive,
        total: users.length
      };
    } catch (error) {
      console.error('Error fetching active/inactive users:', error);
      return { active: 0, inactive: 0, total: 0 };
    }
  }
}

// Export singleton instance
export const adminAPI = new AdminAPI();
export default AdminAPI;
