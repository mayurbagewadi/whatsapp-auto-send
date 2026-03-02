// ===== Config =====
const SUPABASE_URL = 'https://isfaiawbywrtwvinkizb.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlzZmFpYXdieXdydHd2aW5raXpiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzEyMzIyMTQsImV4cCI6MjA4NjgwODIxNH0.DkuRC5vRmuXlds-z1TvTHj2pQsoFSsqPEINOlnaN2n0'; // Replace with key from Supabase Dashboard → Project Settings → API

// ===== Queue State =====
let queue = [];
let currentIndex = 0;
let isRunning = false;
let isPaused = false;
let delaySec = 10;
let randomize = true;
let stats = { sent: 0, failed: 0, total: 0 };
let whatsappTabId = null;
let authToken = null;
let userStats = null;
let batchId = null;

// ===== API Functions =====

async function apiRequest(endpoint, options = {}) {
  const headers = {
    'Content-Type': 'application/json',
    'apikey': SUPABASE_ANON_KEY,
    'Authorization': `Bearer ${authToken || SUPABASE_ANON_KEY}`
  };

  const tokenUsed = authToken || SUPABASE_ANON_KEY;
  let tokenType = 'ANON_KEY (no authToken)';
  if (authToken) {
    try {
      const pad = s => s + '='.repeat((4 - s.length % 4) % 4);
      const p = JSON.parse(atob(pad(authToken.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'))));
      tokenType = p.userId ? `USER_JWT (userId=${p.userId}, exp=${new Date(p.exp*1000).toISOString()})` : `UNKNOWN_JWT (keys=${Object.keys(p).join(',')})`;
    } catch(e) { tokenType = 'DECODE_FAILED'; }
  }
  console.log(`[API] ${endpoint} | tokenType: ${tokenType}`);
  const response = await fetch(`${SUPABASE_URL}/functions/v1${endpoint}`, { ...options, headers });
  const text = await response.text();
  console.log(`[API] ${endpoint} → HTTP ${response.status} | body: ${text}`);

  // Token rejected by server — clear it and force re-login
  if (response.status === 401) {
    authToken = null;
    await chrome.storage.local.remove(['authToken', 'userStats', 'authenticated']);
    chrome.runtime.sendMessage({ action: 'sessionExpired' }).catch(() => {});
    return { success: false, error: 'Session expired. Please login again.', sessionExpired: true };
  }

  try {
    return JSON.parse(text);
  } catch {
    return { success: false, error: `Non-JSON response (${response.status}): ${text.slice(0, 200)}` };
  }
}

// Signup new user
async function signup(email, phone, password, company_name) {
  try {
    const data = await fetch(`${SUPABASE_URL}/functions/v1/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'apikey': SUPABASE_ANON_KEY, 'Authorization': `Bearer ${SUPABASE_ANON_KEY}` },
      body: JSON.stringify({ email, phone, password, company_name })
    }).then(r => r.json());

    if (data.success) {
      authToken = data.token;
      userStats = data.user;
      await chrome.storage.local.set({ authToken: data.token, userStats: data.user, authenticated: true });
      await fetchSelectors();
      return { success: true, stats: data.user };
    }

    return { success: false, error: data.error || 'Signup failed' };
  } catch (e) {
    console.error('[Background] Signup error:', e);
    return { success: false, error: 'Cannot connect to server.' };
  }
}

// Login existing user
async function login(email, password) {
  try {
    const data = await fetch(`${SUPABASE_URL}/functions/v1/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'apikey': SUPABASE_ANON_KEY, 'Authorization': `Bearer ${SUPABASE_ANON_KEY}` },
      body: JSON.stringify({ email, password })
    }).then(r => r.json());

    if (data.success) {
      authToken = data.token;
      userStats = data.user;
      await chrome.storage.local.set({ authToken: data.token, userStats: data.user, authenticated: true });
      await fetchSelectors();
      return { success: true, stats: data.user };
    }

    return { success: false, error: data.error || 'Invalid credentials' };
  } catch (e) {
    console.error('[Background] Login error:', e);
    return { success: false, error: 'Cannot connect to server.' };
  }
}

// Logout user
async function logout() {
  authToken = null;
  userStats = null;
  chrome.alarms.clear('statsRefresh');
  await chrome.storage.local.remove(['authToken', 'userStats', 'authenticated', 'selectors']);
}

// Fetch selectors from backend and store locally (no auth required - public endpoint)
async function fetchSelectors() {
  try {
    const data = await apiRequest('/get-selectors');
    if (data.success && data.selectors) {
      await chrome.storage.local.set({ selectors: data.selectors, selectorsVersion: data.version });
      console.log('[Background] Selectors updated from Supabase');
    }
  } catch (e) {
    console.warn('[Background] Could not fetch selectors, using cached:', e.message);
  }
}

// Track an event to the backend
async function trackEvent(eventType, extraData = {}) {
  if (!authToken) return;

  try {
    await apiRequest('/track-event', {
      method: 'POST',
      body: JSON.stringify({ eventType, ...extraData })
    });
  } catch (e) {
    console.warn('[Background] Tracking failed (non-fatal):', e.message);
  }
}

// Restore authToken from storage if service worker restarted and wiped memory
async function restoreAuth() {
  if (!authToken) {
    const stored = await chrome.storage.local.get(['authToken']);
    if (stored.authToken) {
      authToken = stored.authToken;
      // Decode payload to confirm what token is stored
      try {
        const payload = JSON.parse(atob(authToken.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
        console.log('[restoreAuth] token payload:', JSON.stringify(payload));
      } catch (e) {
        console.error('[restoreAuth] failed to decode token payload:', e.message);
      }
    } else {
      console.warn('[restoreAuth] no authToken found in storage');
    }
  }
}

// Check if user has remaining message quota — always fetches live from Supabase
async function checkMessageLimitFromAPI() {
  await restoreAuth();
  if (!authToken) {
    console.error('[Limit] No authToken in memory');
    return { allowed: false, error: 'Not authenticated.' };
  }

  try {
    const data = await apiRequest('/get-stats');
    console.log('[Limit] /get-stats response:', JSON.stringify(data));

    if (!data.success) {
      console.error('[Limit] API returned success:false —', data.error);
      return { allowed: false, error: data.error || 'Could not verify plan limit. Please try again.' };
    }

    const limit     = data.stats.messagesLimit     ?? 10;
    const sent      = data.stats.messagesSentToday ?? 0;
    const remaining = Math.max(0, limit - sent);
    console.log(`[Limit] plan=${data.stats.plan} limit=${limit} sent=${sent} remaining=${remaining}`);

    if (remaining <= 0) {
      return { allowed: false, error: `Daily limit reached (${limit} messages/day). Resets tomorrow.` };
    }
    return { allowed: true, remaining };

  } catch (e) {
    console.error('[Limit] apiRequest threw:', e.message);
    return { allowed: false, error: 'Could not verify plan limit. Please try again.' };
  }
}

// ===== Message Listener =====
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('[Background] Received message:', request.action);

  if (request.action === 'signup') {
    signup(request.data.email, request.data.phone, request.data.password, request.data.company_name).then(sendResponse);
    return true;
  }

  if (request.action === 'updateCompany') {
    (async () => {
      try {
        await restoreAuth();
        if (!authToken) { sendResponse({ success: false, error: 'Not authenticated' }); return; }
        const data = await fetch(`${SUPABASE_URL}/functions/v1/update-company`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'apikey': SUPABASE_ANON_KEY, 'Authorization': `Bearer ${authToken}` },
          body: JSON.stringify({ company_name: request.data.company_name })
        }).then(r => r.json());
        sendResponse(data);
      } catch (e) {
        sendResponse({ success: false, error: 'Cannot connect to server.' });
      }
    })();
    return true;
  }

  if (request.action === 'login') {
    login(request.data.email, request.data.password).then(sendResponse);
    return true;
  }

  if (request.action === 'logout') {
    logout().then(() => sendResponse({ success: true }));
    return true;
  }

  if (request.action === 'getAuthStatus') {
    chrome.storage.local.get(['authToken', 'userStats', 'authenticated'], (data) => {
      sendResponse({
        authenticated: data.authenticated || false,
        token: data.authToken,
        stats: data.userStats
      });
    });
    return true;
  }

  if (request.action === 'checkMediaFeature') {
    chrome.storage.local.get(['userStats'], (data) => {
      const allowed = data.userStats?.mediaUploadEnabled ?? false;
      sendResponse({ allowed, message: allowed ? 'Media upload enabled' : 'Media upload not available in your plan' });
    });
    return true;
  }

  if (request.action === 'updateMediaFeatureSettings') {
    // This is called from super-admin panel to configure media features per plan
    const settings = request.data;
    chrome.storage.local.set({ mediaFeatureSettings: settings }, () => {
      sendResponse({ success: true, message: 'Media feature settings updated' });
    });
    return true;
  }

  if (request.action === 'syncSubscriptionPlans') {
    // Called from super-admin panel to sync all subscription plans with media features
    const plans = request.data?.plans || [];
    chrome.storage.local.set({ subscriptionPlans: plans }, () => {
      sendResponse({ success: true, message: `${plans.length} subscription plans synced` });
    });
    return true;
  }

  if (request.action === 'refreshStats') {
    (async () => {
      try {
        if (!authToken) {
          const stored = await chrome.storage.local.get(['authToken']);
          if (stored.authToken) authToken = stored.authToken;
        }
        if (!authToken) { sendResponse({ success: false }); return; }

        const data = await apiRequest('/get-stats');
        if (data.success) {
          sendResponse({ success: true, stats: data.stats });
        } else {
          sendResponse({ success: false });
        }
      } catch (e) {
        console.warn('[Background] refreshStats failed:', e.message);
        sendResponse({ success: false });
      }
    })();
    return true;
  }

  if (request.action === 'startQueue') {
    handleStartQueue(request.data, sendResponse);
    return true;
  }

  if (request.action === 'pauseQueue') {
    isPaused = !isPaused;
    sendResponse({ success: true, paused: isPaused });
    return true;
  }

  if (request.action === 'stopQueue') {
    handleStopQueue(sendResponse);
    return true;
  }

  if (request.action === 'whatsappReady') {
    whatsappTabId = sender.tab ? sender.tab.id : null;
    sendResponse({ success: true });
    return true;
  }

  if (request.action === 'messageSent') {
    handleMessageSent(request.data);
    sendResponse({ success: true });
    return true;
  }

  if (request.action === 'messageFailed') {
    handleMessageFailed(request.data);
    sendResponse({ success: true });
    return true;
  }
});

