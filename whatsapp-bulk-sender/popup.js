// ===== GLOBAL ERROR HANDLERS (MUST BE FIRST) =====
window.addEventListener('error', (e) => {
  console.error('[Popup ERROR]', e.message, e.filename, e.lineno);
  // Don't override DOM on error - just log it
});

window.addEventListener('unhandledrejection', (e) => {
  console.error('[Popup REJECTION]', e.reason);
  // Don't override DOM on rejection - just log it
});

// ===== DOM Elements =====
console.log('[Popup] ====== POPUP INITIALIZATION START ======');
console.log('[Popup] timestamp:', new Date().toISOString());

const authScreen = document.getElementById('authScreen');
const signupTab = document.getElementById('signupTab');
const loginTab = document.getElementById('loginTab');
const signupForm = document.getElementById('signupForm');
const loginForm = document.getElementById('loginForm');
const blockingScreen = document.getElementById('blockingScreen');
const mainContent = document.getElementById('mainContent');
const blockingMessage = document.getElementById('blockingMessage');
const openWhatsAppBtn = document.getElementById('openWhatsAppBtn');
const phoneNumbersEl = document.getElementById('phoneNumbers');
const messageEl = document.getElementById('message');
const delaySecEl = document.getElementById('delaySec');
const randomizeDelayEl = document.getElementById('randomizeDelay');
const startBtn = document.getElementById('startBtn');
const clearBtn = document.getElementById('clearBtn');
const pauseBtn = document.getElementById('pauseBtn');
const stopBtn = document.getElementById('stopBtn');
const statusDot = document.getElementById('statusDot');
const statusText = document.getElementById('statusText');
const numberCountEl = document.getElementById('numberCount');
const charCountEl = document.getElementById('charCount');
const delayWarningEl = document.getElementById('delayWarning');
const progressSection = document.getElementById('progressSection');
const sentCountEl = document.getElementById('sentCount');
const failedCountEl = document.getElementById('failedCount');
const totalCountEl = document.getElementById('totalCount');
const progressBar = document.getElementById('progressBar');
const countdownEl = document.getElementById('countdown');
const statusMessage = document.getElementById('statusMessage');

console.log('[Popup] DOM elements initialized - authScreen exists:', !!authScreen, 'mainContent exists:', !!mainContent);

// ===== Initialize =====
let isRunning = false;
let isPaused = false;
let currentView = 'main'; // 'main' | 'settings'

// Media upload state
let mediaManager = null;
let currentMedia = null;

// Message log state
let logQueue      = [];
let logProcessed  = 0;
let logPrevSent   = 0;
let logPrevFailed = 0;

// ===== IMPROVED INITIALIZATION WITH KEEP-ALIVE =====
console.log('[Popup] Setting up keep-alive connection to service worker...');

// Create persistent port connection to keep service worker alive
let keepAlivePort = null;
let keepAliveInterval = null;

function setupKeepAlive() {
  try {
    keepAlivePort = chrome.runtime.connect({ name: 'popup-keepalive' });
    console.log('[Popup] ✓ Keep-alive port established');

    keepAlivePort.onMessage.addListener((msg) => {
      if (msg.type === 'connect-ack') {
        console.log('[Popup] ✓ Service worker acknowledged connection');
      } else if (msg.type === 'keepalive-ack') {
        console.log('[Popup] ✓ Keep-alive confirmed - service worker is responsive');
      }
    });

    keepAlivePort.onDisconnect.addListener(() => {
      console.warn('[Popup] Keep-alive port disconnected, attempting to reconnect...');
      clearInterval(keepAliveInterval);
      setTimeout(setupKeepAlive, 1000);
    });

    // Send keep-alive ping every 30 seconds
    keepAliveInterval = setInterval(() => {
      if (keepAlivePort) {
        try {
          keepAlivePort.postMessage({ type: 'keepalive' });
        } catch (e) {
          console.warn('[Popup] Keep-alive ping failed:', e.message);
        }
      }
    }, 30000); // Every 30 seconds

  } catch (e) {
    console.error('[Popup] Keep-alive port setup failed:', e.message);
  }
}

// Set up keep-alive immediately
setupKeepAlive();

// Clean up interval and port when popup closes
window.addEventListener('beforeunload', () => {
  if (keepAliveInterval) clearInterval(keepAliveInterval);
  if (keepAlivePort) {
    try {
      keepAlivePort.disconnect();
      console.log('[Popup] Keep-alive port disconnected');
    } catch (e) {}
  }
});

// Show auth screen immediately (fallback)
if (authScreen) {
  authScreen.style.display = 'flex';
  authScreen.style.visibility = 'visible';
  authScreen.style.opacity = '1';
  console.log('[Popup] Auth screen shown immediately');
} else {
  console.error('[Popup] CRITICAL: authScreen element not found in DOM!');
  document.body.innerHTML = '<div style="padding: 20px; color: red; font-family: sans-serif;"><strong>❌ CRITICAL ERROR</strong><br>Auth screen element missing from DOM</div>';
}

// Enhanced timeout safeguard (wait up to 3 seconds instead of 1.5)
let safeguardTriggered = false;
setTimeout(() => {
  if (!safeguardTriggered && authScreen && authScreen.style.display !== 'flex') {
    safeguardTriggered = true;
    console.warn('[Popup] SAFEGUARD: Auth screen not visible, forcing display');
    authScreen.style.display = 'flex';
    authScreen.style.visibility = 'visible';
    authScreen.style.opacity = '1';
  }
}, 3000); // Increased from 1.5s to 3s

// ===== MEDIA MANAGER INITIALIZATION =====
async function initMediaManager(token) {
  if (!token || typeof SUPABASE_CONFIG === 'undefined' || mediaManager) return;
  try {
    mediaManager = new MediaManager(SUPABASE_CONFIG.URL, SUPABASE_CONFIG.ANON_KEY, token);
    console.log('[Popup] MediaManager initialized');
    const mediaBtn = document.getElementById('mediaButton');
    if (mediaBtn) mediaBtn.addEventListener('click', handleMediaButtonClick);
    const mediaInput = document.getElementById('mediaInput');
    if (mediaInput) mediaInput.addEventListener('change', handleMediaFileSelect);
  } catch (error) {
    console.error('[Popup] MediaManager initialization error:', error.message);
    // Non-fatal — popup still works without media manager
  }
}

document.addEventListener('DOMContentLoaded', async () => {
  const { authToken } = await chrome.storage.local.get('authToken');
  if (!authToken) {
    console.warn('[Popup] No auth token — media manager not initialized');
    return;
  }
  await initMediaManager(authToken);
});

// Handle media button click
async function handleMediaButtonClick() {
  if (!mediaManager) {
    alert('❌ Not authenticated. Please login first.');
    return;
  }

  try {
    const canUpload = await mediaManager.canUpload();

    if (!canUpload.allowed) {
      alert('🔒 ' + canUpload.reason + '\n\nUpgrade your plan to enable media uploads.');
      return;
    }

    document.getElementById('mediaInput').click();
  } catch (error) {
    alert('❌ Error: ' + (error.message || 'Failed to check quota'));
  }
}

// Handle file selection
async function handleMediaFileSelect(e) {
  const file = e.target.files?.[0];
  if (!file) return;

  try {
    // Show uploading status
    document.getElementById('statusText').textContent = '📤 Uploading media...';

    const result = await mediaManager.uploadMedia(file, (progress) => {
      document.getElementById('statusText').textContent = `📤 Uploading: ${Math.round(progress)}%`;
    });

    currentMedia = {
      id: result.mediaId,
      fileName: result.mediaRecord.fileName,
      fileSize: result.mediaRecord.fileSize,
      type: file.type,
    };

    displayMediaInUI();
    document.getElementById('statusText').textContent = '✅ Ready to send';

    console.log('Media uploaded:', result.mediaId);
  } catch (error) {
    console.error('Upload error:', error);
    const errorMsg = error.error || error.message || 'Upload failed';
    alert('❌ ' + errorMsg);
    currentMedia = null; // Clear stale media so it isn't sent on failure
    document.getElementById('statusText').textContent = '⚠️ Upload failed';
  }

  e.target.value = ''; // Reset file input
}

