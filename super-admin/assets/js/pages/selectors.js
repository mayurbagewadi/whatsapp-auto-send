/**
 * Selectors Management Page
 * Manage WhatsApp DOM selectors from Supabase
 * Table: wa_selectors (key text PK, value text)
 */

export function initSelectors(adminAPI) {

  const SELECTOR_KEYS = [
    {
      key: 'SELECTOR_SEND_BUTTON',
      label: 'Send Button',
      hint: 'CSS selector for the WhatsApp send button icon. Update this when WhatsApp changes their UI.',
      placeholder: '[data-icon="send"],[data-icon="wds-ic-send-filled"]'
    },
    {
      key: 'SELECTOR_ATTACHMENT_BUTTON',
      label: 'Attachment Button',
      hint: 'CSS selector for the attachment (paperclip/plus) button. Used to open the media menu.',
      placeholder: 'span[data-icon="plus"],span[data-icon="plus-rounded"]'
    },
    {
      key: 'SELECTOR_ATTACHMENT_MENU',
      label: 'Attachment Menu Items',
      hint: 'CSS selector for items inside the attachment submenu (Photos, Documents, etc.).',
      placeholder: '[role="menu"] [role="menuitem"],div[role="application"] li[role="button"]'
    },
    {
      key: 'SELECTOR_FILE_INPUT',
      label: 'File Input',
      hint: 'CSS selector for the hidden file input WhatsApp uses for media uploads.',
      placeholder: 'input[type="file"]'
    },
    {
      key: 'SELECTOR_CHAT_INPUT',
      label: 'Chat Input',
      hint: 'CSS selector for the main message text box. Used to confirm a chat is open and ready.',
      placeholder: '[contenteditable="true"]'
    },
    {
      key: 'SELECTOR_CAPTION_INPUT',
      label: 'Caption Input',
      hint: 'CSS selector for the caption text box that appears after attaching a media file.',
      placeholder: '[aria-label="Add a caption"]'
    }
  ];

  // ===== Load selectors from Supabase =====
  async function loadSelectors() {
    const statusEl = document.getElementById('selectorsStatus');
    const saveBtn  = document.getElementById('selectorsSaveBtn');

    try {
      statusEl.textContent = 'Loading...';
      statusEl.className = 'selectors-status loading';

      const rows = await adminAPI.request('GET', 'wa_selectors?select=key,value');

      // Map to object
      const data = {};
      rows.forEach(row => { data[row.key] = row.value; });

      // Fill inputs
      SELECTOR_KEYS.forEach(({ key }) => {
        const input = document.getElementById(`sel_${key}`);
        if (input && data[key]) input.value = data[key];
      });

      statusEl.textContent = '✓ Loaded from Supabase';
      statusEl.className = 'selectors-status success';
      saveBtn.disabled = false;

    } catch (e) {
      statusEl.textContent = '✗ Failed to load: ' + e.message;
      statusEl.className = 'selectors-status error';
    }
  }

  // ===== Save selectors to Supabase =====
  async function saveSelectors() {
    const statusEl = document.getElementById('selectorsStatus');
    const saveBtn  = document.getElementById('selectorsSaveBtn');

    saveBtn.disabled = true;
    statusEl.textContent = 'Saving...';
    statusEl.className = 'selectors-status loading';

    try {
      // Upsert each selector
      for (const { key } of SELECTOR_KEYS) {
        const input = document.getElementById(`sel_${key}`);
        if (!input || !input.value.trim()) continue;

        await fetch(`${adminAPI.restUrl}/wa_selectors`, {
          method: 'POST',
          headers: {
            ...adminAPI.getHeaders(),
            'Prefer': 'resolution=merge-duplicates,return=minimal'
          },
          body: JSON.stringify({ key, value: input.value.trim() })
        });
      }

      statusEl.textContent = '✓ Saved! All extensions will update automatically.';
      statusEl.className = 'selectors-status success';
      window.showToast('Selectors saved successfully!', 'success');

    } catch (e) {
      statusEl.textContent = '✗ Save failed: ' + e.message;
      statusEl.className = 'selectors-status error';
      window.showToast('Save failed: ' + e.message, 'error');
    } finally {
      saveBtn.disabled = false;
    }
  }

  // ===== Render tab content =====
  function renderSelectorsTab() {
    const container = document.getElementById('selectorsTabContent');
    if (!container) return;

    const rows = SELECTOR_KEYS.map(({ key, label, hint, placeholder }) => `
      <div class="form-group">
        <label for="sel_${key}">
          ${label}
          <code class="selector-key-badge">${key}</code>
        </label>
        <input
          type="text"
          id="sel_${key}"
          class="input-field selector-value-input"
          placeholder="${placeholder}"
        />
        <small class="text-muted">${hint}</small>
      </div>
    `).join('');

    container.innerHTML = `
      <div class="page-header">
        <h2>Selector Management</h2>
        <p class="text-muted">Update WhatsApp DOM selectors. Changes apply to all users instantly.</p>
      </div>

      <div class="selectors-status-bar">
        <span id="selectorsStatus" class="selectors-status">Ready</span>
        <button class="btn btn-sm btn-secondary" id="selectorsLoadBtn">↺ Reload</button>
      </div>

      <div class="section">
        <h3>WhatsApp Selectors</h3>
        <div class="selectors-form">
          ${rows}
          <div class="button-group" style="margin-top: 20px;">
            <button class="btn btn-primary" id="selectorsSaveBtn" disabled>
              ✓ Save to Supabase
            </button>
          </div>
        </div>
      </div>

      <div class="section">
        <h3>How it works</h3>
        <p class="text-muted" style="line-height:1.7;">
          When WhatsApp updates their UI, selectors may break. Update the values here and click Save —
          all installed extensions will fetch the new selectors automatically within minutes.
          No extension update or user action required.
        </p>
      </div>
    `;

    // Attach events
    document.getElementById('selectorsLoadBtn').addEventListener('click', loadSelectors);
    document.getElementById('selectorsSaveBtn').addEventListener('click', saveSelectors);

    // Auto load
    loadSelectors();
  }

  renderSelectorsTab();
}
