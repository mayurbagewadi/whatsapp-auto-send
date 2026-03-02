// ===== WhatsApp Extension Backend Server =====
// Serves dynamic CSS selectors to extension
// Logs message sends to database

const express = require('express');
const cors = require('cors');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

// Initialize Supabase
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

console.log('✅ Supabase initialized');

// ===== API ENDPOINTS =====

// 1. GET SELECTORS - Extension calls this to get dynamic selectors
app.get('/api/selectors', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('whatsapp_selectors')
      .select('*')
      .eq('is_working', true);

    if (error) throw error;

    // Format for extension
    const formatted = {};
    data.forEach(sel => {
      formatted[sel.name] = sel.selectors;
    });

    res.json({
      success: true,
      selectors: formatted,
      count: data.length,
      lastUpdated: new Date()
    });
  } catch (error) {
    console.error('❌ GET /api/selectors error:', error.message);
    res.status(500).json({
      success: false,
      error: error.message,
      selectors: {}
    });
  }
});

// 2. LOG MESSAGE - Extension reports each message sent
app.post('/api/log-message', async (req, res) => {
  try {
    const { extensionId, phoneNumber, message, status, error } = req.body;

    // Validate
    if (!phoneNumber || !status) {
      return res.status(400).json({
        success: false,
        error: 'Missing phoneNumber or status'
      });
    }

    const { data, error: dbError } = await supabase
      .from('message_logs')
      .insert([{
        extension_id: extensionId,
        phone_number: phoneNumber,
        message: message || null,
        status: status,
        error: error || null
      }]);

    if (dbError) throw dbError;

    res.json({
      success: true,
      logId: data[0]?.id,
      message: `Message logged: ${status}`
    });
  } catch (error) {
    console.error('❌ POST /api/log-message error:', error.message);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// 3. GET STATISTICS - Dashboard view of all sends
app.get('/api/stats', async (req, res) => {
  try {
    const { data: allMessages, error } = await supabase
      .from('message_logs')
      .select('status');

    if (error) throw error;

    const totalMessages = allMessages.length;
    const successCount = allMessages.filter(m => m.status === 'sent').length;
    const failureCount = allMessages.filter(m => m.status === 'failed').length;
    const successRate = totalMessages > 0
      ? ((successCount / totalMessages) * 100).toFixed(2)
      : 0;

    res.json({
      success: true,
      stats: {
        totalMessages,
        successCount,
        failureCount,
        pendingCount: totalMessages - successCount - failureCount,
        successRate: `${successRate}%`
      }
    });
  } catch (error) {
    console.error('❌ GET /api/stats error:', error.message);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// 4. UPDATE SELECTOR - Admin updates selector when WhatsApp changes UI
app.post('/api/update-selector', async (req, res) => {
  try {
    const { name, selectors, whatsappVersion, isWorking } = req.body;

    if (!name || !selectors || !Array.isArray(selectors)) {
      return res.status(400).json({
        success: false,
        error: 'Missing name or selectors array'
      });
    }

    const { data, error } = await supabase
      .from('whatsapp_selectors')
      .upsert([{
        name: name,
        selectors: selectors,
        whatsapp_version: whatsappVersion || null,
        is_working: isWorking !== false,
        tested_at: new Date()
      }], { onConflict: 'name' });

    if (error) throw error;

    res.json({
      success: true,
      message: `Selector "${name}" updated`,
      selectorId: data[0]?.id
    });
  } catch (error) {
    console.error('❌ POST /api/update-selector error:', error.message);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// 5. GET SELECTOR BY NAME - Get specific selector
app.get('/api/selectors/:name', async (req, res) => {
  try {
    const { name } = req.params;

    const { data, error } = await supabase
      .from('whatsapp_selectors')
      .select('*')
      .eq('name', name)
      .single();

    if (error) throw error;

    res.json({
      success: true,
      selector: data
    });
  } catch (error) {
    console.error('❌ GET /api/selectors/:name error:', error.message);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// 6. HEALTH CHECK - Verify server is running
app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    message: 'Server is running ✅',
    timestamp: new Date(),
    uptime: process.uptime()
  });
});

// 7. ROOT ENDPOINT
app.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'WhatsApp Extension Backend Server',
    endpoints: {
      'GET /api/health': 'Server health check',
      'GET /api/selectors': 'Get all active selectors',
      'GET /api/selectors/:name': 'Get specific selector',
      'POST /api/log-message': 'Log message send',
      'GET /api/stats': 'Get statistics',
      'POST /api/update-selector': 'Update selector'
    }
  });
});

// ===== ERROR HANDLING =====
app.use((err, req, res, next) => {
  console.error('❌ Unhandled error:', err);
  res.status(500).json({
    success: false,
    error: err.message || 'Internal server error'
  });
});

// ===== START SERVER =====
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
  console.log(`📍 Health check: http://localhost:${PORT}/api/health`);
  console.log(`📍 Get selectors: http://localhost:${PORT}/api/selectors`);
});
