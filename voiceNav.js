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

  // Auto-restart if the user wants continuous listening
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
  if (!recognition) return; // Could not initialize

  if (!isListening) {
    isListening = true;
    recognition.start();
    console.log('[VoiceNav] ON');
    alert('Voice navigation ON. Try commands like "Scroll down", "Go back", "Summarize page", etc.');
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
function handleVoiceCommand(transcript) {
  const command = transcript.toLowerCase();

  // Summarize the page
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

  // "Open tab X" or "Open X"
  if (command.startsWith('open')) {
    const urlPart = command.replace('open', '').trim();
    if (urlPart) {
      openNewTab(urlPart + '.com');
    } else {
      alert('No URL specified. Try "Open example.com".');
    }
    return;
  }

  // Unrecognized command
  console.log('[VoiceNav] Unrecognized command:', transcript);
}

// Continuous scroll logic
let scrollInterval = null;

function startContinuousScroll(direction) {
  stopContinuousScroll();
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
 * Open a new tab.
 */
function openNewTab(urlPart) {
  let urlToOpen = urlPart;
  if (!/^https?:\/\//i.test(urlToOpen)) {
    urlToOpen = 'https://' + urlPart;
  }
  window.open(urlToOpen, '_blank');
}

/**
 * Summarize the page using GPT
 */
async function summarizePage() {
  try {
    const pageContent = document.body.innerText;
    const summary = await getSummaryFromGPT(pageContent);
    createSummaryOverlay(summary);
    speakText(summary);
  } catch (error) {
    console.error('Summarization error:', error);
    alert('Could not summarize the page. Please try again.');
  }
}

/**
 * Create an overlay showing the summary.
 */
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
      background-color: rgba(30, 30, 30, 0.95);
      color: #fff;
      padding: 20px;
      border-radius: 10px;
      z-index: 999999;
      font-family: "Segoe UI", Tahoma, sans-serif;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.5);
    `;
    document.body.appendChild(overlay);
  }

  overlay.innerHTML = `
    <h3 style="margin-top: 0; font-size: 16px; color: #66b3ff;">Page Summary</h3>
    <p style="font-size: 14px; line-height: 1.4;">${summary}</p>
    <button onclick="this.parentElement.remove()" style="
      padding: 6px 12px;
      margin-top: 10px;
      background: #555;
      color: white;
      border: none;
      border-radius: 5px;
      cursor: pointer;
      font-size: 13px;
    ">Close</button>
  `;
}

/**
 * Get a GPT-based summary for the page
 */
async function getSummaryFromGPT(content) {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage({
      type: 'SUMMARIZE_TEXT',
      content: content.substring(0, 5000) // limit for token safety
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
}

/**
 * Speak out loud (TTS) the given text
 */
function speakText(text) {
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = 'en-US';
  utterance.rate = 1.0;
  utterance.pitch = 1.0;
  utterance.volume = 1.0;

  utterance.onerror = (event) => {
    console.error('[VoiceNav] Speech synthesis error:', event.error);
    alert('Could not read the text aloud. Please try again.');
  };

  if (!window.speechSynthesis) {
    console.error('[VoiceNav] Speech synthesis not supported');
    alert('Your browser does not support text-to-speech.');
    return;
  }

  const voices = speechSynthesis.getVoices();
  if (voices.length === 0) {
    speechSynthesis.addEventListener('voiceschanged', () => {
      const englishVoice = speechSynthesis.getVoices().find(voice => voice.lang.includes('en-'));
      if (englishVoice) {
        utterance.voice = englishVoice;
      }
      window.speechSynthesis.speak(utterance);
    });
  } else {
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