// Display media in UI
function displayMediaInUI() {
  if (!currentMedia) return;

  const icon = mediaManager.isImage(currentMedia.type) ? '📷' :
               mediaManager.isVideo(currentMedia.type) ? '🎥' : '📄';

  console.log(`Media attached: ${icon} ${currentMedia.fileName}`);
}
// ===== END MEDIA MANAGER =====

// ===== Country Picker Data =====
const COUNTRIES = [
  { iso2: '',   dialCode: '',     name: 'No country code' },
  { iso2: 'IN', dialCode: '+91',  name: 'India' },
  { iso2: 'US', dialCode: '+1',   name: 'United States' },
  { iso2: 'GB', dialCode: '+44',  name: 'United Kingdom' },
  { iso2: 'AU', dialCode: '+61',  name: 'Australia' },
  { iso2: 'CA', dialCode: '+1',   name: 'Canada' },
  { iso2: 'AE', dialCode: '+971', name: 'UAE' },
  { iso2: 'SA', dialCode: '+966', name: 'Saudi Arabia' },
  { iso2: 'PK', dialCode: '+92',  name: 'Pakistan' },
  { iso2: 'BD', dialCode: '+880', name: 'Bangladesh' },
  { iso2: 'LK', dialCode: '+94',  name: 'Sri Lanka' },
  { iso2: 'NP', dialCode: '+977', name: 'Nepal' },
  { iso2: 'SG', dialCode: '+65',  name: 'Singapore' },
  { iso2: 'MY', dialCode: '+60',  name: 'Malaysia' },
  { iso2: 'PH', dialCode: '+63',  name: 'Philippines' },
  { iso2: 'ID', dialCode: '+62',  name: 'Indonesia' },
  { iso2: 'TH', dialCode: '+66',  name: 'Thailand' },
  { iso2: 'VN', dialCode: '+84',  name: 'Vietnam' },
  { iso2: 'CN', dialCode: '+86',  name: 'China' },
  { iso2: 'JP', dialCode: '+81',  name: 'Japan' },
  { iso2: 'KR', dialCode: '+82',  name: 'South Korea' },
  { iso2: 'HK', dialCode: '+852', name: 'Hong Kong' },
  { iso2: 'TW', dialCode: '+886', name: 'Taiwan' },
  { iso2: 'MM', dialCode: '+95',  name: 'Myanmar' },
  { iso2: 'KH', dialCode: '+855', name: 'Cambodia' },
  { iso2: 'AF', dialCode: '+93',  name: 'Afghanistan' },
  { iso2: 'IR', dialCode: '+98',  name: 'Iran' },
  { iso2: 'IQ', dialCode: '+964', name: 'Iraq' },
  { iso2: 'KW', dialCode: '+965', name: 'Kuwait' },
  { iso2: 'QA', dialCode: '+974', name: 'Qatar' },
  { iso2: 'BH', dialCode: '+973', name: 'Bahrain' },
  { iso2: 'OM', dialCode: '+968', name: 'Oman' },
  { iso2: 'YE', dialCode: '+967', name: 'Yemen' },
  { iso2: 'JO', dialCode: '+962', name: 'Jordan' },
  { iso2: 'LB', dialCode: '+961', name: 'Lebanon' },
  { iso2: 'SY', dialCode: '+963', name: 'Syria' },
  { iso2: 'IL', dialCode: '+972', name: 'Israel' },
  { iso2: 'TR', dialCode: '+90',  name: 'Turkey' },
  { iso2: 'AZ', dialCode: '+994', name: 'Azerbaijan' },
  { iso2: 'AM', dialCode: '+374', name: 'Armenia' },
  { iso2: 'GE', dialCode: '+995', name: 'Georgia' },
  { iso2: 'KZ', dialCode: '+7',   name: 'Kazakhstan' },
  { iso2: 'UZ', dialCode: '+998', name: 'Uzbekistan' },
  { iso2: 'NG', dialCode: '+234', name: 'Nigeria' },
  { iso2: 'ZA', dialCode: '+27',  name: 'South Africa' },
  { iso2: 'KE', dialCode: '+254', name: 'Kenya' },
  { iso2: 'ET', dialCode: '+251', name: 'Ethiopia' },
  { iso2: 'GH', dialCode: '+233', name: 'Ghana' },
  { iso2: 'TZ', dialCode: '+255', name: 'Tanzania' },
  { iso2: 'UG', dialCode: '+256', name: 'Uganda' },
  { iso2: 'EG', dialCode: '+20',  name: 'Egypt' },
  { iso2: 'MA', dialCode: '+212', name: 'Morocco' },
  { iso2: 'DZ', dialCode: '+213', name: 'Algeria' },
  { iso2: 'TN', dialCode: '+216', name: 'Tunisia' },
  { iso2: 'LY', dialCode: '+218', name: 'Libya' },
  { iso2: 'SD', dialCode: '+249', name: 'Sudan' },
  { iso2: 'ZW', dialCode: '+263', name: 'Zimbabwe' },
  { iso2: 'ZM', dialCode: '+260', name: 'Zambia' },
  { iso2: 'CM', dialCode: '+237', name: 'Cameroon' },
  { iso2: 'SN', dialCode: '+221', name: 'Senegal' },
  { iso2: 'DE', dialCode: '+49',  name: 'Germany' },
  { iso2: 'FR', dialCode: '+33',  name: 'France' },
  { iso2: 'IT', dialCode: '+39',  name: 'Italy' },
  { iso2: 'ES', dialCode: '+34',  name: 'Spain' },
  { iso2: 'PT', dialCode: '+351', name: 'Portugal' },
  { iso2: 'NL', dialCode: '+31',  name: 'Netherlands' },
  { iso2: 'BE', dialCode: '+32',  name: 'Belgium' },
  { iso2: 'CH', dialCode: '+41',  name: 'Switzerland' },
  { iso2: 'AT', dialCode: '+43',  name: 'Austria' },
  { iso2: 'SE', dialCode: '+46',  name: 'Sweden' },
  { iso2: 'NO', dialCode: '+47',  name: 'Norway' },
  { iso2: 'DK', dialCode: '+45',  name: 'Denmark' },
  { iso2: 'FI', dialCode: '+358', name: 'Finland' },
  { iso2: 'PL', dialCode: '+48',  name: 'Poland' },
  { iso2: 'CZ', dialCode: '+420', name: 'Czech Republic' },
  { iso2: 'HU', dialCode: '+36',  name: 'Hungary' },
  { iso2: 'RO', dialCode: '+40',  name: 'Romania' },
  { iso2: 'BG', dialCode: '+359', name: 'Bulgaria' },
  { iso2: 'GR', dialCode: '+30',  name: 'Greece' },
  { iso2: 'UA', dialCode: '+380', name: 'Ukraine' },
  { iso2: 'RU', dialCode: '+7',   name: 'Russia' },
  { iso2: 'HR', dialCode: '+385', name: 'Croatia' },
  { iso2: 'RS', dialCode: '+381', name: 'Serbia' },
  { iso2: 'IE', dialCode: '+353', name: 'Ireland' },
  { iso2: 'MX', dialCode: '+52',  name: 'Mexico' },
  { iso2: 'BR', dialCode: '+55',  name: 'Brazil' },
  { iso2: 'AR', dialCode: '+54',  name: 'Argentina' },
  { iso2: 'CO', dialCode: '+57',  name: 'Colombia' },
  { iso2: 'CL', dialCode: '+56',  name: 'Chile' },
  { iso2: 'PE', dialCode: '+51',  name: 'Peru' },
  { iso2: 'VE', dialCode: '+58',  name: 'Venezuela' },
  { iso2: 'EC', dialCode: '+593', name: 'Ecuador' },
  { iso2: 'BO', dialCode: '+591', name: 'Bolivia' },
  { iso2: 'UY', dialCode: '+598', name: 'Uruguay' },
  { iso2: 'NZ', dialCode: '+64',  name: 'New Zealand' },
];

