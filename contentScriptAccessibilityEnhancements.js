// contentScriptAccessibilityEnhancements.js

let dyslexiaModeOn = false;
let focusLensOn = false;
let accessibleLayoutOn = false;
let highContrastOn = false;

// We'll store the user's chosen font size for Dyslexia mode
let dyslexiaFontSize = 18; // default

// We'll store references to our style blocks, so we can remove them if needed
let styleElementDyslexia = null;
let styleElementFocus = null;
let styleElementHighContrast = null;
let styleElementAccessibleImages = null;

// For the accessible layout, we store a clone to revert
let originalDOMClone = null;

// Listen for toggles and slider changes
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'toggleDyslexiaMode') {
    dyslexiaModeOn = !dyslexiaModeOn;
    toggleDyslexiaMode(dyslexiaModeOn);
  }
  else if (message.action === 'setDyslexiaFontSize') {
    // user moved the slider
    dyslexiaFontSize = message.size;
    if (dyslexiaModeOn) {
      updateDyslexiaCSS(dyslexiaFontSize);
    }
  }
  else if (message.action === 'toggleFocusLens') {
    focusLensOn = !focusLensOn;
    toggleFocusLens(focusLensOn);
  }
  else if (message.action === 'toggleAccessibleLayout') {
    accessibleLayoutOn = !accessibleLayoutOn;
    toggleAccessibleLayout(accessibleLayoutOn);
  }
  else if (message.action === 'toggleHighContrast') {
    highContrastOn = !highContrastOn;
    toggleHighContrast(highContrastOn);
  }
});

/** =============== 1) Dyslexia-Friendly Font & Spacing with Slider =============== **/
function toggleDyslexiaMode(enable) {
  if (enable) {
    alert('Dyslexia-Friendly Mode ON');
    injectDyslexiaCSS(dyslexiaFontSize);
  } else {
    alert('Dyslexia-Friendly Mode OFF');
    removeDyslexiaCSS();
  }
}

function injectDyslexiaCSS(fontSizePx) {
  if (styleElementDyslexia) return; // already injected

  styleElementDyslexia = document.createElement('style');
  styleElementDyslexia.innerHTML = `
    @import url('https://fonts.cdnfonts.com/css/open-dyslexic');
    body * {
      font-family: 'OpenDyslexicRegular', sans-serif !important;
      line-height: 1.6 !important;
      letter-spacing: 0.04em !important;
      font-size: ${fontSizePx}px !important;
    }
  `;
  document.head.appendChild(styleElementDyslexia);
}

// If the user changes the slider while dyslexia mode is on, update the style
function updateDyslexiaCSS(fontSizePx) {
  if (!styleElementDyslexia) return;
  styleElementDyslexia.innerHTML = `
    @import url('https://fonts.cdnfonts.com/css/open-dyslexic');
    body * {
      font-family: 'OpenDyslexicRegular', sans-serif !important;
      line-height: 1.6 !important;
      letter-spacing: 0.04em !important;
      font-size: ${fontSizePx}px !important;
    }
  `;
}

function removeDyslexiaCSS() {
  if (styleElementDyslexia) {
    styleElementDyslexia.remove();
    styleElementDyslexia = null;
  }
}

/** =============== 2) High Contrast Mode =============== **/
function toggleHighContrast(enable) {
  if (enable) {
    alert('High Contrast Mode ON');
    injectHighContrastCSS();
  } else {
    alert('High Contrast Mode OFF');
    removeHighContrastCSS();
  }
}

function injectHighContrastCSS() {
  if (styleElementHighContrast) return;

  styleElementHighContrast = document.createElement('style');
  styleElementHighContrast.innerHTML = `
    /* Simple high contrast: black background, white text, yellow links, etc. */
    body.high-contrast, body.high-contrast * {
      background-color: #000 !important;
      color: #fff !important;
    }
    body.high-contrast a {
      color: #ff0 !important; /* bright yellow */
    }
  `;
  document.head.appendChild(styleElementHighContrast);
  document.body.classList.add('high-contrast');
}

