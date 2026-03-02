// ===== Debug Script for Premium Sender =====
// Run this in WhatsApp Web console to see what Premium Sender clicks

console.log('[DEBUG] Premium Sender Debug Script Loaded');

// Hook into psLib to see selectors
if (window.psLib) {
  const originalUpdateDS = window.psLib.updateDS;

  window.psLib.updateDS = function(selectors) {
    console.log('[DEBUG] === Premium Sender Selectors Updated ===');
    console.log('[DEBUG] SELECTOR_SEND_BUTTON:', selectors.SELECTOR_SEND_BUTTON);
    console.log('[DEBUG] SELECTOR_ADD_ATTACHMENT_BUTTON:', selectors.SELECTOR_ADD_ATTACHMENT_BUTTON);
    console.log('[DEBUG] SELECTOR_MESSAGE_INPUT:', selectors.SELECTOR_MESSAGE_INPUT);
    console.log('[DEBUG] All selectors:', selectors);

    // Call original
    return originalUpdateDS.call(this, selectors);
  };

  console.log('[DEBUG] psLib hooked');
}

// Monitor all clicks on buttons
document.addEventListener('click', function(e) {
  if (e.target && e.target.tagName === 'BUTTON') {
    console.log('[DEBUG] Button clicked:', {
      text: e.target.innerText,
      ariaLabel: e.target.getAttribute('aria-label'),
      className: e.target.className,
      dataTestId: e.target.getAttribute('data-testid'),
      dataIcon: e.target.getAttribute('data-icon'),
      position: {
        top: e.target.getBoundingClientRect().top,
        right: e.target.getBoundingClientRect().right,
        bottom: e.target.getBoundingClientRect().bottom,
        left: e.target.getBoundingClientRect().left
      }
    });
  }
}, true);

console.log('[DEBUG] Click monitoring enabled');

// Also log any element found by selector
const originalQuerySelector = document.querySelector;
document.querySelector = function(selector) {
  const result = originalQuerySelector.call(this, selector);

  if (selector && selector.includes('SELECTOR') && result) {
    console.log('[DEBUG] querySelector found:', {
      selector: selector,
      element: result,
      ariaLabel: result.getAttribute ? result.getAttribute('aria-label') : null,
      text: result.innerText ? result.innerText.substring(0, 50) : null
    });
  }

  return result;
};

console.log('[DEBUG] === Script Ready ===');
console.log('[DEBUG] Now open a chat and try to send a message with Premium Sender');
console.log('[DEBUG] Watch console for [DEBUG] messages showing what button is clicked');
