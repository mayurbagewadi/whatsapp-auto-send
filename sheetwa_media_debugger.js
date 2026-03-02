// ===== SheetWA Media Send Debugger =====
// Monitors what SheetWA does when sending media + text
// Paste this in browser console while using SheetWA

console.log('[DEBUGGER] SheetWA Media Send Monitor Started');

// Track file input changes
document.addEventListener('change', (e) => {
  if (e.target.type === 'file') {
    console.log('[FILE INPUT CHANGE]', {
      timestamp: new Date().toLocaleTimeString(),
      files: e.target.files.length,
      fileNames: Array.from(e.target.files).map(f => f.name),
      inputElement: e.target
    });
  }
}, true);

// Track all input/textarea changes
const originalSetValue = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value');
Object.defineProperty(HTMLInputElement.prototype, 'value', {
  set: function(val) {
    if (this.type === 'text' || this.placeholder?.toLowerCase().includes('caption') || this.placeholder?.toLowerCase().includes('message')) {
      console.log('[INPUT VALUE SET]', {
        timestamp: new Date().toLocaleTimeString(),
        type: this.type,
        placeholder: this.placeholder,
        newValue: val?.substring(0, 50),
        selector: this.className
      });
    }
    originalSetValue.set.call(this, val);
  },
  get: originalSetValue.get
});

// Monitor contenteditable fields
const observer = new MutationObserver((mutations) => {
  mutations.forEach((mutation) => {
    if (mutation.target.contentEditable === 'true') {
      console.log('[CONTENTEDITABLE CHANGE]', {
        timestamp: new Date().toLocaleTimeString(),
        text: mutation.target.textContent?.substring(0, 50),
        selector: mutation.target.getAttribute('class'),
        nodeType: mutation.type
      });
    }
  });
});

observer.observe(document.body, {
  characterData: true,
  childList: true,
  subtree: true,
  attributes: false
});

// Monitor attachment button clicks
document.addEventListener('click', (e) => {
  const btn = e.target.closest('[aria-label*="attach"], [aria-label*="Attach"], button[title*="attach"]');
  if (btn) {
    console.log('[ATTACHMENT BUTTON CLICKED]', {
      timestamp: new Date().toLocaleTimeString(),
      ariaLabel: btn.getAttribute('aria-label'),
      className: btn.className
    });
  }

  // Monitor send button clicks
  const sendBtn = e.target.closest('[data-icon="send"], [aria-label*="send"]');
  if (sendBtn) {
    console.log('[SEND BUTTON CLICKED]', {
      timestamp: new Date().toLocaleTimeString(),
      ariaLabel: sendBtn.getAttribute('aria-label'),
      dataIcon: sendBtn.getAttribute('data-icon')
    });

    // Check input field state at moment of send
    const inputs = document.querySelectorAll('[contenteditable="true"]');
    console.log('[INPUT STATE AT SEND]', {
      inputCount: inputs.length,
      inputs: Array.from(inputs).map((inp, idx) => ({
        index: idx,
        text: inp.textContent?.substring(0, 50),
        hasText: (inp.textContent || '').trim().length > 0,
        placeholder: inp.getAttribute('placeholder')
      }))
    });
  }
}, true);

// Monitor DOM additions (caption field appearing)
const additionObserver = new MutationObserver((mutations) => {
  mutations.forEach((mutation) => {
    Array.from(mutation.addedNodes).forEach((node) => {
      if (node.nodeType === 1) { // Element node
        if (node.getAttribute?.('aria-label')?.toLowerCase().includes('caption') ||
            node.getAttribute?.('placeholder')?.toLowerCase().includes('caption')) {
          console.log('[CAPTION FIELD APPEARED]', {
            timestamp: new Date().toLocaleTimeString(),
            ariaLabel: node.getAttribute('aria-label'),
            placeholder: node.getAttribute('placeholder'),
            selector: node.className
          });
        }
      }
    });
  });
});

additionObserver.observe(document.body, {
  childList: true,
  subtree: true
});

// Monitor file input visibility changes
const visibilityObserver = new MutationObserver((mutations) => {
  mutations.forEach((mutation) => {
    if (mutation.target.type === 'file') {
      const isVisible = mutation.target.offsetParent !== null;
      console.log('[FILE INPUT VISIBILITY]', {
        timestamp: new Date().toLocaleTimeString(),
        visible: isVisible,
        display: window.getComputedStyle(mutation.target).display,
        position: window.getComputedStyle(mutation.target).position
      });
    }
  });
});

visibilityObserver.observe(document.body, {
  attributes: true,
  attributeFilter: ['style', 'class'],
  subtree: true
});

console.log('[DEBUGGER] ✓ All monitors active. Try sending media + text now.');
console.log('[DEBUGGER] Check console for logs of each action');
