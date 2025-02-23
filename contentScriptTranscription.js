// contentScriptTranscription.js
(function() {
  // Inject minimal CSS for the transcript overlay and button
  const style = document.createElement('style');
  style.innerHTML = `
    .transcript-overlay {
      position: fixed;
      bottom: 10px;
      right: 10px;
      max-width: 400px;
      max-height: 200px;
      overflow-y: auto;
      background-color: rgba(0,0,0,0.8);
      color: #fff;
      padding: 10px;
      border-radius: 8px;
      font-family: sans-serif;
      z-index: 999999;
    }
    .generate-captions-btn {
      margin-left: 8px;
      cursor: pointer;
      padding: 4px 8px;
      background: #0066ee;
      color: #fff;
      border: none;
      border-radius: 3px;
    }
  `;
  document.head.appendChild(style);

  // Create or update the transcript overlay
  function createOverlay(transcript) {
    let overlay = document.querySelector('.transcript-overlay');
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.className = 'transcript-overlay';
      document.body.appendChild(overlay);
    }
    overlay.innerHTML = `
      <div><strong>Transcript:</strong></div>
      <div>${transcript}</div>
    `;
  }

  // Record the video’s audio for ~10 seconds using captureStream + MediaRecorder
  function recordVideoAudio(videoElement, duration = 10000) {
    return new Promise((resolve, reject) => {
      if (!videoElement.captureStream) {
        reject(new Error('captureStream() not supported or not allowed.'));
        return;
      }
      try {
        const stream = videoElement.captureStream();
        const audioTracks = stream.getAudioTracks();
        if (audioTracks.length === 0) {
          reject(new Error('No audio track found in video.'));
          return;
        }

        const recorder = new MediaRecorder(stream);
        const chunks = [];

        recorder.ondataavailable = (e) => {
          if (e.data.size > 0) {
            chunks.push(e.data);
          }
        };
        recorder.onstop = () => {
          const blob = new Blob(chunks, { type: 'audio/webm' });
          resolve(blob);
        };
        recorder.onerror = (err) => reject(err);

        recorder.start();
        setTimeout(() => {
          recorder.stop();
        }, duration);
      } catch (err) {
        reject(err);
      }
    });
  }

  function addButtonToVideo(video) {
    const button = document.createElement('button');
    button.textContent = 'Generate Captions';
    button.className = 'generate-captions-btn';

    // Insert the button right after the <video> element
    video.insertAdjacentElement('afterend', button);

    button.addEventListener('click', async () => {
      try {
        // Record from the video
        const blob = await recordVideoAudio(video);
        const reader = new FileReader();
        reader.onloadend = function() {
          const base64Audio = reader.result.split(',')[1];
          chrome.runtime.sendMessage({
            type: 'TRANSCRIBE_AUDIO',
            audioData: base64Audio,
            fileType: 'audio/webm'
          }, (response) => {
            if (response && response.transcript) {
              console.log('Transcript:', response.transcript);
              createOverlay(response.transcript);
            } else if (response && response.error) {
              console.error('Transcription error:', response.error);
              alert('Error: ' + response.error);
            }
          });
        };
        reader.readAsDataURL(blob);
      } catch (e) {
        console.warn('Could not record audio:', e.message);
        // Fallback prompt
        const fallbackUrl = prompt(
          'Audio capture failed.\nEnter a direct media URL or cancel to upload a file:'
        );
        if (fallbackUrl) {
          chrome.runtime.sendMessage({
            type: 'TRANSCRIBE_AUDIO_URL',
            url: fallbackUrl
          }, (response) => {
            if (response && response.transcript) {
              console.log('Transcript:', response.transcript);
              createOverlay(response.transcript);
            } else if (response && response.error) {
              console.error('Transcription error:', response.error);
              alert('Error: ' + response.error);
            }
          });
        } else {
          // File upload fallback
          const input = document.createElement('input');
          input.type = 'file';
          input.accept = 'audio/*,video/*';
          input.style.display = 'none';
          input.onchange = async (evt) => {
            if (evt.target.files && evt.target.files[0]) {
              const fileBlob = evt.target.files[0];
              const reader2 = new FileReader();
              reader2.onloadend = function() {
                const base64File = reader2.result.split(',')[1];
                chrome.runtime.sendMessage({
                  type: 'TRANSCRIBE_AUDIO',
                  audioData: base64File,
                  fileType: fileBlob.type || 'audio/webm'
                }, (resp) => {
                  if (resp && resp.transcript) {
                    console.log('Transcript:', resp.transcript);
                    createOverlay(resp.transcript);
                  } else if (resp && resp.error) {
                    console.error('Transcription error:', resp.error);
                    alert('Error: ' + resp.error);
                  }
                });
              };
              reader2.readAsDataURL(fileBlob);
            }
          };
          document.body.appendChild(input);
          input.click();
        }
      }
    });
  }

  // On DOM ready, find all videos & attach button
  document.addEventListener('DOMContentLoaded', () => {
    const videos = document.querySelectorAll('video');
    videos.forEach(video => {
      addButtonToVideo(video);
    });
  });
})();
