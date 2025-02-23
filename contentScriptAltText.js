// contentScriptAltText.js

// Global booleans to track whether AI alt text or reading is enabled
let aiAltTextEnabled = false;
let readAltTextEnabled = false;

// Listen for messages from popup.js
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'toggleAiAltText') {
    aiAltTextEnabled = !aiAltTextEnabled;
    alert(`AI Alt Text Generation is now ${aiAltTextEnabled ? 'ON' : 'OFF'}.`);
    if (aiAltTextEnabled) {
      // Run once to apply alt text (and set titles) to all images lacking alt
      generateAltTextForAllImages();
    } else {
      // Optionally remove any "title" attributes we added. 
      // If you prefer to keep them once generated, comment this out.
      removeAITitles();
    }
  }
  else if (message.action === 'toggleReadAltText') {
    readAltTextEnabled = !readAltTextEnabled;
    alert(`Alt Text Reading on click is now ${readAltTextEnabled ? 'ON' : 'OFF'}.`);
  }
});

// On first load, set up a click listener for images
document.addEventListener('click', handleImageClick, true);

/**
 * For every <img> on the page, if it has no alt text, generate it from Hugging Face.
 * Also, set the 'title' attribute to show alt text on hover (even if alt is preexisting).
 */
async function generateAltTextForAllImages() {
  const images = document.querySelectorAll('img');
  for (const img of images) {
    // If there's any alt text (existing or new), store it in 'title' so user can see it on hover
    if (img.alt && img.alt.trim()) {
      // This image already has alt text, so just set the title for hover
      setTitleForImage(img, img.alt, false);
    } else {
      // Missing alt text => we generate from Hugging Face
      try {
        const altText = await getHuggingFaceAltText(img);
        if (altText) {
          img.alt = altText; 
          setTitleForImage(img, altText, true);
        }
      } catch (err) {
        console.error('Alt text generation failed:', err);
      }
    }
  }
}

/**
 * Create a 'title' attribute for the image so users see alt text on hover.
 * If newlyGenerated === true, we can prefix it with "(AI)" or something if desired.
 */
function setTitleForImage(img, altText, newlyGenerated) {
  const prefix = newlyGenerated ? '(AI) ' : '';
  // Only set the title if it's not already set or we want to override
  // In this example, we overwrite to ensure it displays the correct alt each time
  img.title = prefix + altText;
}

/**
 * If user toggles AI Alt Text OFF, optionally remove the titles we added. 
 * This won't remove the 'alt' attribute, since once it's set, typically you want to keep it.
 */
function removeAITitles() {
  const images = document.querySelectorAll('img');
  for (const img of images) {
    if (img.title && img.title.startsWith('(AI) ')) {
      // remove the AI-generated title only
      img.title = '';
    }
  }
}

/**
 * On click, if readAltTextEnabled is true and the target is an IMG, read alt text aloud.
 */
function handleImageClick(event) {
  if (!readAltTextEnabled) return; // reading off
  const target = event.target;
  if (target && target.tagName === 'IMG') {
    const altText = target.alt?.trim();
    if (altText) {
      speakText(altText);
    } else {
      speakText('No alt text available for this image.');
    }
  }
}

/**
 * Convert an <img> element to base64 (JPEG) so we can send it to service_worker to call Hugging Face
 */
async function getHuggingFaceAltText(imgElem) {
  return new Promise((resolve, reject) => {
    try {
      const canvas = document.createElement('canvas');
      canvas.width = imgElem.naturalWidth;
      canvas.height = imgElem.naturalHeight;

      const ctx = canvas.getContext('2d');
      ctx.drawImage(imgElem, 0, 0);

      const dataURL = canvas.toDataURL('image/jpeg', 0.8);
      const base64 = dataURL.replace(/^data:image\/jpeg;base64,/, '');

      // Send message to service_worker.js
      chrome.runtime.sendMessage(
        { type: 'GENERATE_ALT_TEXT', imageData: base64 },
        (response) => {
          if (chrome.runtime.lastError) {
            return reject(new Error(chrome.runtime.lastError.message));
          }
          if (!response) {
            return reject(new Error('No response from alt text generation.'));
          }
          if (response.error) {
            return reject(new Error(response.error));
          }
          if (!response.altText) {
            return reject(new Error('No altText in response.'));
          }
          resolve(response.altText);
        }
      );
    } catch (err) {
      reject(err);
    }
  });
}

/**
 * Use the browser's built-in Speech Synthesis to read text aloud.
 */
function speakText(text) {
  // Cancel any ongoing speech
  window.speechSynthesis.cancel();

  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = 'en-US';
  utterance.rate = 1.0;
  utterance.pitch = 1.0;
  utterance.volume = 1.0;

  utterance.onerror = (event) => {
    console.error('[AltText] Speech synthesis error:', event.error);
  };

  // Some browsers require waiting for voices to load
  const voices = window.speechSynthesis.getVoices();
  if (voices.length === 0) {
    speechSynthesis.addEventListener('voiceschanged', () => {
      const newVoices = speechSynthesis.getVoices();
      const englishVoice = newVoices.find(voice => voice.lang.includes('en-'));
      if (englishVoice) utterance.voice = englishVoice;
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
