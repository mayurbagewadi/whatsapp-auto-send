// ===== Media Fallback Handler (SheetWA Approach) =====
// Uses DOM clicking + attachment button when injected.js API fails
// This is a fallback, not a replacement for the internal API approach

/**
 * SheetWA-style media sending: uses DOM interactions instead of internal API
 * @param {Object} selectors - CSS selectors from Supabase {attachmentBtn, fileInput, sendBtn, etc.}
 * @param {string} base64 - Base64 encoded file
 * @param {string} mimeType - File MIME type
 * @param {string} fileName - Original file name
 * @param {string} caption - Message caption/text to send with media
 * @returns {Promise<{success: boolean, method: string}>}
 */
async function sendMediaViaDOM(selectors, base64, mimeType, fileName, caption) {
  console.log('[MediaFallback] Starting DOM-based media send:', fileName);

  try {
    // Step 1: Find attachment button
    const attachBtn = document.querySelector(selectors.attachmentBtn || '[aria-label="Attach"]');
    if (!attachBtn) {
      throw new Error('Attachment button not found');
    }

    // Step 2: Click attachment button to show menu
    attachBtn.click();
    await new Promise(r => setTimeout(r, 500));

    // Step 3: Detect media type and click appropriate menu item
    const isImage = mimeType.startsWith('image/');
    const isVideo = mimeType.startsWith('video/');
    const isPDF = mimeType === 'application/pdf';

    let menuItem = null;
    if (isImage) {
      // Look for "Photos & Videos" or "Photos" menu item
      const menuItems = Array.from(document.querySelectorAll('[role="menuitem"], [role="option"]'));
      menuItem = menuItems.find(item =>
        /photo|image|gallery/i.test(item.textContent)
      );
    } else if (isVideo) {
      const menuItems = Array.from(document.querySelectorAll('[role="menuitem"], [role="option"]'));
      menuItem = menuItems.find(item =>
        /video|gallery/i.test(item.textContent)
      );
    } else if (isPDF) {
      const menuItems = Array.from(document.querySelectorAll('[role="menuitem"], [role="option"]'));
      menuItem = menuItems.find(item =>
        /document|file/i.test(item.textContent)
      );
    }

    if (menuItem) {
      menuItem.click();
      await new Promise(r => setTimeout(r, 800));
    }

    // Step 4: Find and fill file input
    const fileInputs = document.querySelectorAll('input[type="file"]');
    if (fileInputs.length === 0) {
      throw new Error('File input not found');
    }

    const fileInput = Array.from(fileInputs).pop(); // Use last/most recent

    // Convert base64 to File
    const byteStr = atob(base64);
    const ab = new ArrayBuffer(byteStr.length);
    const ia = new Uint8Array(ab);
    for (let i = 0; i < byteStr.length; i++) ia[i] = byteStr.charCodeAt(i);
    const blob = new Blob([ab], { type: mimeType });
    const file = new File([blob], fileName, { type: mimeType });

    // Inject file into input
    const dt = new DataTransfer();
    dt.items.add(file);
    fileInput.files = dt.files;

    // Trigger change event
    fileInput.dispatchEvent(new Event('change', { bubbles: true }));

    console.log('[MediaFallback] File injected, waiting for preview UI...');
    await new Promise(r => setTimeout(r, 1500));

    // Step 5: Wait for WhatsApp preview/upload UI to appear
    let previewFound = false;
    for (let i = 0; i < 30; i++) {
      const preview = document.querySelector(
        '[data-testid="image-wrapper"], [data-testid="video-wrapper"], .msg-preview, [class*="preview"]'
      );
      if (preview) {
        previewFound = true;
        console.log('[MediaFallback] Media preview found');
        break;
      }
      await new Promise(r => setTimeout(r, 300));
    }

    if (!previewFound) {
      console.warn('[MediaFallback] Preview UI not found, proceeding with send anyway');
    }

    // Step 6: Add caption to input field if provided
    if (caption) {
      const messageInput = document.querySelector(
        selectors.messageInput || '[aria-label="Type a message"], [contenteditable="true"][data-tab="6"]'
      );

      if (messageInput) {
        messageInput.focus();
        messageInput.textContent = caption;

        // Trigger input event for WhatsApp
        messageInput.dispatchEvent(new Event('input', { bubbles: true }));
        messageInput.dispatchEvent(new Event('change', { bubbles: true }));

        console.log('[MediaFallback] Caption added');
        await new Promise(r => setTimeout(r, 300));
      }
    }

    // Step 7: Click send button
    const sendBtn = document.querySelector(
      selectors.sendBtn || '[aria-label="Send"], [data-testid="send"]'
    );

    if (!sendBtn) {
      throw new Error('Send button not found');
    }

    sendBtn.click();
    console.log('[MediaFallback] Send button clicked');

    // Step 8: Confirm send by polling for message disappearance
    for (let i = 0; i < 60; i++) {
      const input = document.querySelector(
        selectors.messageInput || '[aria-label="Type a message"], [contenteditable="true"][data-tab="6"]'
      );

      if (!input || input.textContent.trim() === '' || input.innerHTML === '' || input.innerHTML === '<br>') {
        console.log('[MediaFallback] ✅ Message confirmed sent (input cleared)');
        return { success: true, method: 'dom-fallback' };
      }

      await new Promise(r => setTimeout(r, 500));
    }

    // If we get here, assume sent (max timeout reached but button was clicked)
    console.log('[MediaFallback] ✅ Send completed (timeout)');
    return { success: true, method: 'dom-fallback-timeout' };

  } catch (error) {
    console.error('[MediaFallback] ❌ Error:', error.message);
    throw error;
  }
}

// Export for use in content.js
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { sendMediaViaDOM };
}
