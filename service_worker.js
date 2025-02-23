// service_worker.js

// Replace this with your actual OpenAI API key
const OPENAI_API_KEY = "test"; // <-- REPLACE ME

// Insert your Hugging Face Inference API token and model:
const HUGGING_FACE_TOKEN = "test"; // <-- REPLACE ME
const HUGGING_FACE_MODEL = "test";

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'TRANSCRIBE_AUDIO') {
    const { audioData, fileType } = message;
    transcribeAudioBase64(audioData, fileType)
      .then(transcript => sendResponse({ transcript }))
      .catch(err => sendResponse({ error: err.message || String(err) }));
    return true; 
  }
  else if (message.type === 'TRANSCRIBE_AUDIO_URL') {
    const { url } = message;
    transcribeByUrl(url)
      .then(transcript => sendResponse({ transcript }))
      .catch(err => sendResponse({ error: err.message || String(err) }));
    return true; 
  }
  else if (message.type === 'SUMMARIZE_TEXT') {
    summarizeWithGPT(message.content)
      .then(summary => sendResponse({ summary }))
      .catch(err => sendResponse({ error: err.message || String(err) }));
    return true; 
  }
  else if (message.type === 'GENERATE_ALT_TEXT') {
    // The new function for Hugging Face-based alt text generation
    generateAltTextFromImage(message.imageData)
      .then(altText => sendResponse({ altText }))
      .catch(err => sendResponse({ error: err.message || String(err) }));
    return true; 
  }
  else if (message.type === 'SIMPLIFY_TEXT') {
    simplifyTextWithGPT(message.text, message.targetGrade)
      .then(simplified => sendResponse({ simplified }))
      .catch(err => sendResponse({ error: err.message }));
    return true;
  }
  else if (message.type === 'AI_PAGE_REFORMAT') {
    // We do a placeholder approach
    aiReformatPage(message.htmlContent)
      .then(cleanHTML => sendResponse({ cleanHTML }))
      .catch(err => sendResponse({ error: err.message }));
    return true;
  }


});

chrome.runtime.onInstalled.addListener(() => {
  // Create a parent context menu
  chrome.contextMenus.create({
    id: "simplifyRoot",
    title: "Simplify Text",
    contexts: ["selection"]  // only show if user has highlighted something
  });

  // Add sub-menu items for different reading levels
  const levels = [
    { id: "grade5", title: "5th Grade Level" },
    { id: "grade8", title: "8th Grade Level" },
    { id: "grade12", title: "12th Grade Level" },
    { id: "college", title: "College Level" }
  ];

  levels.forEach(lvl => {
    chrome.contextMenus.create({
      id: lvl.id,
      title: lvl.title,
      parentId: "simplifyRoot",
      contexts: ["selection"]
    });
  });
});

// Listen for a click on any of those menu items
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (!info.selectionText) return;  // user must have highlighted text
  // figure out which item was clicked
  let targetGrade;
  switch(info.menuItemId) {
    case "grade5":    targetGrade = "5th grade reading level"; break;
    case "grade8":    targetGrade = "8th grade reading level"; break;
    case "grade12":   targetGrade = "12th grade reading level"; break;
    case "college":   targetGrade = "undergraduate college reading level"; break;
    default: return; // not ours
  }

  try {
    // Simplify the selected text
    const newText = await simplifyTextWithGPT(info.selectionText, targetGrade);

    // Now we send a message to our content script to replace the highlight
    chrome.tabs.sendMessage(tab.id, {
      action: 'REPLACE_HIGHLIGHT',
      original: info.selectionText,
      simplified: newText
    });
  } catch (err) {
    console.error('Error rewriting text:', err);
    // Optionally show an alert
    chrome.tabs.sendMessage(tab.id, {
      action: 'SHOW_ERROR',
      error: err.message
    });
  }
});

