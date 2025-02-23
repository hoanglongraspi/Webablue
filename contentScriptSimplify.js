// contentScriptSimplify.js

let readingLevel = 3; // 3 = original, 1/2 = simpler, 4/5 = advanced
let originalTexts = new Map(); // to store original text content for each text node

// Listen for reading level updates
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'setReadingLevel') {
    readingLevel = message.level;
    applyReadingLevel();
  }
});

// Step 1: gather text nodes upon load
document.addEventListener('DOMContentLoaded', () => {
  // We’ll store original text in originalTexts map
  walkDOMAndStore(document.body);
});

/**
 * Walk through the DOM, find text nodes, store them in originalTexts
 */
function walkDOMAndStore(root) {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null);
  while (walker.nextNode()) {
    const node = walker.currentNode;
    // Exclude pure whitespace or extremely short strings
    if (node.nodeValue.trim().length > 2) {
      // store original text in map
      originalTexts.set(node, node.nodeValue);
    }
  }
}

/**
 * Apply the current reading level:
 *  - If level=3 => revert to original
 *  - Else => request rewriting from the background script
 */
async function applyReadingLevel() {
  if (readingLevel === 3) {
    // Revert to original text
    for (const [node, original] of originalTexts.entries()) {
      node.nodeValue = original;
    }
    return;
  }

  // Build an array of text we need to rewrite
  // We must break them into manageable chunks to avoid token overflows.
  // For example, each chunk could be ~500 characters.
  const bigString = [];
  const textNodes = [];
  for (const [node, original] of originalTexts.entries()) {
    textNodes.push(node);
    bigString.push(original);
  }

  // We join them with a delimiter. Another approach is chunking them individually.
  // For demonstration, let's do them one by one (which is safer token-wise).
  await rewriteAllIndividually(textNodes, readingLevel);
}

/**
 * Rewrite each text node individually to avoid huge prompts.
 */
async function rewriteAllIndividually(textNodes, lvl) {
  for (const node of textNodes) {
    const original = originalTexts.get(node);
    if (!original) continue;
    // If the user quickly switches back to original, stop rewriting
    if (readingLevel === 3) return;

    try {
      const newText = await simplifyText(original, lvl);
      // Only replace if readingLevel still the same
      if (readingLevel === lvl) {
        node.nodeValue = newText;
      }
    } catch (err) {
      console.warn('Rewrite failed:', err);
    }
  }
}

/**
 * Call background script to simplify text with GPT. We pick a target grade 
 * based on the slider. We'll create a mapping, e.g. 
 * 1 => 5th grade
 * 2 => 8th grade
 * 4 => 12th grade
 * 5 => "college"
 */
function simplifyText(original, lvl) {
  // Map each slider level to a "reading level"
  const levelToGrade = {
    1: '5th grade reading level',
    2: '8th grade reading level',
    3: 'original', // we won't call simplify for 3
    4: '12th grade reading level',
    5: 'undergraduate college reading level'
  };
  const target = levelToGrade[lvl] || '8th grade reading level';

  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage({
      type: 'SIMPLIFY_TEXT',
      text: original,
      targetGrade: target
    }, (response) => {
      if (chrome.runtime.lastError) {
        return reject(new Error(chrome.runtime.lastError.message));
      }
      if (!response) {
        return reject(new Error('No response from background for simplify.'));
      }
      if (response.error) {
        return reject(new Error(response.error));
      }
      if (!response.simplified) {
        return reject(new Error('No simplified text returned.'));
      }
      resolve(response.simplified);
    });
  });
}
