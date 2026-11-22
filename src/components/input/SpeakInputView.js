/**
 * KavyaVault (काव्यकलश) — SpeakInputView Component
 * Dedicated workspace for Browser Speech-to-Poem (Speak → Poem)
 * 
 * Provides:
 * - Browser speech recognition capability check & status display
 * - Hindi-first controls: "बोलना शुरू करें", "रोकें", "प्रतिलिपि", "कविता के रूप में उपयोग करें"
 * - Language selection: Hindi (hi-IN) [default] & English (en-IN)
 * - Live recognition status & interim text display
 * - Directly editable final transcript
 * - Clean handoff into PoemInputService.createSpeakDraft(...) & PoetryEditor
 * - Zero external AI / 100% browser-native & private
 */

import {
  SpeechRecognitionAdapter,
  SPEECH_RECOGNITION_STATES,
  LANGUAGE_OPTIONS,
  isSpeechRecognitionSupported
} from '../../services/speech/SpeechRecognitionAdapter.js';
import { createSpeakDraft } from '../../services/input/PoemInputService.js';
import { poemRepository } from '../../services/PoemRepository.js';
import { ROUTES } from '../../data/navigation.js';
import { getIconSvg } from '../navigation/icons.js';
import { calculateTextMetrics } from '../../utils/counters.js';

export class SpeakInputView {
  /**
   * @param {Object} options
   * @param {HTMLElement} options.container - DOM element to render into
   * @param {Object} options.router - Router instance with navigate()
   * @param {Object} [options.poemRepo] - Optional PoemRepository override
   * @param {Object} [options.speechAdapter] - Optional SpeechRecognitionAdapter override
   */
  constructor(options = {}) {
    this.container = options.container;
    this.router = options.router;
    this.poemRepo = options.poemRepo || poemRepository;
    this.customSpeechAdapter = options.speechAdapter || null;

    this.selectedLanguage = 'hi-IN';
    this.transcriptText = '';
    this.interimText = '';
    this.errorMessage = null;
    this.speechState = SPEECH_RECOGNITION_STATES.IDLE;
    this.adapter = null;

    this._onStateChange = this._onStateChange.bind(this);
    this._onResult = this._onResult.bind(this);
    this._onError = this._onError.bind(this);
  }

  mount() {
    if (!this.container) return;

    // Initialize adapter
    if (this.customSpeechAdapter) {
      this.adapter = this.customSpeechAdapter;
    } else {
      this.adapter = new SpeechRecognitionAdapter({
        language: this.selectedLanguage,
        onStateChange: this._onStateChange,
        onResult: this._onResult,
        onError: this._onError
      });
    }

    // Bind listeners if using custom adapter
    if (this.customSpeechAdapter) {
      this.adapter.onStateChange = this._onStateChange;
      this.adapter.onResult = this._onResult;
      this.adapter.onError = this._onError;
    }

    this.speechState = this.adapter.state;
    this.render();
    this.bindEvents();
  }

  unmount() {
    if (this.adapter) {
      this.adapter.destroy();
      this.adapter = null;
    }
    if (this.container) {
      this.container.innerHTML = '';
    }
  }

  _onStateChange(newState) {
    this.speechState = newState;
    if (newState === SPEECH_RECOGNITION_STATES.LISTENING) {
      this.errorMessage = null;
    }
    this._updateStateUI();
  }

  _onResult({ interim, final, fullTranscript }) {
    this.interimText = interim;
    this.transcriptText = fullTranscript;
    this._updateTranscriptUI();
  }

  _onError(err) {
    this.errorMessage = err.message || 'वाक् पहचान में अज्ञात त्रुटि आई।';
    this._updateStateUI();
  }

  _handleMicToggle() {
    if (!this.adapter) return;

    if (this.adapter.isListening()) {
      this.adapter.stop();
    } else {
      this.errorMessage = null;
      // Sync adapter with any manual edits the user made before starting recording again
      if (this.transcriptText) {
        this.adapter.setInitialTranscript(this.transcriptText);
      }
      this.adapter.start();
    }
  }

  _handleClear() {
    if (this.adapter && this.adapter.isListening()) {
      this.adapter.stop();
    }
    this.transcriptText = '';
    this.interimText = '';
    this.errorMessage = null;
    if (this.adapter) {
      this.adapter.resetTranscript();
    }
    this._updateTranscriptUI();
    this._updateStateUI();
  }