async function simplifyTextWithGPT(content, targetGrade) {
  if (!OPENAI_API_KEY) {
    throw new Error('OpenAI API key not set');
  }

  const systemPrompt = `You are an assistant that rewrites text at a desired reading level. Return only the rewritten text.`;
  const userPrompt = `Rewrite the following text at a ${targetGrade}. Keep the original meaning: \n\n${content}`;

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${OPENAI_API_KEY}`
    },
    body: JSON.stringify({
      model: 'gpt-3.5-turbo',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      max_tokens: 512,
      temperature: 0.7
    })
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(`GPT error: ${response.status} - ${JSON.stringify(err)}`);
  }

  const result = await response.json();
  const answer = result.choices?.[0]?.message?.content?.trim();
  if (!answer) {
    throw new Error('No text returned by GPT');
  }
  return answer;
}


/**
 * Summarize with GPT, if you still use OpenAI for text summarization
 */
async function summarizeWithGPT(content) {
  if (!OPENAI_API_KEY) throw new Error('OpenAI API key not set');
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${OPENAI_API_KEY}`
    },
    body: JSON.stringify({
      model: 'gpt-3.5-turbo',
      messages: [
        {
          role: 'system',
          content: 'You are a helpful assistant that summarizes web page content concisely.'
        },
        {
          role: 'user',
          content: `Please summarize this text in 3-4 sentences: ${content}`
        }
      ],
      max_tokens: 150,
      temperature: 0.7
    })
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(`GPT API error: ${error.error?.message || 'Unknown error'}`);
  }

  const result = await response.json();
  return result.choices[0].message.content.trim();
}

/**
 * Convert base64-encoded JPEG data to a Blob so we can send it to Hugging Face
 */
function base64ToBlob(base64) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new Blob([bytes], { type: 'image/jpeg' });
}

/**
 * Actual function that calls the Hugging Face Inference API 
 * using the "nlpconnect/vit-gpt2-image-captioning" model (or any other).
 */
async function generateAltTextFromImage(base64Data) {
  if (!HUGGING_FACE_TOKEN) {
    throw new Error('Hugging Face API token not set');
  }
  if (!HUGGING_FACE_MODEL) {
    throw new Error('Hugging Face model name not set');
  }

  // Turn the base64 data into a blob
  const imageBlob = base64ToBlob(base64Data);

  // POST the blob to Hugging Face Inference API
  const response = await fetch(`https://api-inference.huggingface.co/models/${HUGGING_FACE_MODEL}`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${HUGGING_FACE_TOKEN}`
    },
    body: imageBlob
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Hugging Face API error: ${response.status} => ${errText}`);
  }

  // The model typically returns an array of objects with "generated_text" fields
  // e.g. [ { "generated_text": "a large airplane sitting on top of an airport tarmac" } ]
  const result = await response.json();
  if (!Array.isArray(result) || !result[0]?.generated_text) {
    throw new Error('Invalid response from Hugging Face image captioning');
  }

  // Return the generated caption
  const caption = result[0].generated_text;
  return caption.trim();
}

/**
 * Whisper-based Audio Transcription (OpenAI)
 */
async function transcribeAudioBase64(base64Data, fileType) {
  if (!OPENAI_API_KEY) {
    throw new Error('OpenAI API key not set for transcription');
  }
  const byteCharacters = atob(base64Data);
  const byteNumbers = new Array(byteCharacters.length);
  for (let i = 0; i < byteCharacters.length; i++) {
    byteNumbers[i] = byteCharacters.charCodeAt(i);
  }
  const byteArray = new Uint8Array(byteNumbers);
  const blob = new Blob([byteArray], { type: fileType });

  const formData = new FormData();
  formData.append("file", blob, "audio.webm");
  formData.append("model", "whisper-1");

  const response = await fetch("https://api.openai.com/v1/audio/transcriptions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${OPENAI_API_KEY}`
    },
    body: formData
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(`OpenAI Whisper API error: ${response.status} - ${JSON.stringify(err)}`);
  }

  const result = await response.json();
  return result.text;
}