// ===== Background Stats Refresh (popup display only) =====
const STATS_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

async function refreshStatsBackground(forceRefresh = false) {
  try {
    if (!authToken) {
      const stored = await chrome.storage.local.get(['authToken']);
      if (stored.authToken) authToken = stored.authToken;
    }
    if (!authToken) return;

    // Check TTL cache — skip API if data is still fresh
    if (!forceRefresh) {
      const cached = await chrome.storage.local.get(['statsCacheTime']);
      if (cached.statsCacheTime && (Date.now() - cached.statsCacheTime) < STATS_CACHE_TTL) {
        const stored = await chrome.storage.local.get(['userStats']);
        if (stored.userStats) {
          chrome.runtime.sendMessage({ action: 'statsUpdated', stats: stored.userStats }).catch(() => {});
          return; // Use cached data, skip API call
        }
      }
    }

    const data = await apiRequest('/get-stats');
    if (data.success) {
      const stored = await chrome.storage.local.get(['userStats']);
      const updatedStats = { ...(stored.userStats || {}), ...data.stats, mediaUploadEnabled: data.stats.mediaUploadEnabled ?? false };
      await chrome.storage.local.set({ userStats: updatedStats, statsCacheTime: Date.now() });
      chrome.runtime.sendMessage({ action: 'statsUpdated', stats: data.stats }).catch(() => {});
    }
  } catch (e) {
    // Non-fatal — silently skip
  }
}

