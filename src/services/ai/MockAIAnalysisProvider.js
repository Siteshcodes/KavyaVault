/**
 * काव्यकलश (KavyaVault) — Mock AI Analysis Provider (MockAIAnalysisProvider.js)
 * Phase 4 / Task 4.1: AI Analysis Foundation
 *
 * Deterministic local mock provider for testing and offline development.
 *
 * Guarantees:
 * - Local-only processing without external network transmission
 * - ZERO API keys required
 * - Completely deterministic results based on poem text and title keywords
 * - Clearly identifies itself as mock provider
 * - Never mutates author content
 */

import { IAIAnalysisProvider } from './IAIAnalysisProvider.js';
import { StorageError, StorageErrorCode } from '../storage/StorageError.js';

export class MockAIAnalysisProvider extends IAIAnalysisProvider {
  /**
   * @param {Object} [options={}]
   * @param {boolean} [options.simulateFailure=false] If true, throws to test error handling
   * @param {Object|null} [options.customResult=null] Custom result to test edge cases
   * @param {number} [options.simulatedLatencyMs=10] Simulated execution latency in ms
   */
  constructor(options = {}) {
    super();
    this.simulateFailure = Boolean(options.simulateFailure);
    this.customResult = options.customResult || null;
    this.simulatedLatencyMs = typeof options.simulatedLatencyMs === 'number' ? options.simulatedLatencyMs : 5;
  }

  getId() {
    return 'mock';
  }

  getName() {
    return 'KavyaVault Local Mock AI Analyzer';
  }

  getModel() {
    return 'kavyavault-mock-analyzer-v1';
  }

  /**
   * Deterministically analyzes poem text without any network calls.
   *
   * @param {Object} input
   * @param {string} input.poemId
   * @param {string} input.title
   * @param {string} input.body
   * @param {string} [input.author]
   * @param {Array<string>} [input.tags]
   */
  async analyzePoem(input) {
    // Basic input validation
    if (!input || typeof input !== 'object') {
      throw new StorageError(
        'प्रदाता को वैध इनपुट ऑब्जेक्ट प्राप्त नहीं हुआ।',
        StorageErrorCode.VALIDATION_ERROR
      );
    }

    if (!input.body || typeof input.body !== 'string') {
      throw new StorageError(
        'विश्लेषण हेतु कविता का मुख्य पाठ आवश्यक है।',
        StorageErrorCode.VALIDATION_ERROR
      );
    }

    // Optional failure simulation
    if (this.simulateFailure) {
      throw new StorageError(
        'कृत्रिम बुद्धिमत्ता विश्लेषण प्रदाता अनुपलब्ध है (Simulated Provider Error)।',
        StorageErrorCode.UNKNOWN_ERROR
      );
    }

    // Optional custom result return (for edge cases / malformed test cases)
    if (this.customResult) {
      return {
        result: this.customResult,
        rawResponseMetadata: {
          provider: this.getId(),
          model: this.getModel(),
          mock: true,
          custom: true
        }
      };
    }

    const text = `${input.title || ''}\n${input.body || ''}`.toLowerCase();

    // Deterministic rule-based categorization based on Hindi / literary keywords
    let category = 'विविध मुक्तक';
    let mood = 'शांत';
    let themes = ['साहित्यिक चिंतन'];
    let keywords = ['कविता', 'भाव', 'रचना'];
    let summary = 'कवि के गहन अंतर्मन एवं साहित्यिक अभिव्यक्ति की भावपूर्ण प्रस्तुति।';

    if (text.includes('पर्वत') || text.includes('नदी') || text.includes('प्रकृति') || text.includes('हवा') || text.includes('सावन') || text.includes('वृक्ष')) {
      category = 'प्रकृति एवं सौन्दर्य';
      mood = 'शांत';
      themes = ['प्रकृति', 'एकांत सौन्दर्य', 'प्राकृतिक सुषमा'];
      keywords = ['प्रकृति', 'सौन्दर्य', 'धरती', 'पवन', 'मौन'];
      summary = 'प्रकृति के शांत वातावरण, वन-उपवन एवं प्राकृतिक दृश्यों का सजीव व शांत चित्रण।';
    } else if (text.includes('युद्ध') || text.includes('शौर्य') || text.includes('वीर') || text.includes('क्रांति') || text.includes('विजय') || text.includes('तलवार') || text.includes('देश')) {
      category = 'राष्ट्रभक्ति एवं चेतना';
      mood = 'वीर';
      themes = ['शौर्य', 'देशप्रेम', 'साहस', 'जागृति'];
      keywords = ['वीरता', 'राष्ट्र', 'संघर्ष', 'संकल्प', 'विजय'];
      summary = 'राष्ट्रभक्ति, साहस एवं त्याग की भावना से ओत-प्रोत प्रेरणादायी ओजस्वी काव्य।';
    } else if (text.includes('प्रेम') || text.includes('नयन') || text.includes('प्रिय') || text.includes('मिलन') || text.includes('स्मृति') || text.includes('विरह')) {
      category = 'प्रेम एवं विरह';
      mood = 'श्रृंगार';
      themes = ['प्रेम', 'समर्पण', 'हृदय की चाह'];
      keywords = ['प्रीति', 'अनुराग', 'नयन', 'मिलन', 'विरह'];
      summary = 'हृदय के कोमल भावों, प्रेम की मधुर अनुभूतियों एवं विरह की व्यथा का सुंदर अंकन।';
    } else if (text.includes('दुःख') || text.includes('आँसू') || text.includes('पीड़ा') || text.includes('दर्द') || text.includes('वेदना') || text.includes('शोक')) {
      category = 'जीवन संघर्ष';
      mood = 'करुण';
      themes = ['संवेदना', 'वेदना', 'जीवन सत्य'];
      keywords = ['करुणा', 'वेदना', 'अश्रु', 'विषाद', 'मर्म'];
      summary = 'जीवन की कठिनाइयों, मानवीय वेदना एवं करुणा का संवेदनशील व मर्मस्पर्शी प्रकटीकरण।';
    } else if (text.includes('ईश्वर') || text.includes('प्रभु') || text.includes('भक्ति') || text.includes('आत्मा') || text.includes('मोक्ष') || text.includes('साधना')) {
      category = 'आध्यात्म एवं दर्शन';
      mood = 'भक्ति';
      themes = ['आध्यात्म', 'समर्पण', 'ईश्वरीय चिंतन'];
      keywords = ['भक्ति', 'साधना', 'परमात्मा', 'मोक्ष', 'शांति'];
      summary = 'ईश्वरीय सत्ता के प्रति अगाध श्रद्धा, आध्यात्मिक जिज्ञासा एवं अंतरात्मा की पुकार।';
    }

    // Extract any existing poem tags into keywords if available
    if (Array.isArray(input.tags)) {
      for (const t of input.tags) {
        if (typeof t === 'string' && t.trim() && !keywords.includes(t.trim())) {
          keywords.push(t.trim());
        }
      }
    }

    // Deterministic latency simulation (microtask)
    if (this.simulatedLatencyMs > 0) {
      await new Promise(resolve => setTimeout(resolve, this.simulatedLatencyMs));
    }

    return {
      result: {
        category,
        mood,
        themes,
        keywords: keywords.slice(0, 10),
        summary
      },
      rawResponseMetadata: {
        provider: this.getId(),
        model: this.getModel(),
        mock: true,
        tokensSimulated: Math.ceil(text.length / 4),
        generatedAt: new Date().toISOString()
      }
    };
  }
}
