// service_worker.js

const OPENAI_API_KEY = ""; // <-- REPLACE ME

// Add this to the message listener
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'TRANSCRIBE_AUDIO') {
    const { audioData, fileType } = message;
    transcribeAudioBase64(audioData, fileType)
      .then(transcript => {
        sendResponse({ transcript });
      })
      .catch(err => {
        console.error('TRANSCRIBE_AUDIO error:', err);
        sendResponse({ error: err.message || String(err) });
      });
    return true; // Keep channel open (async)
  }
  else if (message.type === 'TRANSCRIBE_AUDIO_URL') {
    const { url } = message;
    transcribeByUrl(url)
      .then(transcript => {
        sendResponse({ transcript });
      })
      .catch(err => {
        console.error('TRANSCRIBE_AUDIO_URL error:', err);
        sendResponse({ error: err.message || String(err) });
      });
    return true; // Keep channel open
  }
  if (message.type === 'SUMMARIZE_TEXT') {
    summarizeWithGPT(message.content)
      .then(summary => {
        sendResponse({ summary });
      })
      .catch(err => {
        console.error('SUMMARIZE_TEXT error:', err);
        sendResponse({ error: err.message || String(err) });
      });
    return true; // Keep channel open for async response
  }
});

// Add this new function
async function summarizeWithGPT(content) {
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
    const error = await response.json();
    throw new Error(`GPT API error: ${error.error?.message || 'Unknown error'}`);
  }

  const result = await response.json();
  return result.choices[0].message.content.trim();
}

// Helper: Transcribe from base64 audio using Whisper
async function transcribeAudioBase64(base64Data, fileType) {
  // Decode base64
  const byteCharacters = atob(base64Data);
  const byteNumbers = new Array(byteCharacters.length);
  for (let i = 0; i < byteCharacters.length; i++) {
    byteNumbers[i] = byteCharacters.charCodeAt(i);
  }
  const byteArray = new Uint8Array(byteNumbers);
  const blob = new Blob([byteArray], { type: fileType });

  // Create multipart/form-data
  const formData = new FormData();
  formData.append("file", blob, "audio.webm");
  formData.append("model", "whisper-1");
  // Optional: formData.append("language", "en");

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
  return result.text; // The transcription text
}

// Helper: Transcribe from a direct media URL
async function transcribeByUrl(url) {
  // Fetch media from the URL
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
