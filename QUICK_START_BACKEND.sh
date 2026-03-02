#!/bin/bash

# 🚀 QUICK START: Build WhatsApp Extension Backend
# Run this script to set up everything in 5 minutes

echo "╔════════════════════════════════════════════╗"
echo "║  WhatsApp Extension Backend Setup          ║"
echo "║  This will create the entire backend       ║"
echo "╚════════════════════════════════════════════╝"
echo ""

# Step 1: Create directory
echo "📁 Creating project directory..."
mkdir -p whatsapp-extension-backend
cd whatsapp-extension-backend

# Step 2: Initialize npm
echo "📦 Initializing Node.js project..."
npm init -y > /dev/null

# Step 3: Install dependencies
echo "📥 Installing dependencies..."
npm install express cors mongodb dotenv axios puppeteer --save > /dev/null
npm install nodemon --save-dev > /dev/null

# Step 4: Create directories
echo "📂 Creating directories..."
mkdir -p models services scripts

# Step 5: Create .env file
echo "⚙️  Creating .env file..."
cat > .env << 'EOF'
# MongoDB Connection
MONGODB_URI=mongodb+srv://YOUR_USERNAME:YOUR_PASSWORD@cluster.mongodb.net/whatsapp-selectors

# Server
PORT=3000
NODE_ENV=development

# Optional: Admin email for alerts
ADMIN_EMAIL=your-email@example.com
EOF

echo "   ⚠️  NOTE: Update MONGODB_URI in .env file with your MongoDB credentials"
echo ""

# Step 6: Create models
echo "🗄️  Creating database models..."

cat > models/Selector.js << 'EOF'
const mongoose = require('mongoose');

