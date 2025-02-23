// contentScriptReplaceHighlight.js

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'REPLACE_HIGHLIGHT') {
      replaceHighlightedText(message.original, message.simplified);
    }
    else if (message.action === 'SHOW_ERROR') {
      alert(`Error rewriting text: ${message.error}`);
    }
  });
  
  /**
   * Replace the currently selected text (which should match message.original)
   * with message.simplified.
   */
  function replaceHighlightedText(original, simplified) {
    const selection = window.getSelection();
    if (!selection.rangeCount) return;
  
    // Let's assume the user still has that text highlighted
    const range = selection.getRangeAt(0);
  
    // OPTIONAL: Check if the selection text actually matches 'original'
    const selectedText = selection.toString().trim();
    if (!selectedText || selectedText !== original.trim()) {
      // They changed selection or the text doesn't match for some reason
      console.warn('Selected text does not match original text. Not replacing.');
      // We could show an alert or just do nothing
      return;
    }
  
    // Replace it by removing the old range content and inserting new text
    range.deleteContents();
    range.insertNode(document.createTextNode(simplified));
  
    // Clear the selection so user sees updated text
    selection.removeAllRanges();
  }
  