async function aiReformatPage(originalHTML) {
  if (!OPENAI_API_KEY) {
    throw new Error('OpenAI API key not set');
  }

  // 1) Remove <script> tags to avoid partial rewriting of scripts 
  //    and reduce token usage.
  let sanitizedHTML = originalHTML.replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, '');

  // 2) Possibly remove extraneous whitespace or known giant elements 
  //    to shrink size further.
  sanitizedHTML = sanitizedHTML.replace(/\s+/g, ' '); // minimal whitespace
  // remove <nav>, <aside>, <footer>, and repeated "ad", "sponsor" strings
  sanitizedHTML = sanitizedHTML
    .replace(/<nav[\s\S]*?<\/nav>/gi, '')
    .replace(/<aside[\s\S]*?<\/aside>/gi, '')
    .replace(/<footer[\s\S]*?<\/footer>/gi, '')
    .replace(/sponsor/gi, '')
    .replace(/advert/gi, '');
  // etc.

  // 3) Split the sanitized HTML into smaller chunks (by character).
  //    Each chunk should be small enough so that after adding the prompt, 
  //    we stay below ~8k or ~16k tokens. A rough guess: ~ 10,000–20,000 characters per chunk.
  const chunkSize = 15000; // tweak as needed
  const chunks = chunkString(sanitizedHTML, chunkSize);

  // 4) Rewrite each chunk individually
  const rewrittenChunks = [];
  for (let i = 0; i < chunks.length; i++) {
    const partial = chunks[i];
    console.log(`Rewriting chunk ${i + 1} of ${chunks.length}, length=${partial.length}`);

    const rewritten = await rewriteHTMLChunk(partial); // calls GPT
    rewrittenChunks.push(rewritten);
  }

  // 5) Combine the rewritten chunks
  let combinedHTML = rewrittenChunks.join('\n<!-- CHUNK SPLIT -->\n');

  // 6) (Optional) If the final result is still not too large, 
  //    you can do a second pass to unify or smooth out transitions:
  // combinedHTML = await rewriteHTMLChunk(combinedHTML);

  // 7) Ensure we at least wrap in <body> if missing
  if (!/<body[^>]*>/i.test(combinedHTML) && !/<html[^>]*>/i.test(combinedHTML)) {
    combinedHTML = `<body>\n${combinedHTML}\n</body>`;
  }

  return combinedHTML;
}

/**
 * Actually calls GPT to "reformat" or "simplify" each chunk.
 * We keep prompts short so we don't exceed token limit.
 */
async function rewriteHTMLChunk(htmlChunk) {
  const systemPrompt = `
  You are an AI that extracts only the main textual content from HTML for better accessibility.
  Rules:
  - Focus on <article>, <main>, or large text blocks. 
  - Remove any nav bars, sidebars, ads, or anything that is not crucial text.
  - Output valid HTML with just headings and paragraphs. 
  - If images are inside main content, keep them but scale so that they are all the same size and dont take up a full window.
  - Return only HTML, no triple backticks or commentary.
  `;
  
  const userPrompt = `
  We want all the content from this chunk for easier reading by accessibility tools. 
  Ignore nav, sidebar, ads. Keep paragraphs and headings. 
  Scale images so that they are all the same size and dont take up a full window. 
  HTML chunk:
  ${htmlChunk}
  `;
  
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${OPENAI_API_KEY}`
    },
    body: JSON.stringify({
      model: 'gpt-3.5-turbo', // or 'gpt-4-32k'
      messages: [
        { role: 'system', content: systemPrompt.trim() },
        { role: 'user', content: userPrompt.trim() }
      ],
      max_tokens: 2500,
      temperature: 0.4
    })
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(`GPT rewrite error: ${response.status} => ${JSON.stringify(err)}`);
  }

  const result = await response.json();
  // remove any triple backticks if GPT includes them 
  let content = result.choices?.[0]?.message?.content?.trim() || '';
  content = content.replace(/```+/g, ''); // remove code fences if they appear

  return content;
}


/**
 * Splits a string into chunks of max 'size' chars.
 */
function chunkString(str, size) {
  const chunks = [];
  let index = 0;
  while (index < str.length) {
    chunks.push(str.slice(index, index + size));
    index += size;
  }
  return chunks;
}


/**
 * Transcribe from a media URL
 */
async function transcribeByUrl(url) {
  if (!OPENAI_API_KEY) {
    throw new Error('OpenAI API key not set for transcription');
  }
  const mediaResp = await fetch(url);
  if (!mediaResp.ok) {
    throw new Error(`Could not fetch media from URL: ${url}`);
  }
  const blob = await mediaResp.blob();

  const formData = new FormData();
  formData.append("file", blob, "uploaded_file");
  formData.append("model", "whisper-1");

  const response = await fetch("https://api.openai.com/v1/audio/transcriptions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${OPENAI_API_KEY}`
    },
    body: formData
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(`OpenAI Whisper API error: ${response.status} - ${JSON.stringify(err)}`);
  }

  const result = await response.json();
  return result.text;
}