// ===== Alarm Listener =====
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'sendNext') {
    sendNextMessage();
  }
  if (alarm.name === 'statsRefresh') {
    refreshStatsBackground();
  }
});

// ===== Queue Functions =====

async function handleStartQueue(data, sendResponse) {
  // Restore auth token from storage if not in memory
  if (!authToken) {
    const stored = await chrome.storage.local.get(['authToken']);
    if (stored.authToken) authToken = stored.authToken;
  }
  console.log('[startQueue] authToken after restore:', authToken ? `SET (starts: ${authToken.slice(0, 20)}...)` : 'NULL — not in storage');

  // Check message limit before starting
  const limitCheck = await checkMessageLimitFromAPI();
  if (!limitCheck.allowed) {
    sendResponse({ success: false, error: limitCheck.error });
    return;
  }

  // Cap queue at remaining limit
  let queueData = data.queue;
  if (limitCheck.remaining != null && queueData.length > limitCheck.remaining) {
    queueData = queueData.slice(0, limitCheck.remaining);
    console.log(`[Background] Queue capped at ${limitCheck.remaining} (daily limit)`);
  }

  queue = queueData;
  delaySec = data.delaySec || 10;
  randomize = data.randomize || false;
  currentIndex = 0;
  stats = { sent: 0, failed: 0, total: queue.length };
  batchId = crypto.randomUUID();
  isRunning = true;
  isPaused = false;

  // Store media separately (media objects can be huge base64)
  const queueForStorage = queue.map(item => ({
    ...item,
    media: item.media ? { _mediaStored: true, _id: `media_${Date.now()}_${Math.random()}` } : null
  }));
  const mediaMap = {};
  queue.forEach((item, idx) => {
    if (item.media) {
      const key = queueForStorage[idx].media._id;
      mediaMap[key] = item.media;
    }
  });

  try {
    await chrome.storage.local.set({ queue: queueForStorage, currentIndex, isRunning, delaySec, randomize, stats });
    if (Object.keys(mediaMap).length > 0) {
      await chrome.storage.local.set(mediaMap);
    }
  } catch (e) {
    console.error('[Background] Storage quota exceeded:', e.message);
    // Fallback: store without queue data
    await chrome.storage.local.set({ currentIndex, isRunning, delaySec, randomize, stats });
    throw new Error('Storage quota exceeded. Clear cache and retry.');
  }

  // Find WhatsApp Web tab
  const tabs = await chrome.tabs.query({ url: 'https://web.whatsapp.com/*' });
  if (tabs.length === 0) {
    sendResponse({ success: false, error: 'WhatsApp Web tab not found. Please open WhatsApp Web first.' });
    isRunning = false;
    return;
  }

  whatsappTabId = tabs[0].id;
  sendResponse({
    success: true,
    queueLength: queue.length,
    remaining: limitCheck.remaining
  });

  // Fetch latest selectors before starting
  await fetchSelectors();

  // Track extension_loaded event
  trackEvent('extension_loaded');

  sendNextMessage();
}