function flagEmoji(iso2) {
  if (!iso2) return '🌐';
  return iso2.toUpperCase().replace(/./g, c =>
    String.fromCodePoint(127397 + c.charCodeAt(0))
  );
}

let selectedCountry = COUNTRIES[1]; // default: India

// ===== Phone Chips Management =====
let phoneChips = []; // Array to store {number, dialCode, flag}
const chipsListEl = document.getElementById('chipsList');
const phoneNumberInputEl = document.getElementById('phoneNumberInput');

// ===== Message Formatting Elements =====
const emojiBtn = document.getElementById('emojiBtn');
const boldBtn = document.getElementById('boldBtn');
const mediaBtn = document.getElementById('mediaBtn');
const mediaInput = document.getElementById('mediaInput');
const emojiModal = document.getElementById('emojiModal');
const emojiModalClose = document.getElementById('emojiModalClose');
const emojiGrid = document.getElementById('emojiGrid');
const mediaDisplay = document.getElementById('mediaDisplay');
const mediaFileName = document.getElementById('mediaFileName');
const mediaRemoveBtn = document.getElementById('mediaRemoveBtn');
const subscriptionBlockModal = document.getElementById('subscriptionBlockModal');
const upgradeBtn = document.getElementById('upgradeBtn');
const closeBlockBtn = document.getElementById('closeBlockBtn');

// ===== Media State =====
let attachedMedia = null; // {name, size, type}

// ===== Emoji List =====
const EMOJIS = [
  '😀', '😃', '😄', '😁', '😆', '😅', '😂', '🤣',
  '😊', '😇', '🙂', '🙃', '😉', '😌', '😍', '🥰',
  '😘', '😗', '😚', '😙', '🥲', '😋', '😛', '😜',
  '🤪', '😌', '🤨', '🧐', '😐', '😑', '😶', '🥱',
  '😏', '😒', '🙄', '😬', '🤥', '😌', '😔', '😪',
  '🤤', '😴', '😷', '🤒', '🤕', '🤢', '🤮', '🤮',
  '🤲', '👏', '👍', '👎', '👊', '✊', '👋', '🤚',
  '❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍',
  '🎉', '🎊', '🎈', '🎁', '🎀', '⭐', '✨', '🌟',
  '🔥', '💯', '💪', '🚀', '👌', '🆗', '📱', '💻'
];

// ===== Formatting Functions =====
function insertEmoji(emoji) {
  const start = messageEl.selectionStart;
  const end = messageEl.selectionEnd;
  const before = messageEl.value.substring(0, start);
  const after = messageEl.value.substring(end);
  messageEl.value = before + emoji + after;
  messageEl.selectionStart = messageEl.selectionEnd = start + emoji.length;
  messageEl.focus();
  updateCharCount();
  closeEmojiPicker();
}

function makeBoldSelected() {
  const start = messageEl.selectionStart;
  const end = messageEl.selectionEnd;
  const selectedText = messageEl.value.substring(start, end);

  if (!selectedText) {
    showMessage('Please select text to make bold', 'warning');
    return;
  }

  if (selectedText.startsWith('**') && selectedText.endsWith('**')) {
    // Remove bold
    const unbolded = selectedText.slice(2, -2);
    messageEl.value = messageEl.value.substring(0, start) + unbolded + messageEl.value.substring(end);
    messageEl.selectionStart = messageEl.selectionEnd = start;
  } else {
    // Add bold
    const bolded = '**' + selectedText + '**';
    messageEl.value = messageEl.value.substring(0, start) + bolded + messageEl.value.substring(end);
    messageEl.selectionStart = messageEl.selectionEnd = start + bolded.length;
  }

  messageEl.focus();
  updateCharCount();
}

function openEmojiPicker() {
  if (emojiGrid.innerHTML === '') {
    renderEmojiGrid();
  }
  emojiModal.style.display = 'flex';
}

function closeEmojiPicker() {
  emojiModal.style.display = 'none';
}

function renderEmojiGrid() {
  emojiGrid.innerHTML = EMOJIS.map(emoji => `
    <div class="emoji-item" data-emoji="${emoji}">${emoji}</div>
  `).join('');

  emojiGrid.querySelectorAll('.emoji-item').forEach(item => {
    item.addEventListener('click', () => {
      insertEmoji(item.dataset.emoji);
    });
  });
}

function showSubscriptionBlock(featureName = 'This feature') {
  document.getElementById('subscriptionBlockMessage').textContent =
    `${featureName} is only available in premium plans. Upgrade your subscription to continue.`;
  subscriptionBlockModal.style.display = 'flex';
}

function closeSubscriptionBlock() {
  subscriptionBlockModal.style.display = 'none';
}

// ===== Media Management =====
const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB

function handleMediaUpload(file) {
  if (!file) return;

  // Validate file size
  if (file.size > MAX_FILE_SIZE) {
    showMessage(`File size exceeds 50MB limit (${(file.size / 1024 / 1024).toFixed(2)}MB)`, 'error');
    mediaInput.value = '';
    return;
  }

  // Validate file type
  const validTypes = ['image/', 'video/', 'application/pdf'];
  const isValid = validTypes.some(type => file.type.startsWith(type));
  if (!isValid) {
    showMessage('Invalid file type. Allowed: images, videos, PDF', 'error');
    mediaInput.value = '';
    return;
  }

  // Read file as base64 so it can be passed to WhatsApp Web tab
  const reader = new FileReader();
  reader.onload = (e) => {
    attachedMedia = {
      name: file.name,
      size: file.size,
      type: file.type,
      base64: e.target.result.split(',')[1]
    };
    displayMediaFile();
    showMessage(`Media attached: ${file.name}`, 'success');
  };
  reader.readAsDataURL(file);
}

function displayMediaFile() {
  if (!attachedMedia) {
    mediaDisplay.style.display = 'none';
    return;
  }

  const sizeMB = (attachedMedia.size / 1024 / 1024).toFixed(2);
  mediaFileName.textContent = `${attachedMedia.name} (${sizeMB}MB)`;
  mediaDisplay.style.display = 'flex';
}

function removeAttachedMedia() {
  attachedMedia = null;
  mediaInput.value = '';
  mediaDisplay.style.display = 'none';
  showMessage('Media removed', 'info');
}

function addPhoneChip(number, dialCode = null) {
  const code = dialCode || selectedCountry.dialCode || '';
  const flag = flagEmoji(selectedCountry.iso2);

  // Normalize number (remove non-digits)
  const cleanNumber = number.replace(/\D/g, '');
  if (cleanNumber.length === 0) return;

  // Check if already exists
  if (phoneChips.some(chip => chip.number === cleanNumber)) return;

  // Add to array
  const chip = { number: cleanNumber, dialCode: code, flag };
  phoneChips.push(chip);

  // Render chip
  renderPhoneChips();
  updateNumberCount();
  savePhoneChips();

  // Clear input
  phoneNumberInputEl.value = '';
}

