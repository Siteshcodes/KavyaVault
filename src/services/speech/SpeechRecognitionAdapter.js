/**
 * काव्यकलश (KavyaVault) — Speech Recognition Adapter (SpeechRecognitionAdapter.js)
 * Phase 3 / Task 3.3: Isolated capability and lifecycle adapter for browser-native speech recognition.
 *
 * Privacy Guarantees:
 * - Uses ONLY browser-native Web Speech API (SpeechRecognition / webkitSpeechRecognition).
 * - Zero third-party cloud speech APIs (no OpenAI, Azure, AWS, Google Cloud endpoints).
 * - No app telemetry. Browser-managed speech may send audio to a recognition service.
 * - Safe detection of browser support with graceful fallback.
 */

export const SPEECH_RECOGNITION_STATES = Object.freeze({
  IDLE: 'idle',
  STARTING: 'starting',
  LISTENING: 'listening',
  STOPPING: 'stopping',
  COMPLETED: 'completed',
  ERROR: 'error',
  UNSUPPORTED: 'unsupported'
});

export const SUPPORTED_LANGUAGES = Object.freeze({
  HINDI: 'hi-IN',
  ENGLISH: 'en-IN',
  ENGLISH_IN: 'en-IN'
});

export const LANGUAGE_OPTIONS = Object.freeze([
  { code: SUPPORTED_LANGUAGES.HINDI, label: 'हिंदी (भारत) — hi-IN' },
  { code: SUPPORTED_LANGUAGES.ENGLISH_IN, label: 'English (India) — en-IN' }
]);

/**
 * Detects whether the browser supports native SpeechRecognition.
 * Supports standard `SpeechRecognition` and vendor-prefixed `webkitSpeechRecognition`.
 * @param {Object} [globalScope=null] Optional global scope for dependency injection/testing
 * @returns {boolean}
 */
export function isSpeechRecognitionSupported(globalScope = null) {
  const scope = globalScope || (typeof window !== 'undefined' ? window : null);
  if (!scope) return false;
  return Boolean(scope.SpeechRecognition || scope.webkitSpeechRecognition);
}

/**
 * Resolves the native SpeechRecognition constructor from the global scope.
 * @param {Object} [globalScope=null]
 * @returns {Function|null}
 */
export function getSpeechRecognitionConstructor(globalScope = null) {
  const scope = globalScope || (typeof window !== 'undefined' ? window : null);
  if (!scope) return null;
  return scope.SpeechRecognition || scope.webkitSpeechRecognition || null;
}

/**
 * Translates Web Speech API error codes into friendly Hindi user guidance.
 * @param {string|Object} error
 * @returns {string}
 */
export function formatSpeechErrorMessage(error) {
  const code = typeof error === 'object' && error !== null ? (error.error || error.code || '') : String(error || '');

  switch (code) {
    case 'not-allowed':
    case 'permission-denied':
      return 'माइक्रोफ़ोन की अनुमति अस्वीकृत है। कृपया ब्राउज़र सेटिंग्स में माइक्रोफ़ोन की अनुमति प्रदान करें और पुनः प्रयास करें।';
    case 'no-speech':
      return 'कोई आवाज़ नहीं सुनी गई। कृपया पुनः माइक चालू कर स्पष्ट स्वर में बोलें।';
    case 'audio-capture':
      return 'माइक्रोफ़ोन हार्डवेयर उपलब्ध नहीं है या किसी अन्य ऐप्लिकेशन द्वारा उपयोग में है।';
    case 'network':
      return 'ब्राउज़र वाक्-सेवा से संपर्क नहीं हो सका। कृपया अपना नेटवर्क कनेक्शन जांचें।';
    case 'service-not-allowed':
      return 'ब्राउज़र ने वाक्-पहचान सेवा को अवरुद्ध कर दिया है।';
    case 'language-not-supported':
      return 'चयनित भाषा इस ब्राउज़र द्वारा समर्थित नहीं है।';
    case 'aborted':
      return 'वाणी इनपुट रोक दिया गया।';
    default:
      return error ? `ध्वनि पहचान में समस्या उत्पन्न हुई (${error})।` : 'ध्वनि पहचान में तकनीकी समस्या उत्पन्न हुई।';
  }
}