function handleStopQueue(sendResponse) {
  isRunning = false;
  isPaused = false;
  batchId = null;
  chrome.alarms.clear('sendNext');
  chrome.storage.local.set({ isRunning: false, isPaused: false });
  sendResponse({ success: true });
}

async function logMessage(recipientPhone, message, status, error = null) {
  try {
    if (!authToken) await restoreAuth();
    if (!authToken) return;
    fetch(`${SUPABASE_URL}/functions/v1/log-message`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'apikey': SUPABASE_ANON_KEY, 'Authorization': `Bearer ${authToken}` },
      body: JSON.stringify({ recipient_phone: recipientPhone, message, status, error, batch_id: batchId })
    }).catch(() => {});
  } catch (e) {}
}

async function handleMessageSent(data) {
  stats.sent++;
  trackEvent('message_sent');
  logMessage(data?.number || '', data?.message || '', 'sent');
  updateProgress();
  scheduleNext();
}

function handleMessageFailed(data) {
  stats.failed++;
  trackEvent('message_failed', { errorMessage: data.error || 'Unknown error' });
  logMessage(data?.number || '', data?.message || '', 'failed', data?.error || 'Unknown error');
  updateProgress();
  scheduleNext();
}

async function sendNextMessage() {
  // Restore auth + queue state — service worker may have restarted since last alarm
  await restoreAuth();
  if (!authToken) {
    console.error('[sendNext] No authToken after restore — aborting');
    isRunning = false;
    return;
  }

  if (!isRunning) {
    const stored = await chrome.storage.local.get(['isRunning', 'queue', 'currentIndex', 'delaySec', 'randomize', 'stats']);
    if (!stored.isRunning) return;
    queue        = stored.queue        || queue;
    currentIndex = stored.currentIndex ?? currentIndex;
    delaySec     = stored.delaySec     ?? delaySec;
    randomize    = stored.randomize    ?? randomize;
    stats        = stored.stats        || stats;
    isRunning    = true;

    // Restore media from storage (stored separately due to size)
    for (let i = 0; i < queue.length; i++) {
      if (queue[i].media && queue[i].media._mediaStored) {
        const mediaData = await chrome.storage.local.get([queue[i].media._id]);
        if (mediaData[queue[i].media._id]) {
          queue[i].media = mediaData[queue[i].media._id];
        }
      }
    }
    isPaused     = false;
  }

  // Restore whatsappTabId if service worker restarted
  if (!whatsappTabId) {
    const tabs = await chrome.tabs.query({ url: 'https://web.whatsapp.com/*' });
    if (tabs.length === 0) {
      console.error('[sendNext] WhatsApp Web tab not found');
      isRunning = false;
      chrome.storage.local.set({ isRunning: false });
      return;
    }
    whatsappTabId = tabs[0].id;
  }

  if (isPaused) return;

  if (currentIndex >= queue.length) {
    finishQueue();
    return;
  }

  // Per-message limit check — fetch directly from Supabase (always realtime, no cache)
  try {
    const liveStats = await apiRequest('/get-stats');
    console.log('[sendNext] live stats:', JSON.stringify(liveStats));
    if (liveStats.success) {
      chrome.runtime.sendMessage({ action: 'statsUpdated', stats: liveStats.stats }).catch(() => {});
      const limit = liveStats.stats.messagesLimit ?? 10;
      const sent  = liveStats.stats.messagesSentToday ?? 0;
      if (sent >= limit) {
        isRunning = false;
        chrome.storage.local.set({ isRunning: false });
        chrome.runtime.sendMessage({
          action: 'updateProgress',
          data: { sent: stats.sent, failed: stats.failed, total: stats.total, limitReached: true }
        }).catch(() => {});
        return;
      }
    } else {
      console.error('[sendNext] /get-stats failed:', liveStats.error);
    }
  } catch (e) {
    console.error('[sendNext] Live limit check threw:', e.message);
  }

  const item = queue[currentIndex];
  console.log(`[Background] Sending message ${currentIndex + 1}/${queue.length} to ${item.number}`);

  currentIndex++;
  await chrome.storage.local.set({ currentIndex });

  if (whatsappTabId) {
    try {
      // content.js handles chat navigation internally via wa.me anchor — no tab reload
      chrome.tabs.sendMessage(whatsappTabId, {
        action: 'sendMessage',
        data: { number: item.number, message: item.message, media: item.media || null }
      }, (response) => {
        if (chrome.runtime.lastError) {
          handleMessageFailed({ error: chrome.runtime.lastError.message });
        }
      });
    } catch (error) {
      handleMessageFailed({ error: error.message });
    }
  } else {
    handleMessageFailed({ error: 'No WhatsApp tab' });
  }
}