function removePhoneChip(index) {
  phoneChips.splice(index, 1);
  renderPhoneChips();
  updateNumberCount();
  savePhoneChips();
}

function renderPhoneChips() {
  chipsListEl.innerHTML = phoneChips.map((chip, idx) => `
    <div class="phone-chip valid">
      <div class="chip-number">${chip.number}</div>
      <button type="button" class="chip-delete" data-idx="${idx}" title="Remove">
        ×
      </button>
    </div>
  `).join('');

  // Add delete listeners
  chipsListEl.querySelectorAll('.chip-delete').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      removePhoneChip(parseInt(btn.dataset.idx));
    });
  });
}

function savePhoneChips() {
  const phoneNumbersText = phoneChips
    .map(chip => chip.dialCode + chip.number)
    .join('\n');
  phoneNumbersEl.value = phoneNumbersText;
  chrome.storage.local.set({ savedPhones: phoneNumbersText });
}

function loadPhoneChips() {
  chrome.storage.local.get('savedPhones', (data) => {
    if (data.savedPhones) {
      const lines = data.savedPhones.split('\n').filter(l => l.trim());
      phoneChips = [];
      lines.forEach(line => {
        // Extract country code digits from selected country (e.g., "+91" -> "91")
        const countryCodeDigits = (selectedCountry.dialCode || '').replace(/\D/g, '');

        // Remove all non-digits from the saved line
        let allDigits = line.replace(/\D/g, '');

        // If the number starts with the country code, remove it to get the actual phone number
        let phoneNumber = allDigits;
        if (allDigits.startsWith(countryCodeDigits) && countryCodeDigits.length > 0) {
          phoneNumber = allDigits.substring(countryCodeDigits.length);
        }

        // Only add if we have a valid phone number (10+ digits after removing country code)
        if (phoneNumber.length >= 10) {
          phoneChips.push({
            number: phoneNumber,  // Clean number without country code
            dialCode: selectedCountry.dialCode || '',
            flag: flagEmoji(selectedCountry.iso2)
          });
        }
      });
      renderPhoneChips();
      updateNumberCount();
    }
  });
}

// Load saved data from storage
chrome.storage.local.get(['savedPhones', 'savedMessage', 'savedDelay', 'savedCountry'], (data) => {
  if (data.savedMessage) messageEl.value = data.savedMessage;
  if (data.savedDelay) delaySecEl.value = data.savedDelay;
  if (data.savedCountry) {
    const found = COUNTRIES.find(c => c.iso2 === data.savedCountry);
    if (found) selectedCountry = found;
  }

  initCountryPicker();

  // Load phone chips from saved data
  if (data.savedPhones) {
    const lines = data.savedPhones.split('\n').filter(l => l.trim());
    const countryCodeDigits = (selectedCountry.dialCode || '').replace(/\D/g, '');
    phoneChips = [];
    lines.forEach(line => {
      let allDigits = line.replace(/\D/g, '');
      let phoneNumber = allDigits;
      if (countryCodeDigits.length > 0 && allDigits.startsWith(countryCodeDigits)) {
        phoneNumber = allDigits.substring(countryCodeDigits.length);
      }
      if (phoneNumber.length >= 10) {
        phoneChips.push({
          number: phoneNumber,
          dialCode: selectedCountry.dialCode || '',
          flag: flagEmoji(selectedCountry.iso2)
        });
      }
    });
    renderPhoneChips();
  }

  updateNumberCount();
  updateCharCount();
  checkDelayWarning();
});

// ===== Auth Check =====
// Check authentication first, then WhatsApp connection
console.log('[Popup] ====== STARTING AUTH CHECK ======');
try {
  checkAuthAndInit();
  console.log('[Popup] Auth check initiated successfully');
} catch (error) {
  console.error('[Popup] ❌ FATAL: Auth check crashed:', error.message, error.stack);
  showAuthScreen();
}

function checkAuthAndInit() {
  const startTime = Date.now();
  let retryCount = 0;
  const maxRetries = 3;

  console.log('[Popup] checkAuthAndInit() called at', new Date().toISOString());

  // Ensure at least the auth screen is shown
  if (authScreen) {
    console.log('[Popup] ✓ authScreen element exists, showing it');
    showAuthScreen();
  } else {
    console.error('[Popup] ❌ CRITICAL: authScreen element not found in DOM');
    document.body.innerHTML = '<div style="padding: 20px; color: red; font-family: sans-serif;">❌ Extension error: UI elements not loaded. Please reload the extension.</div>';
    return;
  }

  // Recursive retry function with exponential backoff
  function attemptAuthCheck(attemptNum) {
    let responded = false;
    const attemptStartTime = Date.now();

    console.log(`[Popup] Auth check attempt ${attemptNum}/${maxRetries + 1}`);

    const timeout = setTimeout(() => {
      if (!responded) {
        const elapsed = Date.now() - attemptStartTime;
        console.warn(`[Popup] ⚠️ Attempt ${attemptNum} timeout after ${elapsed}ms`);

        if (attemptNum < maxRetries) {
          // Retry with backoff
          const waitTime = attemptNum * 500; // 500ms, 1000ms, 1500ms
          console.log(`[Popup] Retrying in ${waitTime}ms...`);
          setTimeout(() => attemptAuthCheck(attemptNum + 1), waitTime);
        } else {
          // Max retries reached — show auth screen and give up
          console.error('[Popup] ❌ Auth check failed after', maxRetries, 'retries');
          if (authScreen) {
            authScreen.style.display = 'flex';
          }
          if (blockingScreen) {
            blockingScreen.style.display = 'flex';
            blockingMessage.innerHTML = '⚠️ Service Worker Unresponsive<br><small>Please reload the extension</small>';
          }
        }
      }
    }, 5000); // 5 second timeout per attempt

    try {
      console.log(`[Popup] → Sending getAuthStatus (attempt ${attemptNum})`);
      chrome.runtime.sendMessage({ action: 'getAuthStatus' }, (response) => {
        responded = true;
        const elapsed = Date.now() - attemptStartTime;
        clearTimeout(timeout);

        console.log(`[Popup] ← Received response after ${elapsed}ms:`, {
          authenticated: response?.authenticated,
          hasToken: !!response?.token,
          attempt: attemptNum
        });

        if (chrome.runtime.lastError) {
          console.error('[Popup] ❌ chrome.runtime.lastError:', chrome.runtime.lastError.message);

          if (attemptNum < maxRetries) {
            const waitTime = attemptNum * 500;
            console.log(`[Popup] Retrying in ${waitTime}ms due to runtime error...`);
            setTimeout(() => attemptAuthCheck(attemptNum + 1), waitTime);
          } else {
            if (authScreen) authScreen.style.display = 'flex';
          }
          return;
        }

        if (!response) {
          console.error('[Popup] ❌ Response is null/undefined');

          if (attemptNum < maxRetries) {
            const waitTime = attemptNum * 500;
            console.log(`[Popup] Retrying in ${waitTime}ms due to null response...`);
            setTimeout(() => attemptAuthCheck(attemptNum + 1), waitTime);
          } else {
            if (authScreen) authScreen.style.display = 'flex';
          }
          return;
        }

        // Success! Response is valid — auth status determined, cancel safeguard
        safeguardTriggered = true;
        if (response.authenticated) {
          // Authenticated — show WhatsApp check
          console.log('[Popup] ✓ User authenticated, showing main content');
          showPlanInfo(response.stats);
          try {
            checkWhatsAppConnection();
            setInterval(checkWhatsAppConnection, 3000);
          } catch (e) {
            console.error('[Popup] Error in checkWhatsAppConnection:', e.message);
          }
        } else {
          // Not authenticated — auth screen already visible
          console.log('[Popup] ℹ️ User not authenticated, auth screen visible');
        }
      });
    } catch (error) {
      clearTimeout(timeout);
      console.error(`[Popup] ❌ Auth check attempt ${attemptNum} failed:`, error.message);

      if (attemptNum < maxRetries) {
        const waitTime = attemptNum * 500;
        console.log(`[Popup] Retrying in ${waitTime}ms due to exception...`);
        setTimeout(() => attemptAuthCheck(attemptNum + 1), waitTime);
      } else {
        if (authScreen) authScreen.style.display = 'flex';
      }
    }
  }

  // Start first attempt
  attemptAuthCheck(1);

  console.log('[Popup] checkAuthAndInit() setup complete, starting retry loop...');
}