export class SpeechRecognitionAdapter {
  /**
   * @param {Object} options
   * @param {string} [options.language=SUPPORTED_LANGUAGES.HINDI]
   * @param {boolean} [options.continuous=true]
   * @param {boolean} [options.interimResults=true]
   * @param {Function} [options.onStateChange] Callback: (state) => void
   * @param {Function} [options.onResult] Callback: ({ finalTranscript, interimTranscript, isFinal, rawResult }) => void
   * @param {Function} [options.onError] Callback: ({ error, message, rawError }) => void
   * @param {Function} [options.onEnd] Callback: () => void
   * @param {Function} [options.customRecognitionClass=null] Optional constructor injection for testing
   * @param {Object} [options.globalScope=null] Optional window scope injection
   */
  constructor({
    language = SUPPORTED_LANGUAGES.HINDI,
    continuous = true,
    interimResults = true,
    onStateChange = null,
    onResult = null,
    onError = null,
    onEnd = null,
    customRecognitionClass = null,
    globalScope = null
  } = {}) {
    this.language = language;
    this.continuous = continuous;
    this.interimResults = interimResults;
    this.onStateChange = onStateChange;
    this.onResult = onResult;
    this.onError = onError;
    this.onEnd = onEnd;
    this.customRecognitionClass = customRecognitionClass;
    this.globalScope = globalScope;

    this.state = SPEECH_RECOGNITION_STATES.IDLE;
    this.recognition = null;
    this.accumulatedFinalText = '';
    this.lastInterimText = '';

    // Check support upon construction
    if (!this.isSupported()) {
      this.setState(SPEECH_RECOGNITION_STATES.UNSUPPORTED);
    }
  }

  /**
   * Checks if native speech recognition is supported in this environment
   * @returns {boolean}
   */
  isSupported() {
    if (this.customRecognitionClass) return true;
    return isSpeechRecognitionSupported(this.globalScope);
  }

  /**
   * Internal state transition helper
   * @param {string} newState
   */
  setState(newState) {
    if (this.state === newState) return;
    this.state = newState;
    if (typeof this.onStateChange === 'function') {
      try {
        this.onStateChange(this.state);
      } catch (err) {
        console.error('[SpeechRecognitionAdapter] onStateChange error:', err);
      }
    }
  }

  /**
   * Returns current lifecycle state
   * @returns {string}
   */
  getState() {
    return this.state;
  }

  /**
   * Returns whether adapter is actively listening
   * @returns {boolean}
   */
  isListening() {
    return this.state === SPEECH_RECOGNITION_STATES.LISTENING;
  }

  /**
   * Updates language for upcoming recognition sessions
   * Bounded to supported languages (hi-IN, en-IN)
   * @param {string} lang
   */
  setLanguage(lang) {
    if (typeof lang === 'string' && (lang === SUPPORTED_LANGUAGES.HINDI || lang === SUPPORTED_LANGUAGES.ENGLISH_IN)) {
      this.language = lang;
      if (this.recognition) {
        this.recognition.lang = this.language;
      }
    }
  }

  /**
   * Gets current language
   * @returns {string}
   */
  getLanguage() {
    return this.language;
  }

  /**
   * Instantiates or re-configures the native SpeechRecognition instance
   */
  _ensureRecognitionInstance() {
    if (this.recognition) return this.recognition;

    const Ctor = this.customRecognitionClass || getSpeechRecognitionConstructor(this.globalScope);
    if (!Ctor) {
      this.setState(SPEECH_RECOGNITION_STATES.UNSUPPORTED);
      throw new Error('Speech recognition is not supported in this browser.');
    }

    const instance = new Ctor();
    instance.lang = this.language;
    instance.continuous = this.continuous;
    instance.interimResults = this.interimResults;
    instance.maxAlternatives = 1;

    // Attach lifecycle event listeners
    instance.onstart = () => {
      this.setState(SPEECH_RECOGNITION_STATES.LISTENING);
    };

    instance.onresult = (event) => {
      this._handleRecognitionResult(event);
    };

    instance.onerror = (event) => {
      this._handleRecognitionError(event);
    };

    instance.onend = () => {
      this._handleRecognitionEnd();
    };

    this.recognition = instance;
    return instance;
  }

  /**
   * Starts speech recognition session
   * @returns {boolean} Whether start succeeded
   */
  start() {
    if (!this.isSupported()) {
      this.setState(SPEECH_RECOGNITION_STATES.UNSUPPORTED);
      if (typeof this.onError === 'function') {
        this.onError({
          error: 'unsupported',
          message: 'आपके ब्राउज़र में ध्वनि पहचान समर्थित नहीं है।',
          rawError: null
        });
      }
      return false;
    }

    if (this.state === SPEECH_RECOGNITION_STATES.LISTENING || this.state === SPEECH_RECOGNITION_STATES.STARTING) {
      return true; // Already active
    }

    try {
      this.setState(SPEECH_RECOGNITION_STATES.STARTING);
      const instance = this._ensureRecognitionInstance();
      instance.lang = this.language;
      instance.start();
      return true;
    } catch (err) {
      console.error('[SpeechRecognitionAdapter] start error:', err);
      this.setState(SPEECH_RECOGNITION_STATES.ERROR);
      if (typeof this.onError === 'function') {
        this.onError({
          error: err.name || 'start-failed',
          message: err.message || 'माइक्रोफ़ोन प्रारंभ करने में त्रुटि हुई।',
          rawError: err
        });
      }
      return false;
    }
  }

  /**
   * Gracefully stops listening and awaits final recognition results
   */
  stop() {
    if (!this.recognition) return;
    if (this.state !== SPEECH_RECOGNITION_STATES.LISTENING && this.state !== SPEECH_RECOGNITION_STATES.STARTING) {
      return;
    }

    try {
      this.setState(SPEECH_RECOGNITION_STATES.STOPPING);
      this.recognition.stop();
    } catch (err) {
      console.warn('[SpeechRecognitionAdapter] stop warning:', err);
      this.setState(SPEECH_RECOGNITION_STATES.IDLE);
    }
  }

