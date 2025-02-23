// voiceNav.js
let recognition = null;
let isListening = false;

/**
 * Initialize the SpeechRecognition API and set up event handlers.
 */
function initVoiceNav() {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) {
    console.warn('SpeechRecognition API not supported in this browser.');
    alert('Your browser does not support the SpeechRecognition API.');
    return;
  }

  recognition = new SpeechRecognition();
  recognition.continuous = true;
  recognition.interimResults = false;
  recognition.lang = 'en-US';

  recognition.onresult = (event) => {
    const transcript = event.results[event.results.length - 1][0].transcript.trim();
    console.log('[VoiceNav] Heard:', transcript);
    handleVoiceCommand(transcript);
  };

  recognition.onerror = (event) => {
    console.error('[VoiceNav] Error:', event.error);
  };

  // If we want auto-restart:
  recognition.onend = () => {
    if (isListening) {
      recognition.start();
    }
  };
}

/**
 * Start/Stop voice recognition.
 */
function toggleVoiceNav() {
  if (!recognition) {
    initVoiceNav();
  }
  if (!recognition) {
    return; // Could not init
  }

  if (!isListening) {
    isListening = true;
    recognition.start();
    console.log('[VoiceNav] ON');
    alert('Voice navigation ON. Try commands like "Scroll down", "Go back", etc.');
  } else {
    isListening = false;
    recognition.stop();
    console.log('[VoiceNav] OFF');
    alert('Voice navigation OFF.');
  }
}

/**
 * Handle recognized speech command.
 */
// scrollInterval is already declared later in the file, removing duplicate declaration

function handleVoiceCommand(transcript) {
  const command = transcript.toLowerCase();

  // Add this new condition before other commands
  if (command.includes('summarize page')) {
    summarizePage();
    return;
  }

  if (command.includes('scroll down')) {
    startContinuousScroll('down');
    console.log('[VoiceNav] Started scrolling down');
    return;
  }
  if (command.includes('scroll up')) {
    startContinuousScroll('up');
    console.log('[VoiceNav] Started scrolling up');
    return;
  }
  if (command.includes('stop')) {
    stopContinuousScroll();
    console.log('[VoiceNav] Stopped scrolling');
    return;
  }
  if (command.includes('go back')) {
    window.history.back();
    return;
  }
  if (command.includes('go forward')) {
    window.history.forward();
    return;
  }
  if (command.includes('reload page') || command.includes('refresh page')) {
    window.location.reload();
    return;
  }

  // "Click link X"
  if (command.startsWith('click link')) {
    const linkText = command.replace('click link', '').trim();
    if (linkText) {
      clickLinkByText(linkText);
    } else {
      alert('No link text specified. Try "Click link [text]".');
    }
    return;
  }

  // "Open tab X"
  if (command.startsWith('open')) {
    const urlPart = command.replace('open', '').trim();
    if (urlPart) {
      openNewTab(urlPart+'.com');
    } else {
      alert('No URL specified. Try "Open tab example.com".');
    }
    return;
  }

  // Unrecognized command
  console.log('[VoiceNav] Unrecognized command:', transcript);
}

// Add these new functions after handleVoiceCommand
let scrollInterval = null;

function startContinuousScroll(direction) {
  // Clear any existing scroll first
  stopContinuousScroll();
  
  // Set smaller step size and faster interval for smoother scrolling
  const step = direction === 'down' ? 30 : -30;
  
  scrollInterval = setInterval(() => {
    window.scrollBy({
      top: step,
      behavior: 'smooth'
    });
  }, 50);
}

function stopContinuousScroll() {
  if (scrollInterval) {
    clearInterval(scrollInterval);
    scrollInterval = null;
  }
}

/**
 * Find a link that has linkText in its innerText (case-insensitive) and click it.
 */