  _handleUseAsPoem() {
    // Read directly from textarea to capture any manual edits
    const textarea = this.container.querySelector('#speak-transcript-editor');
    const textareaValue = textarea ? textarea.value : '';
    const textToUse = (textareaValue && textareaValue.trim()) ? textareaValue : this.transcriptText;
    const trimmed = (textToUse || '').trim();

    if (!trimmed) {
      this.errorMessage = 'कविता के रूप में उपयोग करने हेतु सार्थक वाणी पाठ आवश्यक है। कृपया पहले कुछ बोलें या लिखें।';
      this._updateStateUI();
      if (textarea) textarea.focus();
      return;
    }

    if (this.adapter && this.adapter.isListening()) {
      this.adapter.stop();
    }

    try {
      // Create non-persistent draft using existing PoemInputService contract
      createSpeakDraft(
        {
          text: trimmed,
          metadata: {
            language: this.selectedLanguage,
            source: 'speak',
            capturedAt: new Date().toISOString()
          }
        },
        this.poemRepo
      );

      // Navigate to editor
      if (this.router && typeof this.router.navigate === 'function') {
        this.router.navigate(ROUTES.NEW_POEM);
      }
    } catch (err) {
      this.errorMessage = 'कविता प्रारूप बनाने में समस्या आई: ' + err.message;
      this._updateStateUI();
    }
  }

  _updateStateUI() {
    const micBtn = this.container.querySelector('#btn-mic-toggle');
    const micLabel = this.container.querySelector('#mic-toggle-label');
    const statusText = this.container.querySelector('#speak-status-text');
    const statusDot = this.container.querySelector('.speak-status-indicator');
    const errorBanner = this.container.querySelector('#speak-error-banner');

    const isListening = this.speechState === SPEECH_RECOGNITION_STATES.LISTENING;
    const isStarting = this.speechState === SPEECH_RECOGNITION_STATES.STARTING;
    const isStopping = this.speechState === SPEECH_RECOGNITION_STATES.STOPPING;
    const isUnsupported = this.speechState === SPEECH_RECOGNITION_STATES.UNSUPPORTED;

    if (micBtn) {
      micBtn.disabled = isUnsupported || isStarting || isStopping;
      micBtn.setAttribute('aria-pressed', isListening ? 'true' : 'false');
      if (isListening) {
        micBtn.classList.add('is-listening');
      } else {
        micBtn.classList.remove('is-listening');
      }
    }

    if (micLabel) {
      if (isListening) {
        micLabel.textContent = 'रोकें (Stop)';
      } else if (isStarting) {
        micLabel.textContent = 'प्रारंभ हो रहा है...';
      } else if (isStopping) {
        micLabel.textContent = 'रुक रहा है...';
      } else {
        micLabel.textContent = 'बोलना शुरू करें (Speak)';
      }
    }

    if (statusText) {
      if (isListening) {
        statusText.textContent = 'सुन रहा है... बोलिए';
      } else if (isStarting) {
        statusText.textContent = 'माइक्रोफ़ोन प्रारंभ हो रहा है...';
      } else if (isStopping) {
        statusText.textContent = 'वाक् पहचान समाप्त की जा रही है...';
      } else if (isUnsupported) {
        statusText.textContent = 'वाक् पहचान असमर्थित (Unsupported)';
      } else {
        statusText.textContent = 'तैयार (माइक्रोफ़ोन दबाएं)';
      }
    }

    if (statusDot) {
      statusDot.className = `speak-status-indicator status-${this.speechState}`;
    }

    if (errorBanner) {
      const errTextEl = errorBanner.querySelector('.error-text');
      if (this.errorMessage) {
        errorBanner.style.display = 'flex';
        if (errTextEl) errTextEl.textContent = this.errorMessage;
      } else {
        errorBanner.style.display = 'none';
        if (errTextEl) errTextEl.textContent = '';
      }
    }
  }

  _updateTranscriptUI() {
    const textarea = this.container.querySelector('#speak-transcript-editor');
    const interimBox = this.container.querySelector('#speak-interim-preview');
    const metricsDisplay = this.container.querySelector('#speak-metrics-display');

    if (textarea) {
      // Only set if different to avoid cursor jumps during active manual editing
      if (textarea.value !== this.transcriptText) {
        textarea.value = this.transcriptText;
      }
    }

    if (interimBox) {
      if (this.interimText) {
        interimBox.style.display = 'block';
        interimBox.textContent = `... ${this.interimText}`;
      } else {
        interimBox.style.display = 'none';
        interimBox.textContent = '';
      }
    }

    if (metricsDisplay) {
      const metrics = calculateTextMetrics(this.transcriptText);
      metricsDisplay.textContent = `${metrics.lineCount} पंक्तियाँ · ${metrics.wordCount} शब्द · ${metrics.charCount} वर्ण`;
    }
  }

