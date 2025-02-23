document.addEventListener('DOMContentLoaded', () => {
  const voiceBtn = document.getElementById('voiceToggleBtn');
  const altTextBtn = document.getElementById('altTextToggleBtn');
  const readAltTextBtn = document.getElementById('readAltTextToggleBtn');

  const dyslexiaBtn = document.getElementById('dyslexiaToggleBtn');
  const fontSizeSlider = document.getElementById('dyslexiaFontSizeRange');
  const fontSizeSliderContainer = document.getElementById('fontSizeSliderContainer');

  const highContrastBtn = document.getElementById('highContrastToggleBtn');
  const focusLensBtn = document.getElementById('focusLensToggleBtn');
  const accessibleLayoutBtn = document.getElementById('accessibleLayoutBtn');

  // Toggle Voice Navigation
  voiceBtn.addEventListener('click', async () => {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab) throw new Error('No active tab');
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ['voiceNav.js']
      });
      await chrome.tabs.sendMessage(tab.id, { action: 'toggleVoiceNav' });
    } catch (error) {
      console.error('Error:', error);
      alert('Could not activate voice navigation. Please refresh the page.');
    }
  });

  // Toggle AI Alt Text
  altTextBtn.addEventListener('click', async () => {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab) throw new Error('No active tab');
      await chrome.tabs.sendMessage(tab.id, { action: 'toggleAiAltText' });
    } catch (error) {
      console.error('Error:', error);
      alert('Could not toggle AI alt text. Please refresh the page.');
    }
  });

  // Toggle Reading Alt Text
  readAltTextBtn.addEventListener('click', async () => {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab) throw new Error('No active tab');
      await chrome.tabs.sendMessage(tab.id, { action: 'toggleReadAltText' });
    } catch (error) {
      console.error('Error:', error);
      alert('Could not toggle alt text reading. Please refresh the page.');
    }
  });

  // Dyslexia toggle
  dyslexiaBtn.addEventListener('click', async () => {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab) throw new Error('No active tab');
      await chrome.tabs.sendMessage(tab.id, { action: 'toggleDyslexiaMode' });

      // Toggle the slider container
      if (fontSizeSliderContainer.style.display === 'none' || !fontSizeSliderContainer.style.display) {
        fontSizeSliderContainer.style.display = 'flex';
      } else {
        fontSizeSliderContainer.style.display = 'none';
      }
    } catch (error) {
      console.error('Error:', error);
      alert('Could not toggle dyslexia mode. Please refresh the page.');
    }
  });

  // On slider change, update the text size
  fontSizeSlider.addEventListener('input', async (e) => {
    const fontSizeValue = parseInt(e.target.value, 10);
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab) throw new Error('No active tab');

      await chrome.tabs.sendMessage(tab.id, {
        action: 'setDyslexiaFontSize',
        size: fontSizeValue
      });
    } catch (error) {
      console.error('Error setting font size:', error);
    }
  });

  // High Contrast
  highContrastBtn.addEventListener('click', async () => {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab) throw new Error('No active tab');
      await chrome.tabs.sendMessage(tab.id, { action: 'toggleHighContrast' });
    } catch (error) {
      console.error('Error:', error);
      alert('Could not toggle high contrast mode. Please refresh the page.');
    }
  });

  // Focus Lens
  focusLensBtn.addEventListener('click', async () => {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab) throw new Error('No active tab');
      await chrome.tabs.sendMessage(tab.id, { action: 'toggleFocusLens' });
    } catch (error) {
      console.error('Error:', error);
      alert('Could not toggle focus lens mode. Please refresh the page.');
    }
  });

  // Accessible Layout
  accessibleLayoutBtn.addEventListener('click', async () => {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab) throw new Error('No active tab');
      await chrome.tabs.sendMessage(tab.id, { action: 'toggleAccessibleLayout' });
    } catch (error) {
      console.error('Error:', error);
      alert('Could not toggle accessible layout. Please refresh the page.');
    }
  });
});
