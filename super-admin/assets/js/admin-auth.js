/**
 * Admin Authentication System
 * Authenticates via Backend API (secure)
 */

import ADMIN_CONFIG from '../../config/admin-config.js';

class AdminAuth {
  constructor() {
    this.sessionKey      = ADMIN_CONFIG.sessionStorageKey  || 'admin_session_token';
    this.sessionDurationMs = ADMIN_CONFIG.sessionDurationMs || (8 * 60 * 60 * 1000);
    this.projectUrl      = ADMIN_CONFIG.supabaseProjectUrl;
    this.apiKey          = ADMIN_CONFIG.supabaseServiceRoleKey;
    this.restUrl         = `${this.projectUrl}/rest/v1`;
  }

  /**
   * Get headers for API requests
   */
  getHeaders() {
    const token = this.getToken();
    const headers = {
      'Content-Type': 'application/json',
    };

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    return headers;
  }

  /**
   * Get stored JWT token
   */
  getToken() {
    const sessionData = localStorage.getItem(this.sessionKey);
    if (!sessionData) return null;

    try {
      const session = JSON.parse(sessionData);
      return session.token;
    } catch {
      return null;
    }
  }

  /**
   * Attempt admin login via Backend API
   * Returns: { success: boolean, message: string, admin?: object }
   */
  async hashPassword(password) {
    const encoder = new TextEncoder();
    const data = encoder.encode(password);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }

  async login(email, password) {
    if (!email || !password) {
      return { success: false, message: 'Email and password are required' };
    }

    try {
      // Query admin_users table directly via Supabase REST API
      const response = await fetch(
        `${this.restUrl}/admin_users?email=eq.${encodeURIComponent(email)}&select=id,email,role,password_hash`,
        {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.apiKey}`,
            'apikey': this.apiKey
          }
        }
      );

      if (!response.ok) {
        return { success: false, message: 'Authentication service unavailable' };
      }

      const users = await response.json();

      if (!users || users.length === 0) {
        return { success: false, message: 'Invalid credentials' };
      }

      const admin = users[0];

      // Verify password (SHA-256)
      const inputHash = await this.hashPassword(password);
      if (admin.password_hash !== inputHash) {
        return { success: false, message: 'Invalid credentials' };
      }

      // Store session
      const sessionToken = {
        token: this.apiKey,
        adminId: admin.id,
        email: admin.email,
        role: admin.role,
        timestamp: Date.now(),
        expires: Date.now() + this.sessionDurationMs
      };

      localStorage.setItem(this.sessionKey, JSON.stringify(sessionToken));

      this.logAuditEvent('admin_login_success', {
        adminId: admin.id,
        email: admin.email,
        timestamp: new Date().toISOString()
      });

      return {
        success: true,
        message: 'Successfully logged in',
        admin: { id: admin.id, email: admin.email, role: admin.role },
        sessionExpires: sessionToken.expires
      };

    } catch (error) {
      console.error('Login error:', error);
      return { success: false, message: 'Login failed: ' + (error.message || 'Network error') };
    }
  }

  /**
   * Get current admin info
   */
  getCurrentAdmin() {
    const sessionData = localStorage.getItem(this.sessionKey);

    if (!sessionData) {
      return null;
    }

    try {
      const session = JSON.parse(sessionData);
      return {
        id: session.adminId,
        email: session.email,
        role: session.role,
        fullName: session.fullName
      };
    } catch (error) {
      return null;
    }
  }

  /**
   * Check if admin is authenticated
   */
  isAuthenticated() {
    const sessionData = localStorage.getItem(this.sessionKey);

    if (!sessionData) {
      return false;
    }

    try {
      const session = JSON.parse(sessionData);

      // Check if session has expired
      if (Date.now() > session.expires) {
        localStorage.removeItem(this.sessionKey);
        return false;
      }

      return true;
    } catch (error) {
      console.error('Session validation error:', error);
      localStorage.removeItem(this.sessionKey);
      return false;
    }
  }

  /**
   * Get remaining session time in milliseconds
   */
  getSessionTimeRemaining() {
    const sessionData = localStorage.getItem(this.sessionKey);

    if (!sessionData) {
      return 0;
    }

    try {
      const session = JSON.parse(sessionData);
      const remaining = session.expires - Date.now();
      return Math.max(0, remaining);
    } catch (error) {
      return 0;
    }
  }

  /**
   * Get formatted session expiry time
   */
  getSessionExpiryTime() {
    const remaining = this.getSessionTimeRemaining();
    if (remaining === 0) return null;

    const hours = Math.floor(remaining / (1000 * 60 * 60));
    const minutes = Math.floor((remaining % (1000 * 60 * 60)) / (1000 * 60));

    return `${hours}h ${minutes}m`;
  }

  /**
   * Logout admin session
   */
  logout() {
    const admin = this.getCurrentAdmin();
    localStorage.removeItem(this.sessionKey);

    if (admin) {
      this.logAuditEvent('admin_logout', {
        adminId: admin.id,
        email: admin.email,
        timestamp: new Date().toISOString()
      });
    }
  }

  /**
   * Refresh session (extend expiry)
   */
  refreshSession() {
    if (!this.isAuthenticated()) {
      return false;
    }

    const sessionData = localStorage.getItem(this.sessionKey);

    try {
      const session = JSON.parse(sessionData);

      const updatedSession = {
        ...session,
        timestamp: Date.now(),
        expires: Date.now() + this.sessionDurationMs,
        nonce: Math.random().toString(36).substring(2, 15)
      };

      localStorage.setItem(this.sessionKey, JSON.stringify(updatedSession));
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Log audit event — writes to Supabase admin_activity_log
   */
  logAuditEvent(action, data) {
    const actionTypeMap = {
      'admin_login_success': 'login',
      'admin_logout':        'logout',
      'create_user':         'create_user',
      'update_user':         'update_user',
      'delete_user':         'delete_user',
      'update_selector':     'update_selector',
      'update_plan':         'update_plan',
      'view_analytics':      'view_analytics'
    };

    const payload = {
      action_type: actionTypeMap[action] || 'login',
      admin_email: data.email || 'unknown',
      admin_id:    data.adminId || null,
      new_value:   data
    };

    // Fire-and-forget — don't block login/logout flow
    fetch(`${this.restUrl}/admin_activity_log`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`,
        'apikey': this.apiKey,
        'Prefer': 'return=minimal'
      },
      body: JSON.stringify(payload)
    }).then(() => {}).catch(() => {}); // silent — table may not exist yet
  }

  /**
   * Get audit log from Supabase admin_activity_log
   */
  async getAuditLog(limit = 10) {
    try {
      const response = await fetch(
        `${this.restUrl}/admin_activity_log?select=*&order=created_at.desc&limit=${limit}`,
        {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.apiKey}`,
            'apikey': this.apiKey
          }
        }
      );
      if (!response.ok) return [];
      const logs = await response.json();
      // Map to format expected by dashboard displayRecentActivity()
      return (logs || []).map(log => ({
        action:         log.action_type,
        target_user_id: log.target_id,
        created_at:     log.created_at,
        data:           log.new_value
      }));
    } catch { return []; }
  }
}

// Export singleton instance
export const adminAuth = new AdminAuth();
export default AdminAuth;