function showAuthScreen() {
  authScreen.style.display = 'flex';
  blockingScreen.style.display = 'none';
  mainContent.style.display = 'none';
}

function showPlanInfo(stats) {
  // Show main content area when authenticated
  authScreen.style.display = 'none';
  blockingScreen.style.display = 'none';
  mainContent.style.display = 'block';
  // Plan info removed from main page — visible in Settings only
}

// ===== Auth Tab Switching =====
signupTab.addEventListener('click', () => {
  signupTab.classList.add('active');
  loginTab.classList.remove('active');
  signupForm.style.display = 'block';
  loginForm.style.display = 'none';
  clearAuthErrors();
});

loginTab.addEventListener('click', () => {
  loginTab.classList.add('active');
  signupTab.classList.remove('active');
  loginForm.style.display = 'block';
  signupForm.style.display = 'none';
  clearAuthErrors();
});

function clearAuthErrors() {
  document.querySelectorAll('.auth-form-error').forEach(el => el.textContent = '');
}

// ===== Signup Form =====
signupForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  clearAuthErrors();

  const email = document.getElementById('signupEmail').value.trim();
  const phone = document.getElementById('signupPhone').value.trim();
  const password = document.getElementById('signupPassword').value;
  const company_name = document.getElementById('signupCompany').value.trim();

  // Validation
  if (!email || !phone || !password || !company_name) {
    document.getElementById('signupEmailError').textContent = 'All fields are required';
    return;
  }

  if (password.length < 6) {
    document.getElementById('signupPasswordError').textContent = 'Password must be at least 6 characters';
    return;
  }

  const signupBtn = document.getElementById('signupBtn');
  signupBtn.disabled = true;
  signupBtn.innerHTML = '<span>⏳</span><span>Creating Account...</span>';

  chrome.runtime.sendMessage({
    action: 'signup',
    data: { email, phone, password, company_name }
  }, (response) => {
    signupBtn.disabled = false;
    signupBtn.innerHTML = '<span>🚀</span><span>Create Account</span>';

    if (response && response.success) {
      authScreen.style.display = 'none';
      showPlanInfo(response.stats);
      chrome.storage.local.get('authToken', ({ authToken }) => initMediaManager(authToken));
      checkWhatsAppConnection();
      setInterval(checkWhatsAppConnection, 3000);
    } else {
      document.getElementById('signupEmailError').textContent = response?.error || 'Signup failed. Please try again.';
    }
  });
});

// ===== Login Form =====
loginForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  clearAuthErrors();

  const email = document.getElementById('loginEmail').value.trim();
  const password = document.getElementById('loginPassword').value;

  if (!email || !password) {
    document.getElementById('loginEmailError').textContent = 'Both fields are required';
    return;
  }

  const loginBtn = document.getElementById('loginBtn');
  loginBtn.disabled = true;
  loginBtn.innerHTML = '<span>⏳</span><span>Logging in...</span>';

  chrome.runtime.sendMessage({
    action: 'login',
    data: { email, password }
  }, (response) => {
    loginBtn.disabled = false;
    loginBtn.innerHTML = '<span>✅</span><span>Login</span>';

    if (response && response.success) {
      authScreen.style.display = 'none';
      showPlanInfo(response.stats);
      chrome.storage.local.get('authToken', ({ authToken }) => initMediaManager(authToken));
      checkWhatsAppConnection();
      setInterval(checkWhatsAppConnection, 3000);
    } else {
      document.getElementById('loginPasswordError').textContent = response?.error || 'Invalid credentials. Please try again.';
    }
  });
});


// ===== Settings Navigation =====
const settingsPage = document.getElementById('settingsPage');

document.getElementById('hardRefreshBtn')?.addEventListener('click', () => {
  const icon = document.getElementById('refreshIcon');
  icon.style.transition = 'transform 0.6s ease';
  icon.style.transform = 'rotate(360deg)';
  setTimeout(() => { icon.style.transform = 'rotate(0deg)'; icon.style.transition = 'none'; }, 650);

  chrome.runtime.sendMessage({ action: 'refreshStats' }, (res) => {
    if (res?.stats) {
      // Update profile if open
      const dropdown = document.getElementById('profileDropdown');
      if (dropdown?.classList.contains('open')) {
        const plan  = res.stats.plan || 'free';
        const sent  = res.stats.messagesSentToday ?? res.stats.messages_sent_today ?? 0;
        const limit = res.stats.messagesLimit ?? res.stats.messages_limit ?? 10;
        document.getElementById('profileEmail').textContent = res.stats.email || '--';
        document.getElementById('profilePhone').textContent = res.stats.phone || '--';
        document.getElementById('profilePlan').textContent  = plan.charAt(0).toUpperCase() + plan.slice(1) + ' plan';
        document.getElementById('profilePlanBadge').textContent = plan.charAt(0).toUpperCase() + plan.slice(1);
        document.getElementById('profileMsgs').textContent  = `${sent} / ${limit} used`;
      }
      populateSettingsInfo();
      showMessage('Stats refreshed', 'success');
    }
  });
});

document.getElementById('settingsBtn')?.addEventListener('click', (e) => {
  e.preventDefault();
  currentView = 'settings';
  mainContent.style.display = 'none';
  settingsPage.style.display = 'block';
  populateSettingsInfo();
});

document.getElementById('settingsBackBtn')?.addEventListener('click', (e) => {
  e.preventDefault();
  currentView = 'main';
  settingsPage.style.display = 'none';
  mainContent.style.display = 'block';
});

document.getElementById('settingsLogoutBtn')?.addEventListener('click', () => {
  if (confirm('Logout and clear session?')) {
    chrome.runtime.sendMessage({ action: 'logout' }, () => {
      settingsPage.style.display = 'none';
      showAuthScreen();
    });
  }
});

function populateSettingsInfo() {
  chrome.storage.local.get(['userStats'], (data) => {
    const stats = data.userStats;
    if (!stats) return;
    const elEmail = document.getElementById('settingsEmail');
    const elPhone = document.getElementById('settingsPhone');
    const elPlan  = document.getElementById('settingsPlan');
    const elBadge = document.getElementById('settingsPlanBadge');
    const elMsgs  = document.getElementById('settingsMsgsInfo');
    const plan = stats.plan || 'free';
    const planLabel = plan.charAt(0).toUpperCase() + plan.slice(1);
    const sent  = stats.messagesSentToday ?? stats.messagesSent ?? stats.messages_sent_today ?? 0;
    const limit = stats.messagesLimit ?? stats.messages_limit ?? 10;
    if (elEmail) elEmail.textContent = stats.email || '--';
    if (elPhone) elPhone.textContent = stats.phone || '--';
    if (elPlan)  elPlan.textContent  = planLabel + ' plan';
    if (elBadge) elBadge.textContent = planLabel;
    if (elMsgs)  elMsgs.textContent  = `${sent} / ${limit} used`;
  });
}