  /**
   * Immediately aborts speech recognition session without waiting
   */
  abort() {
    if (!this.recognition) return;
    try {
      this.recognition.abort();
    } catch (_) {}
    this.setState(SPEECH_RECOGNITION_STATES.IDLE);
  }

  /**
   * Sets initial transcript (e.g. syncing with user's manual edits)
   * @param {string} text
   */
  setInitialTranscript(text) {
    this.accumulatedFinalText = typeof text === 'string' ? text : '';
    this.lastInterimText = '';
  }

  /**
   * Clears accumulated transcript
   */
  resetTranscript() {
    this.accumulatedFinalText = '';
    this.lastInterimText = '';
  }

  /**
   * Handles SpeechRecognitionEvent results
   * @param {Object} event
   */
  _handleRecognitionResult(event) {
    if (!event || !event.results) return;

    let interimTranscript = '';
    let newFinalChunks = [];

    const startIndex = typeof event.resultIndex === 'number' ? event.resultIndex : 0;

    for (let i = startIndex; i < event.results.length; i++) {
      const result = event.results[i];
      if (!result || !result[0]) continue;

      const transcript = result[0].transcript || '';
      if (result.isFinal) {
        newFinalChunks.push(transcript.trim());
      } else {
        interimTranscript += transcript;
      }
    }

    let isFinalChunkAdded = false;
    if (newFinalChunks.length > 0) {
      const joinedChunk = newFinalChunks.join(' ');
      // Avoid appending if identical to the trailing phrase (deduplicate identical repeated result events)
      const existingLines = this.accumulatedFinalText ? this.accumulatedFinalText.split('\n') : [];
      const lastLine = existingLines.length > 0 ? existingLines[existingLines.length - 1].trim() : '';

      if (joinedChunk !== lastLine) {
        isFinalChunkAdded = true;
        if (this.accumulatedFinalText) {
          this.accumulatedFinalText += '\n' + joinedChunk;
        } else {
          this.accumulatedFinalText = joinedChunk;
        }
      }
      this.lastInterimText = '';
    } else {
      this.lastInterimText = interimTranscript;
    }

    if (typeof this.onResult === 'function') {
      try {
        this.onResult({
          finalTranscript: this.accumulatedFinalText,
          interimTranscript: this.lastInterimText,
          // Aliases for convenience and component consumption
          interim: this.lastInterimText,
          final: this.accumulatedFinalText,
          fullTranscript: this.accumulatedFinalText,
          isFinal: isFinalChunkAdded,
          rawResult: event
        });
      } catch (err) {
        console.error('[SpeechRecognitionAdapter] onResult error:', err);
      }
    }
  }

  /**
   * Handles SpeechRecognitionErrorEvent
   * @param {Object} event
   */
  _handleRecognitionError(event) {
    const errorCode = event && event.error ? event.error : 'unknown';
    const message = formatSpeechErrorMessage(errorCode);

    // Some browsers fire 'no-speech' when the user pauses talking.
    // We treat 'no-speech' as completed idle if text has already been accumulated.
    if (errorCode === 'no-speech') {
      this.setState(SPEECH_RECOGNITION_STATES.IDLE);
    } else if (errorCode === 'aborted') {
      this.setState(SPEECH_RECOGNITION_STATES.IDLE);
    } else {
      this.setState(SPEECH_RECOGNITION_STATES.ERROR);
    }

    if (typeof this.onError === 'function') {
      try {
        this.onError({
          error: errorCode,
          message,
          rawError: event
        });
      } catch (err) {
        console.error('[SpeechRecognitionAdapter] onError callback failure:', err);
      }
    }
  }

  /**
   * Handles recognition onend lifecycle event
   */
  _handleRecognitionEnd() {
    if (this.state === SPEECH_RECOGNITION_STATES.LISTENING || this.state === SPEECH_RECOGNITION_STATES.STOPPING) {
      this.setState(SPEECH_RECOGNITION_STATES.COMPLETED);
    } else if (this.state !== SPEECH_RECOGNITION_STATES.ERROR && this.state !== SPEECH_RECOGNITION_STATES.UNSUPPORTED) {
      this.setState(SPEECH_RECOGNITION_STATES.IDLE);
    }

    if (typeof this.onEnd === 'function') {
      try {
        this.onEnd();
      } catch (err) {
        console.error('[SpeechRecognitionAdapter] onEnd error:', err);
      }
    }
  }

  /**
   * Cleans up all resources and event listeners
   */
  destroy() {
    this.abort();
    if (this.recognition) {
      this.recognition.onstart = null;
      this.recognition.onresult = null;
      this.recognition.onerror = null;
      this.recognition.onend = null;
      this.recognition = null;
    }
    this.onStateChange = null;
    this.onResult = null;
    this.onError = null;
    this.onEnd = null;
  }
}