function removeHighContrastCSS() {
  if (styleElementHighContrast) {
    styleElementHighContrast.remove();
    styleElementHighContrast = null;
  }
  document.body.classList.remove('high-contrast');
}

/** =============== 3) Focus Lens Mode =============== **/
function toggleFocusLens(enable) {
    if (enable) {
      alert('Focus Lens Mode ON');
      enableFocusLens();
    } else {
      alert('Focus Lens Mode OFF');
      disableFocusLens();
    }
  }
  
  /**
   * Enable the "paragraph/headings only" focus lens
   */
  function enableFocusLens() {
    // If we haven't injected the style yet, create it
    if (!styleElementFocus) {
      styleElementFocus = document.createElement('style');
  
      styleElementFocus.innerHTML = `
        /* By default, paragraphs and headings are blurred */
        body.focus-lens p,
        body.focus-lens h1,
        body.focus-lens h2,
        body.focus-lens h3,
        body.focus-lens h4,
        body.focus-lens h5 {
          filter: blur(3px);
          opacity: 0.4;
          transition: filter 0.2s ease-out, opacity 0.2s ease-out;
        }
  
        /* When you hover a paragraph or heading, it becomes clear */
        body.focus-lens p:hover,
        body.focus-lens h1:hover,
        body.focus-lens h2:hover,
        body.focus-lens h3:hover,
        body.focus-lens h4:hover,
        body.focus-lens h5:hover {
          filter: none !important;
          opacity: 1 !important;
        }
      `;
  
      document.head.appendChild(styleElementFocus);
    }
  
    // Add a class to <body> so the style applies
    document.body.classList.add('focus-lens');
  }
  
  /**
   * Disable the Focus Lens
   */
  function disableFocusLens() {
    // Just remove the 'focus-lens' class
    if (styleElementFocus) {
      document.body.classList.remove('focus-lens');
    }
  }
  
/** =============== 4) AI-Powered Accessible Layout =============== **/
function toggleAccessibleLayout(enable) {
  if (enable) {
    alert('Accessible Layout ON');
    if (!originalDOMClone) {
      originalDOMClone = document.body.cloneNode(true);
    }
    enableAccessibleLayout();
  } else {
    alert('Accessible Layout OFF');
    if (originalDOMClone) {
      document.body.replaceWith(originalDOMClone);
      originalDOMClone = null;
    }
    // remove style that resizes images
    if (styleElementAccessibleImages) {
      styleElementAccessibleImages.remove();
      styleElementAccessibleImages = null;
    }
  }
}

async function enableAccessibleLayout() {
  const cleanedHTML = await getAIDOMStructure(document.body.innerHTML);
  document.body.innerHTML = cleanedHTML;
  // Also inject a style to ensure images aren't huge
  injectAccessibleImageCSS();
}

/** for ensuring images have max-width so icons won't blow up the page */
function injectAccessibleImageCSS() {
  if (!styleElementAccessibleImages) {
    styleElementAccessibleImages = document.createElement('style');
    styleElementAccessibleImages.innerHTML = `
      body img {
        max-width: 500px !important; 
        height: auto !important;
      }
    `;
    document.head.appendChild(styleElementAccessibleImages);
  }
}

/**
 * Call background to do an "AI parse" that tries to reorganize or remove clutter.
 * This is a placeholder demonstration. 
 */
function getAIDOMStructure(html) {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage({
      type: 'AI_PAGE_REFORMAT',
      htmlContent: html
    }, (response) => {
      if (chrome.runtime.lastError) {
        return reject(new Error(chrome.runtime.lastError.message));
      }
      if (!response) {
        return reject(new Error('No response from AI page reformat.'));
      }
      if (response.error) {
        return reject(new Error(response.error));
      }
      // returned 'cleanHTML'
      resolve(response.cleanHTML);
    });
  });
}