  render() {
    const isSupported = this.adapter ? this.adapter.isSupported() : false;

    this.container.innerHTML = `
      <div class="speak-workspace-view" data-view="speak-to-poem">
        <!-- Header & Breadcrumbs -->
        <header class="speak-view-header">
          <div class="speak-header-left">
            <a href="${ROUTES.INPUT_MODES}" data-link class="speak-back-link" id="link-back-to-input" aria-label="काव्य सृजन माध्यम पर वापस जाएं">
              ← अन्य तरीका चुनें
            </a>
            <h1 class="speak-view-title">
              बोलकर लिखें <span class="hindi-badge">ध्वनि माध्यम</span>
            </h1>
            <p class="speak-view-subtitle">
              ब्राउज़र की मूल वाक् पहचान से अपनी कविता बोलें, संपादित करें और सुरक्षित सहेजें।
            </p>
          </div>
          <div class="speak-header-right">
            <!-- Language Selector -->
            <label for="speak-language-select" class="speak-lang-label">भाषा (Language):</label>
            <select id="speak-language-select" class="speak-lang-select" aria-label="पहचान भाषा चुनें">
              ${LANGUAGE_OPTIONS.map(opt => `
                <option value="${opt.code}" ${opt.code === this.selectedLanguage ? 'selected' : ''}>
                  ${opt.label}
                </option>
              `).join('')}
            </select>
          </div>
        </header>

        <!-- Privacy & Local Reassurance Banner -->
        <div class="speak-privacy-banner" role="note">
          <span class="privacy-icon">🛡️</span>
          <span class="privacy-text">
            <strong>वाणी की गोपनीयता:</strong> काव्यकलश किसी बाहरी AI या क्लाउड API को सीधे कॉल नहीं करता। ब्राउज़र की वाक्-पहचान सेवा आपकी आवाज़ ऑनलाइन सर्वर को भेज सकती है। ऑफ़लाइन पहचान की गारंटी नहीं है। माइक शुरू करने से पहले इसे ध्यान में रखें।
          </span>
        </div>

        <!-- Unsupported Browser Alert -->
        ${!isSupported ? `
          <div class="speak-unsupported-banner" role="alert">
            <div class="unsupported-title">⚠️ आपके ब्राउज़र में वाक् पहचान उपलब्ध नहीं है</div>
            <p class="unsupported-desc">
              यह ब्राउज़र Web Speech API (SpeechRecognition) का समर्थन नहीं करता। आप सीधे टाइप करके कविता लिख सकते हैं।
            </p>
            <a href="#${ROUTES.NEW_POEM}" class="btn btn-secondary">
              सीधे संपादक में लिखें →
            </a>
          </div>
        ` : ''}

        <!-- Dynamic Error Banner -->
        <div id="speak-error-banner" class="speak-error-banner" role="alert" style="display: ${this.errorMessage ? 'flex' : 'none'};">
          <span class="error-icon">⚠️</span>
          <span class="error-text">${this.errorMessage || ''}</span>
          <button type="button" class="btn-dismiss-error" id="btn-dismiss-error" aria-label="त्रुटि संदेश बंद करें">✕</button>
        </div>

        <!-- Central Mic Control Bar -->
        <div class="speak-mic-bar">
          <button 
            type="button" 
            id="btn-mic-toggle" 
            class="btn-mic-toggle ${this.speechState === SPEECH_RECOGNITION_STATES.LISTENING ? 'is-listening' : ''}" 
            aria-pressed="${this.speechState === SPEECH_RECOGNITION_STATES.LISTENING ? 'true' : 'false'}"
            aria-label="माइक्रोफ़ोन प्रारंभ या बंद करें"
            ${!isSupported ? 'disabled' : ''}
          >
            <span class="mic-icon-wrapper">
              <svg class="mic-svg" viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"></path>
                <path d="M19 10v2a7 7 0 0 1-14 0v-2"></path>
                <line x1="12" y1="19" x2="12" y2="23"></line>
                <line x1="8" y1="23" x2="16" y2="23"></line>
              </svg>
            </span>
            <span id="mic-toggle-label" class="mic-btn-label">
              ${this.speechState === SPEECH_RECOGNITION_STATES.LISTENING ? 'रोकें (Stop)' : 'बोलना शुरू करें (Speak)'}
            </span>
          </button>

          <div class="speak-status-group" aria-live="polite">
            <span class="speak-status-indicator status-${this.speechState}"></span>
            <span id="speak-status-text" class="speak-status-label">
              ${!isSupported ? 'वाक् पहचान असमर्थित' : 'तैयार (माइक्रोफ़ोन दबाएं)'}
            </span>
          </div>
        </div>

        <!-- Transcript Workspace -->
        <div class="speak-transcript-card">
          <div class="transcript-header">
            <div class="transcript-title-group">
              <h2 class="transcript-heading">प्रतिलिपि (Transcript)</h2>
              <span class="transcript-hint">बोलते समय पाठ स्वतः यहाँ आएगा। आप इसे स्वयं भी संपादित कर सकते हैं।</span>
            </div>
            <div id="speak-metrics-display" class="transcript-metrics">
              0 पंक्तियाँ · 0 शब्द · 0 वर्ण
            </div>
          </div>

          <!-- Real-time Interim Overlay / Box -->
          <div id="speak-interim-preview" class="speak-interim-box" style="display: none;" aria-live="polite"></div>

          <!-- Editable Final Transcript -->
          <textarea 
            id="speak-transcript-editor" 
            class="speak-transcript-textarea" 
            placeholder="यहाँ आपकी बोली गई पंक्तियाँ आएँगी... (आप सीधे टाइप करके भी सुधार सकते हैं)"
            aria-label="बोली गई कविता की प्रतिलिपि"
            rows="10"
          >${this.transcriptText}</textarea>

          <!-- Action Buttons Bar -->
          <div class="transcript-actions-bar">
            <button 
              type="button" 
              class="btn btn-outline" 
              id="btn-clear-transcript"
              data-action="clear-transcript"
            >
              मिटाएं (साफ़ करें)
            </button>

            <button 
              type="button" 
              class="btn btn-primary btn-use-poem" 
              id="btn-use-as-poem"
              data-action="use-as-poem"
            >
              कविता के रूप में उपयोग करें →
            </button>
          </div>
        </div>
      </div>
    `;

    this._updateTranscriptUI();
    this._updateStateUI();
  }