// ===== Profile Dropdown =====
(function initProfileDropdown() {
  const profileBtn      = document.getElementById('profileBtn');
  const profileDropdown = document.getElementById('profileDropdown');

  if (!profileBtn || !profileDropdown) return;

  function renderProfileData(stats) {
    const plan  = stats.plan || 'free';
    const sent  = stats.messagesSentToday ?? stats.messagesSent ?? stats.messages_sent_today ?? 0;
    const limit = stats.messagesLimit ?? stats.messages_limit ?? 10;

    if (stats.companyName !== undefined) document.getElementById('profileCompany').textContent = stats.companyName || '--';
    if (stats.email) document.getElementById('profileEmail').textContent = stats.email;
    if (stats.phone) document.getElementById('profilePhone').textContent = stats.phone;
    document.getElementById('profilePlan').textContent  = plan.charAt(0).toUpperCase() + plan.slice(1) + ' plan';
    document.getElementById('profilePlanBadge').textContent = plan.charAt(0).toUpperCase() + plan.slice(1);
    document.getElementById('profileMsgs').textContent  = `${sent} / ${limit} used`;
    if (stats.mediaUploadEnabled !== undefined) {
      document.getElementById('profileMedia').textContent = stats.mediaUploadEnabled ? '✅ Enabled' : '❌ Disabled';
    }
  }

  // Inline edit for company name
  const profileCompanyEl = document.getElementById('profileCompany');
  const profileCompanyInput = document.getElementById('profileCompanyInput');

  function startCompanyEdit() {
    const current = profileCompanyEl.textContent === '--' ? '' : profileCompanyEl.textContent;
    profileCompanyInput.value = current;
    profileCompanyEl.style.display = 'none';
    profileCompanyInput.style.display = 'inline-block';
    profileCompanyInput.focus();
  }

  async function saveCompanyEdit() {
    const newName = profileCompanyInput.value.trim();
    profileCompanyInput.style.display = 'none';
    profileCompanyEl.style.display = '';

    if (!newName || newName === profileCompanyEl.textContent) return;

    profileCompanyEl.textContent = newName;
    chrome.runtime.sendMessage({ action: 'updateCompany', data: { company_name: newName } }, (res) => {
      if (!res?.success) {
        alert('❌ Failed to update company name');
      }
    });
  }

  profileCompanyEl.addEventListener('click', startCompanyEdit);
  profileCompanyInput.addEventListener('blur', saveCompanyEdit);
  profileCompanyInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') profileCompanyInput.blur();
    if (e.key === 'Escape') {
      profileCompanyInput.style.display = 'none';
      profileCompanyEl.style.display = '';
    }
  });

  function openProfile() {
    profileDropdown.classList.add('open');
    profileBtn.classList.add('open');

    // Show cached data immediately
    chrome.storage.local.get(['userStats'], (data) => {
      if (data.userStats) renderProfileData(data.userStats);
    });

    // Then fetch fresh stats from backend
    chrome.runtime.sendMessage({ action: 'getAuthStatus' }, (response) => {
      if (!response?.authenticated) return;
      chrome.runtime.sendMessage({ action: 'refreshStats' }, (res) => {
        if (res?.stats) renderProfileData(res.stats);
      });
    });
  }

  function closeProfile() {
    profileDropdown.classList.remove('open');
    profileBtn.classList.remove('open');
  }

  profileBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    profileDropdown.classList.contains('open') ? closeProfile() : openProfile();
  });

  document.addEventListener('click', (e) => {
    if (!profileBtn.contains(e.target) && !profileDropdown.contains(e.target)) {
      closeProfile();
    }
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeProfile();
  });

  document.getElementById('profileLogoutBtn')?.addEventListener('click', () => {
    if (confirm('Logout and clear session?')) {
      chrome.runtime.sendMessage({ action: 'logout' }, () => {
        closeProfile();
        mainContent.style.display = 'none';
        showAuthScreen();
      });
    }
  });

  // Auto re-render profile when background refreshes stats
  chrome.runtime.onMessage.addListener((message) => {
    if (message.action === 'sessionExpired') {
      showToast('Session expired. Please login again.', 'error');
      setTimeout(() => showAuthScreen(), 1500);
      return;
    }
    if (message.action === 'statsUpdated' && message.stats) {
      renderProfileData(message.stats);
      populateSettingsInfo();
    }
  });
})();

// ===== Event Listeners =====

// Tab switcher
document.getElementById('mainTabBtn')?.addEventListener('click', () => switchTab('main'));
document.getElementById('progressTabBtn')?.addEventListener('click', () => switchTab('progress'));

// Open WhatsApp Web button
openWhatsAppBtn.addEventListener('click', async () => {
  // Check if WhatsApp Web is already open
  const existingTabs = await chrome.tabs.query({ url: 'https://web.whatsapp.com/*' });

  // Show loading spinner, hide button and steps
  const connectingLoader = document.getElementById('connectingLoader');
  openWhatsAppBtn.style.display = 'none';
  document.querySelector('.blocking-steps').style.display = 'none';
  document.querySelector('.blocking-hint').style.display = 'none';
  if (connectingLoader) connectingLoader.style.display = 'block';

  if (existingTabs.length > 0) {
    // Tab exists — reload it to re-inject content scripts, but DON'T focus it (focusing closes popup)
    blockingMessage.textContent = 'WhatsApp Web is open. Checking connection...';
    if (connectingLoader) document.getElementById('connectingText').textContent = 'Reconnecting to WhatsApp Web...';
    chrome.tabs.reload(existingTabs[0].id);
  } else {
    // No tab — open in background so popup stays open
    chrome.tabs.create({ url: 'https://web.whatsapp.com', active: false });
    blockingMessage.textContent = 'Opening WhatsApp Web... please wait.';
    if (connectingLoader) document.getElementById('connectingText').textContent = 'Connecting to WhatsApp Web...';
  }

  // Aggressive polling every 1s until connected (max 60 attempts)
  let pollCount = 0;
  const fastPoll = setInterval(() => {
    pollCount++;
    checkWhatsAppConnection();
    if (pollCount >= 60 || blockingScreen.style.display === 'none') {
      clearInterval(fastPoll);
    }
  }, 1000);
});

// Phone input field - Enter to add chip
phoneNumberInputEl.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') {
    e.preventDefault();
    const value = phoneNumberInputEl.value.trim();
    if (value) {
      addPhoneChip(value);
    }
  }
});

messageEl.addEventListener('input', () => {
  chrome.storage.local.set({ savedMessage: messageEl.value });
  updateCharCount();
});

delaySecEl.addEventListener('input', () => {
  chrome.storage.local.set({ savedDelay: delaySecEl.value });
  checkDelayWarning();
});

// Emoji picker
emojiBtn.addEventListener('click', (e) => {
  e.preventDefault();
  openEmojiPicker();
});

emojiModalClose.addEventListener('click', closeEmojiPicker);

emojiModal.addEventListener('click', (e) => {
  if (e.target === emojiModal) closeEmojiPicker();
});

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && emojiModal.style.display !== 'none') {
    closeEmojiPicker();
  }
});

// Bold formatting
boldBtn.addEventListener('click', (e) => {
  e.preventDefault();
  makeBoldSelected();
});

// Media upload
mediaBtn.addEventListener('click', (e) => {
  e.preventDefault();

  // Check subscription for media feature
  chrome.runtime.sendMessage({ action: 'checkMediaFeature' }, (response) => {
    if (response && response.allowed) {
      mediaInput.click();
    } else {
      showSubscriptionBlock('Media upload');
    }
  });
});

mediaInput.addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (file) {
    handleMediaUpload(file);
  }
});

