// popup.js
document.addEventListener('DOMContentLoaded', () => {
  const btn = document.getElementById('voiceToggleBtn');
  
  btn.addEventListener('click', async () => {
    try {
      // Get the active tab
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      
      if (!tabs || tabs.length === 0) {
        throw new Error('No active tab found');
      }
      
      // Inject the content scripts if they haven't been injected
      await chrome.scripting.executeScript({
        target: { tabId: tabs[0].id },
        files: ['voiceNav.js']
      });
      
      // Send the message
      await chrome.tabs.sendMessage(tabs[0].id, { action: 'toggleVoiceNav' });
      
    } catch (error) {
      console.error('Error:', error);
      alert('Could not activate voice navigation. Please refresh the page and try again.');
    }
  });
});