const selectorSchema = new mongoose.Schema({
  name: String,
  selectors: [String],
  description: String,
  whatsappVersion: String,
  lastTested: Date,
  isWorking: Boolean,
  testedAt: Date,
  updatedAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Selector', selectorSchema);
EOF

cat > models/MessageLog.js << 'EOF'
const mongoose = require('mongoose');

const messageLogSchema = new mongoose.Schema({
  extensionId: String,
  phoneNumber: String,
  message: String,
  status: String,
  error: String,
  timestamp: { type: Date, default: Date.now }
});

module.exports = mongoose.model('MessageLog', messageLogSchema);
EOF

echo "   ✅ Created Selector.js and MessageLog.js"

# Step 7: Create server.js
echo "🖥️  Creating Express server..."
cat > server.js << 'EOF'
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

// MongoDB Connection
mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('✅ MongoDB connected'))
  .catch(err => {
    console.error('❌ MongoDB error:', err.message);
    console.log('📝 Make sure MONGODB_URI is set in .env file');
  });

const Selector = require('./models/Selector');
const MessageLog = require('./models/MessageLog');

// GET SELECTORS
app.get('/api/selectors', async (req, res) => {
  try {
    const selectors = await Selector.find({ isWorking: true });
    const formatted = {};
    selectors.forEach(sel => {
      formatted[sel.name] = sel.selectors;
    });
    res.json({
      success: true,
      selectors: formatted,
      lastUpdated: new Date()
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// LOG MESSAGE
app.post('/api/log-message', async (req, res) => {
  try {
    const { extensionId, phoneNumber, message, status, error } = req.body;
    const log = new MessageLog({
      extensionId, phoneNumber, message, status, error
    });
    await log.save();
    res.json({ success: true, logId: log._id });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET STATS
app.get('/api/stats', async (req, res) => {
  try {
    const totalMessages = await MessageLog.countDocuments();
    const successCount = await MessageLog.countDocuments({ status: 'sent' });
    const failureCount = await MessageLog.countDocuments({ status: 'failed' });
    const successRate = totalMessages > 0
      ? ((successCount / totalMessages) * 100).toFixed(2)
      : 0;

    res.json({
      success: true,
      stats: {
        totalMessages,
        successCount,
        failureCount,
        successRate: `${successRate}%`
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// UPDATE SELECTOR
app.post('/api/update-selector', async (req, res) => {
  try {
    const { name, selectors, whatsappVersion } = req.body;
    const updated = await Selector.findOneAndUpdate(
      { name },
      {
        selectors,
        whatsappVersion,
        isWorking: true,
        testedAt: new Date(),
        updatedAt: new Date()
      },
      { upsert: true, new: true }
    );
    res.json({
      success: true,
      message: `Selector "${name}" updated`,
      selector: updated
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// HEALTH CHECK
app.get('/api/health', (req, res) => {
  res.json({ success: true, message: 'Server is running ✅' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`✅ Server running on http://localhost:${PORT}`);
  console.log(`📊 Check health: http://localhost:${PORT}/api/health`);
});
EOF

echo "   ✅ Created server.js"

# Step 8: Create initialization script
echo "🔧 Creating database initialization script..."
cat > scripts/initSelectors.js << 'EOF'
require('dotenv').config();
const mongoose = require('mongoose');
const Selector = require('../models/Selector');

const defaultSelectors = [
  {
    name: 'send_button',
    selectors: [
      'button[data-testid="compose-btn-send"]',
      'button[aria-label="Send"]',
      'span[data-icon="send"]',
      'button[data-tab="11"]'
    ],
    description: 'Send message button',
    isWorking: true
  },
  {
    name: 'message_input',
    selectors: [
      'div[data-testid="textbox"]',
      'div[contenteditable="true"]',
      '[role="textbox"]',
      'textarea'
    ],
    description: 'Message input field',
    isWorking: true
  },
  {
    name: 'modal_confirm',
    selectors: [
      'div[data-animate-modal-popup="true"] button:last-child',
      'div[role="dialog"] button[role="button"]',
      'button[data-testid="popup-confirm"]'
    ],
    description: 'Modal confirmation button',
    isWorking: true
  }
];

async function initSelectors() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    await Selector.deleteMany({});
    const inserted = await Selector.insertMany(defaultSelectors);
    console.log(`✅ Inserted ${inserted.length} selectors`);

    await mongoose.disconnect();
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

initSelectors();
EOF

echo "   ✅ Created initSelectors.js"

# Step 9: Create package.json scripts
echo "📝 Updating package.json scripts..."
npm set-script dev "nodemon server.js" > /dev/null
npm set-script start "node server.js" > /dev/null
npm set-script init-db "node scripts/initSelectors.js" > /dev/null

# Step 10: Create MongoDB setup guide
echo "📚 Creating setup documentation..."
cat > SETUP_MONGODB.md << 'EOF'
# 🗄️ MongoDB Setup Guide

## Step 1: Create MongoDB Account
1. Go to https://www.mongodb.com/cloud/atlas
2. Click "Start Free"
3. Create account with email/password

## Step 2: Create Cluster
1. Create new cluster (Free tier is fine)
2. Wait for cluster to deploy (usually 5 min)

## Step 3: Create Database User
1. Go to Database Access
2. Click "Add New Database User"
3. Create username and strong password
4. Copy the connection string

## Step 4: Get Connection String
1. Go to Clusters
2. Click "Connect"
3. Select "Connect to your application"
4. Copy the connection string
5. Replace `<username>`, `<password>`, `<dbname>`

## Step 5: Update .env
Paste connection string in .env file:
```
MONGODB_URI=mongodb+srv://YOUR_USERNAME:YOUR_PASSWORD@cluster.mongodb.net/whatsapp-selectors
```

## Step 6: Test Connection
Run: `npm run init-db`

You should see:
```
✅ Connected to MongoDB
✅ Inserted 3 selectors
```

Done! 🎉
EOF

echo "   ✅ Created SETUP_MONGODB.md"

# Step 11: Create Railway deployment guide
echo "🚀 Creating deployment guide..."
cat > DEPLOY_TO_RAILWAY.md << 'EOF'
# 🚀 Deploy to Railway.app

## Step 1: Create Railway Account
1. Go to https://railway.app
2. Sign up with GitHub account

## Step 2: Create New Project
1. Click "New Project"
2. Select "GitHub Repo"
3. Connect your repository (or upload files)

## Step 3: Add Environment Variables
1. Go to Variables tab
2. Add:
   - MONGODB_URI: (your connection string)
   - PORT: 3000
   - NODE_ENV: production

## Step 4: Deploy
1. Connect your repo
2. Railway auto-deploys on git push
3. Your URL will be: https://your-app.railway.app

## Step 5: Test
```
curl https://your-app.railway.app/api/health
```

You should see:
```
{"success":true,"message":"Server is running ✅"}
```

Done! 🎉
EOF

echo "   ✅ Created DEPLOY_TO_RAILWAY.md"

# Step 12: Create .gitignore
echo "🚫 Creating .gitignore..."
cat > .gitignore << 'EOF'
node_modules/
.env
.env.local
.DS_Store
*.log
EOF

# Step 13: Final summary
echo ""
echo "╔════════════════════════════════════════════╗"
echo "║  ✅ SETUP COMPLETE!                        ║"
echo "╚════════════════════════════════════════════╝"
echo ""
echo "📁 Project created in: $(pwd)"
echo ""
echo "📝 NEXT STEPS:"
echo ""
echo "1️⃣  Set up MongoDB:"
echo "    📖 Read: SETUP_MONGODB.md"
echo "    • Go to mongodb.com/cloud/atlas"
echo "    • Create cluster and database user"
echo "    • Copy connection string to .env"
echo ""
echo "2️⃣  Test locally:"
echo "    npm run init-db          # Initialize database"
echo "    npm run dev              # Start server"
echo ""
echo "3️⃣  Deploy to Railway.app:"
echo "    📖 Read: DEPLOY_TO_RAILWAY.md"
echo "    • Push to GitHub"
echo "    • Connect to Railway"
echo "    • Deploy automatically"
echo ""
echo "4️⃣  Update your extension:"
echo "    • Replace 'https://your-api.railway.app' with your actual URL"
echo "    • Update popup.js and content.js"
echo ""
echo "💡 Questions? See:"
echo "   • BUILD_BACKEND_GUIDE.md (detailed guide)"
echo "   • SETUP_MONGODB.md (MongoDB help)"
echo "   • DEPLOY_TO_RAILWAY.md (deployment help)"
echo ""
echo "🎉 You're ready to build! Let's go!"
echo ""