mediaRemoveBtn.addEventListener('click', removeAttachedMedia);

// Subscription block modal
closeBlockBtn.addEventListener('click', closeSubscriptionBlock);
upgradeBtn.addEventListener('click', () => {
  showMessage('Redirecting to plans page...', 'info');
  // In production, navigate to upgrade page
  closeSubscriptionBlock();
});

subscriptionBlockModal.addEventListener('click', (e) => {
  if (e.target === subscriptionBlockModal) closeSubscriptionBlock();
});

// Start button
startBtn.addEventListener('click', async () => {
  const numbers = parsePhoneNumbers();
  const message = messageEl.value.trim();
  const delaySec = parseInt(delaySecEl.value) || 10;
  const randomize = randomizeDelayEl.checked;

  // Validation
  if (numbers.length === 0) {
    showMessage('Please enter at least one phone number', 'error');
    return;
  }

  if (!message) {
    showMessage('Please enter a message to send', 'error');
    return;
  }

  if (delaySec < 8) {
    showMessage('Delay must be at least 8 seconds for safety', 'error');
    return;
  }

  // Prepare queue
  const queue = numbers.map(number => ({
    number,
    message,
    media: attachedMedia || null
  }));

  // Send to background.js
  chrome.runtime.sendMessage({
    action: 'startQueue',
    data: { queue, delaySec, randomize, media: attachedMedia }
  }, (response) => {
    if (response && response.success) {
      isRunning = true;
      isPaused = false;
      showProgress();
      initMsgLog(numbers);
      const msg = response.queueLength < queue.length
        ? `Started! Sending ${response.queueLength} (daily limit). Keep WhatsApp Web tab open.`
        : 'Sending started! Keep WhatsApp Web tab open.';
      showMessage(msg, 'success');
    } else {
      showMessage(response?.error || 'Failed to start', 'error');
    }
  });
});

// Pause button
pauseBtn.addEventListener('click', () => {
  chrome.runtime.sendMessage({ action: 'pauseQueue' }, (response) => {
    if (response?.success) {
      isPaused = true;
      pauseBtn.textContent = '▶️ Resume';
      showMessage('Paused. Click Resume to continue.', 'info');
    }
  });
});

// Stop button
stopBtn.addEventListener('click', () => {
  if (confirm('Are you sure you want to stop sending?')) {
    chrome.runtime.sendMessage({ action: 'stopQueue' }, (response) => {
      if (response?.success) {
        isRunning = false;
        isPaused = false;
        hideProgress();
        showMessage('Stopped by user.', 'info');
      }
    });
  }
});

// Clear button
clearBtn.addEventListener('click', () => {
  if (confirm('Clear all phone numbers and message?')) {
    phoneChips = [];
    phoneNumbersEl.value = '';
    messageEl.value = '';
    phoneNumberInputEl.value = '';
    renderPhoneChips();
    chrome.storage.local.remove(['savedPhones', 'savedMessage']);
    updateNumberCount();
    updateCharCount();
    // Reset progress tab to empty state
    progressSection.style.display = 'none';
    document.getElementById('progressEmpty').style.display = 'flex';
    // Reset log
    logQueue = []; logProcessed = 0; logPrevSent = 0; logPrevFailed = 0;
    const logEl = document.getElementById('msgLog');
    if (logEl) logEl.style.display = 'none';
    const logBody = document.getElementById('msgLogBody');
    if (logBody) logBody.innerHTML = '';
    showMessage('Cleared successfully', 'success');
  }
});

// Import file (Upload Excel / txt / csv)
document.getElementById('importFile')?.addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (evt) => {
    const imported = evt.target.result.trim();
    const lines = imported.split('\n').filter(l => l.trim());
    let addedCount = 0;

    // Add each imported number as a chip
    lines.forEach(line => {
      const cleanNumber = line.replace(/\D/g, '');
      if (cleanNumber.length > 0 && !phoneChips.some(c => c.number === cleanNumber)) {
        phoneChips.push({
          number: cleanNumber,
          dialCode: selectedCountry.dialCode || '',
          flag: flagEmoji(selectedCountry.iso2)
        });
        addedCount++;
      }
    });

    if (addedCount > 0) {
      renderPhoneChips();
      savePhoneChips();
      updateNumberCount();
      showMessage(`${addedCount} number(s) imported`, 'success');
    } else {
      showMessage('No new numbers to import', 'warning');
    }
  };
  reader.readAsText(file);
  e.target.value = ''; // reset so same file can be re-imported
});

// ===== Functions =====

function initCountryPicker() {
  const btn       = document.getElementById('countryPickerBtn');
  const dropdown  = document.getElementById('countryDropdown');
  const searchEl  = document.getElementById('countrySearch');
  const listEl    = document.getElementById('countryList');
  const flagEl    = document.getElementById('selectedFlag');
  const codeEl    = document.getElementById('selectedDialCode');

  function renderList(filter = '') {
    const q = filter.toLowerCase();
    const filtered = COUNTRIES.filter(c =>
      c.name.toLowerCase().includes(q) || c.dialCode.includes(q)
    );
    listEl.innerHTML = filtered.map(c => `
      <div class="country-item ${selectedCountry && selectedCountry.iso2 === c.iso2 ? 'selected' : ''}"
           data-iso2="${c.iso2}">
        <span class="country-item-flag">${flagEmoji(c.iso2)}</span>
        <span class="country-item-name">${c.name}</span>
        <span class="country-item-code">${c.dialCode || '—'}</span>
      </div>
    `).join('');

    listEl.querySelectorAll('.country-item').forEach(item => {
      item.addEventListener('click', () => {
        const iso2 = item.dataset.iso2;
        selectedCountry = COUNTRIES.find(c => c.iso2 === iso2) || null;
        flagEl.textContent = flagEmoji(selectedCountry?.iso2 || '');
        codeEl.textContent = selectedCountry?.dialCode || 'None';

        // Update chips with new country info
        const newFlag = flagEmoji(selectedCountry?.iso2 || '');
        const newCode = selectedCountry?.dialCode || '';
        phoneChips.forEach(chip => {
          chip.flag = newFlag;
          chip.dialCode = newCode;
        });
        renderPhoneChips();
        savePhoneChips();

        chrome.storage.local.set({ savedCountry: selectedCountry?.iso2 || '' });
        closeDropdown();
        updateNumberCount();
      });
    });
  }

  function openDropdown() {
    dropdown.classList.add('open');
    btn.classList.add('open');
    searchEl.value = '';
    renderList();
    setTimeout(() => searchEl.focus(), 50);
  }

  function closeDropdown() {
    dropdown.classList.remove('open');
    btn.classList.remove('open');
  }

  // Set initial display
  flagEl.textContent = flagEmoji(selectedCountry?.iso2 || '');
  codeEl.textContent = selectedCountry?.dialCode || 'None';

  // Toggle on button click
  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    dropdown.classList.contains('open') ? closeDropdown() : openDropdown();
  });

  // Search filter
  searchEl.addEventListener('input', () => renderList(searchEl.value));

  // Close on outside click
  document.addEventListener('click', (e) => {
    if (!btn.contains(e.target) && !dropdown.contains(e.target)) {
      closeDropdown();
    }
  });

  // Close on Escape
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeDropdown();
  });
}

function parsePhoneNumbers() {
  // Use phoneChips array instead of textarea
  return phoneChips
    .map(chip => {
      let number = chip.number;
      // Extract country code digits from dialCode (e.g., "+91" -> "91")
      const countryCode = chip.dialCode.replace(/\D/g, '');

      // If number already starts with country code, remove it to avoid duplication
      if (number.startsWith(countryCode)) {
        number = number.substring(countryCode.length);
      }

      // Return dialCode + clean number (will be like "+91" + "9527773102")
      return chip.dialCode + number;
    })
    .filter(num => num.replace(/\D/g, '').length >= 10);
}