  bindEvents() {
    const backLink = this.container.querySelector('#link-back-to-input');
    if (backLink) {
      backLink.addEventListener('click', (e) => {
        if (this.adapter && this.adapter.isListening()) {
          this.adapter.stop();
        }
        if (this.router && typeof this.router.navigate === 'function') {
          e.preventDefault();
          this.router.navigate(ROUTES.INPUT_MODES);
        }
      });
    }

    const micBtn = this.container.querySelector('#btn-mic-toggle');
    if (micBtn) {
      micBtn.addEventListener('click', () => this._handleMicToggle());
    }

    const langSelect = this.container.querySelector('#speak-language-select');
    if (langSelect) {
      langSelect.addEventListener('change', (e) => {
        this.selectedLanguage = e.target.value;
        if (this.adapter) {
          this.adapter.setLanguage(this.selectedLanguage);
        }
      });
    }

    const clearBtn = this.container.querySelector('#btn-clear-transcript');
    if (clearBtn) {
      clearBtn.addEventListener('click', () => this._handleClear());
    }

    const useBtn = this.container.querySelector('#btn-use-as-poem');
    if (useBtn) {
      useBtn.addEventListener('click', () => this._handleUseAsPoem());
    }

    const dismissBtn = this.container.querySelector('#btn-dismiss-error');
    if (dismissBtn) {
      dismissBtn.addEventListener('click', () => {
        this.errorMessage = null;
        this._updateStateUI();
      });
    }

    const textarea = this.container.querySelector('#speak-transcript-editor');
    if (textarea) {
      textarea.addEventListener('input', (e) => {
        this.transcriptText = e.target.value;
        if (this.adapter) {
          this.adapter.setInitialTranscript(this.transcriptText);
        }
        const metricsDisplay = this.container.querySelector('#speak-metrics-display');
        if (metricsDisplay) {
          const metrics = calculateTextMetrics(this.transcriptText);
          metricsDisplay.textContent = `${metrics.lineCount} पंक्तियाँ · ${metrics.wordCount} शब्द · ${metrics.charCount} वर्ण`;
        }
      });
    }
  }
}