// Wait for a tab to finish loading
function waitForTabLoad(tabId, timeout = 15000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      chrome.tabs.onUpdated.removeListener(listener);
      resolve(); // Resolve anyway after timeout
    }, timeout);

    function listener(updatedTabId, changeInfo) {
      if (updatedTabId === tabId && changeInfo.status === 'complete') {
        clearTimeout(timer);
        chrome.tabs.onUpdated.removeListener(listener);
        resolve();
      }
    }

    chrome.tabs.onUpdated.addListener(listener);
  });
}

function scheduleNext() {
  if (!isRunning || currentIndex >= queue.length) return;

  let delay = delaySec;
  if (randomize) {
    const variance = (Math.random() * 4) - 2;
    delay = Math.max(8, delaySec + variance);
  }

  chrome.alarms.create('sendNext', { delayInMinutes: delay / 60 });
  startCountdown(delay);
}

function startCountdown(seconds) {
  let remaining = Math.ceil(seconds);

  const countdownInterval = setInterval(() => {
    if (!isRunning || isPaused) {
      clearInterval(countdownInterval);
      return;
    }

    remaining--;

    chrome.runtime.sendMessage({
      action: 'updateProgress',
      data: { sent: stats.sent, failed: stats.failed, total: stats.total, nextIn: remaining }
    }).catch(() => {});

    if (remaining <= 0) clearInterval(countdownInterval);
  }, 1000);
}

function updateProgress() {
  chrome.runtime.sendMessage({
    action: 'updateProgress',
    data: { sent: stats.sent, failed: stats.failed, total: stats.total }
  }).catch(() => {});

  chrome.storage.local.set({ stats });
}

function finishQueue() {
  isRunning = false;
  isPaused = false;

  chrome.storage.local.set({ isRunning: false, isPaused: false });

  // Clean up media from completed queue
  (async () => {
    const keysToDelete = queue
      .filter(item => item.media && item.media._mediaStored)
      .map(item => item.media._id);

    if (keysToDelete.length > 0) {
      await chrome.storage.local.remove(keysToDelete);
      console.log(`[Background] Cleaned up ${keysToDelete.length} media items`);
    }

    queue = [];
    await chrome.storage.local.set({ queue: [] });
  })();

  chrome.runtime.sendMessage({
    action: 'queueFinished',
    data: stats
  }).catch(() => {});
}