function clickLinkByText(text) {
  const links = Array.from(document.querySelectorAll('a'));
  const matching = links.filter(a => a.innerText.trim().toLowerCase().includes(text.toLowerCase()));
  if (matching.length === 0) {
    alert(`No link found with text matching "${text}".`);
  } else if (matching.length > 1) {
    matching[0].click();
    alert(`Multiple links matched. Clicking the first: "${matching[0].innerText}"`);
  } else {
    matching[0].click();
  }
}

/**
 * Open a new tab. We just do window.open here;
 * If you prefer chrome.tabs.create, you need "tabs" permission
 * and run from background/popup script.
 */
function openNewTab(urlPart) {
  let urlToOpen = urlPart;
  if (!/^https?:\/\//i.test(urlToOpen)) {
    urlToOpen = 'https://' + urlPart;
  }
  window.open(urlToOpen, '_blank');
}

// Add these new functions at the end of the file before the message listener
async function summarizePage() {
  try {
    // Get all text content from the page
    const pageContent = document.body.innerText;
    const summary = await getSummaryFromGPT(pageContent);
    
    // Create overlay for the summary
    createSummaryOverlay(summary);
    
    // Read the summary aloud
    speakText(summary);
  } catch (error) {
    console.error('Summarization error:', error);
    alert('Could not summarize the page. Please try again.');
  }
}

function createSummaryOverlay(summary) {
  let overlay = document.querySelector('.summary-overlay');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.className = 'summary-overlay';
    overlay.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      max-width: 400px;
      max-height: 80vh;
      overflow-y: auto;
      background-color: rgba(0, 0, 0, 0.9);
      color: white;
      padding: 20px;
      border-radius: 10px;
      z-index: 999999;
      font-family: sans-serif;
    `;
    document.body.appendChild(overlay);
  }
  overlay.innerHTML = `
    <h3>Page Summary</h3>
    <p>${summary}</p>
    <button onclick="this.parentElement.remove()" style="
      padding: 5px 10px;
      margin-top: 10px;
      background: #666;
      color: white;
      border: none;
      border-radius: 5px;
      cursor: pointer;
    ">Close</button>
  `;
}

async function getSummaryFromGPT(content) {
  try {
    return new Promise((resolve, reject) => {
      chrome.runtime.sendMessage({
        type: 'SUMMARIZE_TEXT',
        content: content.substring(0, 5000) // Limit content length
      }, response => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
          return;
        }
        if (response && response.error) {
          reject(new Error(response.error));
          return;
        }
        if (response && response.summary) {
          resolve(response.summary);
        } else {
          reject(new Error('Invalid response from summarization'));
        }
      });
    });
  } catch (error) {
    throw new Error('Failed to get summary: ' + error.message);
  }
}

function speakText(text) {
  // Cancel any ongoing speech
  window.speechSynthesis.cancel();

  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = 'en-US';
  utterance.rate = 1.0;
  utterance.pitch = 1.0;
  utterance.volume = 1.0;

  // Add error handling
  utterance.onerror = (event) => {
    console.error('[VoiceNav] Speech synthesis error:', event.error);
    alert('Could not read the text aloud. Please try again.');
  };

  // Check if synthesis is available
  if (!window.speechSynthesis) {
    console.error('[VoiceNav] Speech synthesis not supported');
    alert('Your browser does not support text-to-speech.');
    return;
  }

  // Ensure voices are loaded
  if (speechSynthesis.getVoices().length === 0) {
    speechSynthesis.addEventListener('voiceschanged', () => {
      const voices = speechSynthesis.getVoices();
      // Try to find an English voice
      const englishVoice = voices.find(voice => voice.lang.includes('en-'));
      if (englishVoice) {
        utterance.voice = englishVoice;
      }
      window.speechSynthesis.speak(utterance);
    });
  } else {
    const voices = speechSynthesis.getVoices();
    const englishVoice = voices.find(voice => voice.lang.includes('en-'));
    if (englishVoice) {
      utterance.voice = englishVoice;
    }
    window.speechSynthesis.speak(utterance);
  }
}

// Listen for messages from popup.js
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'toggleVoiceNav') {
    toggleVoiceNav();
  }
});