function updateNumberCount() {
  const numbers = parsePhoneNumbers();
  numberCountEl.textContent = numbers.length;
}

function updateCharCount() {
  const length = messageEl.value.length;
  charCountEl.textContent = `${length} / 4096`;

  if (length > 4096) {
    charCountEl.style.background = '#FEE2E2';
    charCountEl.style.color = '#991B1B';
  } else if (length > 3500) {
    charCountEl.style.background = '#FEF3C7';
    charCountEl.style.color = '#92400E';
  } else {
    charCountEl.style.background = '#F3F4F6';
    charCountEl.style.color = '#374151';
  }
}

function checkDelayWarning() {
  const delay = parseInt(delaySecEl.value) || 10;

  if (delay < 10) {
    delayWarningEl.style.display = 'block';
  } else {
    delayWarningEl.style.display = 'none';
  }
}

async function checkWhatsAppConnection() {
  try {
    // Find WhatsApp Web tab
    const tabs = await chrome.tabs.query({ url: 'https://web.whatsapp.com/*' });

    if (tabs.length === 0) {
      // WhatsApp Web not open - show blocking screen
      showBlockingScreen('WhatsApp Web is not open. Please open it first.');
      setConnectionStatus('error', 'WhatsApp Web not open');
      startBtn.disabled = true;
      return;
    }

    // Try to ping content.js
    chrome.tabs.sendMessage(tabs[0].id, { action: 'checkStatus' }, (response) => {
      if (chrome.runtime.lastError) {
        showBlockingScreen('Extension is loading on WhatsApp Web... Please wait.');
        setConnectionStatus('loading', 'Extension loading...');
        startBtn.disabled = true;
        return;
      }

      if (response && response.status === 'ready') {
        // Connected! Hide blocking screen, show main content
        hideBlockingScreen();
        setConnectionStatus('ready', 'WhatsApp Connected');
        startBtn.disabled = false;
      } else if (response && response.status === 'not_logged_in') {
        showBlockingScreen('Please scan the QR code on WhatsApp Web to log in.');
        setConnectionStatus('error', 'Please scan QR code');
        startBtn.disabled = true;
      } else if (response && response.status === 'loading') {
        showBlockingScreen('WhatsApp Web is loading... Please wait.');
        setConnectionStatus('loading', 'WhatsApp loading...');
        startBtn.disabled = true;
      } else {
        showBlockingScreen('Connection error. Try refreshing WhatsApp Web.');
        setConnectionStatus('error', 'Connection error');
        startBtn.disabled = true;
      }
    });
  } catch (error) {
    showBlockingScreen('Error checking connection. Please try again.');
    setConnectionStatus('error', 'Error checking connection');
    startBtn.disabled = true;
  }
}

function setConnectionStatus(status, text) {
  statusDot.className = 'indicator-dot ' + status;
  statusText.textContent = text;
}

function showBlockingScreen(message) {
  currentView = 'main';
  blockingScreen.style.display = 'flex';
  mainContent.style.display = 'none';
  settingsPage.style.display = 'none';
  if (message) {
    blockingMessage.textContent = message;
  }
}

function hideBlockingScreen() {
  blockingScreen.style.display = 'none';
  if (currentView === 'main') {
    mainContent.style.display = 'block';
  }
}

function initMsgLog(numbers) {
  logQueue      = numbers;
  logProcessed  = 0;
  logPrevSent   = 0;
  logPrevFailed = 0;

  const body = document.getElementById('msgLogBody');
  const log  = document.getElementById('msgLog');
  if (!body || !log) return;

  body.innerHTML = numbers.map((num, i) => `
    <div class="log-row" id="log-row-${i}">
      <span class="log-row-index">${i + 1}</span>
      <span class="log-row-num">${num}</span>
      <span class="log-badge waiting" id="log-badge-${i}">Waiting</span>
    </div>
  `).join('');

  log.style.display = 'block';
}

function updateMsgLog(sent, failed) {
  const processed = sent + failed;
  while (logProcessed < processed) {
    const badge = document.getElementById(`log-badge-${logProcessed}`);
    if (!badge) break;

    if (sent > logPrevSent) {
      badge.className = 'log-badge sent';
      badge.textContent = '✅ Sent';
      logPrevSent++;
    } else if (failed > logPrevFailed) {
      badge.className = 'log-badge failed';
      badge.textContent = '❌ Failed';
      logPrevFailed++;
    }

    // Scroll latest processed row into view
    const row = document.getElementById(`log-row-${logProcessed}`);
    row?.scrollIntoView({ block: 'nearest' });

    logProcessed++;
  }
}

function switchTab(tab) {
  const mainTab       = document.getElementById('mainTab');
  const progressTab   = document.getElementById('progressTab');
  const mainTabBtn    = document.getElementById('mainTabBtn');
  const progressTabBtn = document.getElementById('progressTabBtn');

  if (tab === 'progress') {
    mainTab.style.display       = 'none';
    progressTab.style.display   = 'block';
    mainTabBtn.classList.remove('active');
    progressTabBtn.classList.add('active');
  } else {
    mainTab.style.display       = 'block';
    progressTab.style.display   = 'none';
    mainTabBtn.classList.add('active');
    progressTabBtn.classList.remove('active');
  }
}

function showProgress() {
  progressSection.style.display = 'block';
  document.getElementById('progressEmpty').style.display = 'none';
  // Restore controls for new session
  pauseBtn.style.display = '';
  stopBtn.style.display = '';
  countdownEl.style.display = '';
  switchTab('progress');
}

function hideProgress() {
  // Keep progress section visible with final stats — just hide live controls
  pauseBtn.style.display = 'none';
  stopBtn.style.display = 'none';
  countdownEl.style.display = 'none';
}

function showMessage(text, type) {
  statusMessage.textContent = text;
  statusMessage.className = 'status-message ' + type;

  setTimeout(() => {
    statusMessage.className = 'status-message';
  }, 5000);
}

// ===== Listen for Progress Updates from Background =====
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'updateProgress') {
    const { sent, failed, total, nextIn } = request.data;

    sentCountEl.textContent = sent;
    failedCountEl.textContent = failed;
    totalCountEl.textContent = total;

    const progress = total > 0 ? Math.round((sent + failed) / total * 100) : 0;
    progressBar.style.width = progress + '%';

    updateMsgLog(sent, failed);

    if (nextIn !== undefined) {
      countdownEl.innerHTML = `Next message in: <strong>${nextIn}s</strong>`;
    }

    // Check if limit was reached mid-queue
    if (request.data.limitReached) {
      isRunning = false;
      hideProgress();
      showMessage(`Daily limit reached. Sent: ${sent} messages today.`, 'error');
      return;
    }

    // Check if finished
    if (sent + failed >= total && total > 0) {
      isRunning = false;
      hideProgress();
      showMessage(`Completed! Sent: ${sent}, Failed: ${failed}`, 'success');
    }
  }

  if (request.action === 'queueFinished') {
    isRunning = false;
    isPaused = false;
    hideProgress();
    showMessage(`All done! Sent: ${request.data.sent}, Failed: ${request.data.failed}`, 'success');
  }
});

// ===== INITIALIZATION COMPLETE =====
console.log('[Popup] ====== POPUP INITIALIZATION COMPLETE ======');
console.log('[Popup] Script loaded successfully at', new Date().toISOString());
console.log('[Popup] authScreen exists:', !!authScreen);
console.log('[Popup] mainContent exists:', !!mainContent);
console.log('[Popup] Waiting for service worker response...');