// ===== Clean up old media data (prevent quota issues) =====
async function cleanupOldMediaData() {
  try {
    const allData = await chrome.storage.local.get(null);
    const mediaKeys = Object.keys(allData).filter(k => k.startsWith('media_'));
    const queue = allData.queue || [];

    // Find media still referenced in queue
    const activeMediaIds = new Set();
    queue.forEach(item => {
      if (item.media && item.media._mediaStored) {
        activeMediaIds.add(item.media._id);
      }
    });

    // Delete unreferenced media
    const orphanedMedia = mediaKeys.filter(k => !activeMediaIds.has(k));
    if (orphanedMedia.length > 0) {
      await chrome.storage.local.remove(orphanedMedia);
      console.log(`[Background] Cleaned ${orphanedMedia.length} orphaned media items`);
    }
  } catch (e) {
    console.error('[Background] Media cleanup failed:', e.message);
  }
}

// ===== Restore State on Startup =====
chrome.runtime.onStartup.addListener(async () => {
  // Clean up old media first
  await cleanupOldMediaData();

  const data = await chrome.storage.local.get([
    'queue', 'currentIndex', 'isRunning',
    'delaySec', 'randomize', 'stats', 'authToken'
  ]);

  // Always fetch selectors on startup (no auth needed)
  fetchSelectors();

  if (data.authToken) {
    authToken = data.authToken;
  }

  if (data.isRunning && data.queue) {
    queue = data.queue;
    currentIndex = data.currentIndex || 0;
    delaySec = data.delaySec || 10;
    randomize = data.randomize || false;
    stats = data.stats || { sent: 0, failed: 0, total: data.queue.length };
    isRunning = true;

    // Restore media from storage (stored separately due to size)
    (async () => {
      for (let i = 0; i < queue.length; i++) {
        if (queue[i].media && queue[i].media._mediaStored) {
          const mediaData = await chrome.storage.local.get([queue[i].media._id]);
          if (mediaData[queue[i].media._id]) {
            queue[i].media = mediaData[queue[i].media._id];
          }
        }
      }
      chrome.alarms.create('sendNext', { delayInMinutes: 0.1 });
    })();
  }
});

// Also restore on install / update
chrome.runtime.onInstalled.addListener(async () => {
  // Always fetch selectors on install/update (no auth needed)
  fetchSelectors();

  const data = await chrome.storage.local.get(['authToken']);
  if (data.authToken) {
    authToken = data.authToken;
  }
});

// ===== KEEP-ALIVE MECHANISM (Prevents service worker hibernation) =====
// Keep-alive pings and stats refresh ONLY active when popup is open
const portConnections = new Set();

chrome.runtime.onConnect.addListener((port) => {
  console.log('[Background] Port connected:', port.name);
  portConnections.add(port);

  // Popup just opened — start stats refresh alarm (5 min interval)
  if (portConnections.size === 1 && authToken) {
    chrome.alarms.create('statsRefresh', { periodInMinutes: 5 });
    refreshStatsBackground(); // Fetch immediately on popup open (respects TTL cache)
  }

  port.onDisconnect.addListener(() => {
    console.log('[Background] Port disconnected:', port.name);
    portConnections.delete(port);

    // Popup closed — stop stats refresh alarm if queue not running
    if (portConnections.size === 0 && !isRunning) {
      chrome.alarms.clear('statsRefresh');
      console.log('[Background] Popup closed — stats refresh stopped');
    }
  });

  port.onMessage.addListener((msg) => {
    if (msg.type === 'keepalive') {
      port.postMessage({ type: 'keepalive-ack', status: 'alive' });
    }
  });

  // Send initial acknowledgement
  port.postMessage({ type: 'connect-ack', ready: true });
});

// Send keep-alive pings to all connected ports every 3 minutes (only if popup open)
setInterval(() => {
  if (portConnections.size > 0) {
    portConnections.forEach(port => {
      try {
        port.postMessage({ type: 'background-ping' });
      } catch (e) {
        console.warn('[Background] Failed to send ping to port:', e.message);
      }
    });
  }
}, 180000); // 3 minutes

console.log('[Background] Service worker loaded with keep-alive mechanism');
