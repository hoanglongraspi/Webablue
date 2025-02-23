document.addEventListener('DOMContentLoaded', () => {
  const voiceBtn = document.getElementById('voiceToggleBtn');
  const altTextBtn = document.getElementById('altTextToggleBtn');
  const readAltTextBtn = document.getElementById('readAltTextToggleBtn');
  const simplifyRange = document.getElementById('simplifyRange');

  // Toggle Voice Navigation
  voiceBtn.addEventListener('click', async () => {
    try {
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tabs || tabs.length === 0) throw new Error('No active tab found');

      // Ensure voiceNav.js is injected
      await chrome.scripting.executeScript({
        target: { tabId: tabs[0].id },
        files: ['voiceNav.js']
      });
      
      // Tell the content script to toggle voice nav
      await chrome.tabs.sendMessage(tabs[0].id, { action: 'toggleVoiceNav' });
    } catch (error) {
      console.error('Error:', error);
      alert('Could not activate voice navigation. Please refresh the page and try again.');
    }
  });

  // Toggle AI Alt Text Generation
  altTextBtn.addEventListener('click', async () => {
    try {
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tabs || tabs.length === 0) throw new Error('No active tab found');

      await chrome.tabs.sendMessage(tabs[0].id, { action: 'toggleAiAltText' });
    } catch (error) {
      console.error('Error:', error);
      alert('Could not toggle AI alt text. Please refresh the page and try again.');
    }
  });

  // Toggle Reading Alt Text On Click
  readAltTextBtn.addEventListener('click', async () => {
    try {
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tabs || tabs.length === 0) throw new Error('No active tab found');

      await chrome.tabs.sendMessage(tabs[0].id, { action: 'toggleReadAltText' });
    } catch (error) {
      console.error('Error:', error);
      alert('Could not toggle alt text reading. Please refresh the page and try again.');
    }
  });

  // Listen for changes in the reading-level slider
  simplifyRange.addEventListener('input', async (e) => {
    const level = parseInt(e.target.value, 10);
    try {
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tabs || tabs.length === 0) throw new Error('No active tab found');

      // Send the new level to contentScriptSimplify
      await chrome.tabs.sendMessage(tabs[0].id, {
        action: 'setReadingLevel',
        level: level
      });
    } catch (error) {
      console.error('Error setting reading level:', error);
    }
  });
});
