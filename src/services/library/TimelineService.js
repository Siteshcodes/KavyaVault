/**
 * काव्यकलश (KavyaVault) — Timeline Metadata Service (TimelineService.js)
 * Phase 6 / Task 6.1: Library Organization Foundation
 *
 * Derives chronological provenance and lifecycle events across the poetry library.
 * Normalizes available dates without inventing missing dates or overwriting provenance.
 * Supports:
 * - createdAt (पुस्तकालय प्रविष्टि)
 * - updatedAt (अंतिम संशोधन)
 * - authoredDate / writtenDate (रचना काल, if recorded)
 * - digitizedDate / capturedDate (पांडुलिपि डिजिटलीकरण, if linked to manuscript)
 */

import {
  TIMELINE_EVENT_TYPE,
  createTimelineEntry
} from './libraryTypes.js';

export class TimelineService {
  /**
   * @param {Object} [options={}]
   * @param {Object} [options.manuscriptRepo] Optional manuscript repository for resolving digitized dates
   */
  constructor(options = {}) {
    this.manuscriptRepo = options.manuscriptRepo || null;
  }

  /**
   * Alias for extractPoemEvents
   */
  getPoemEvents(poem) {
    return this.extractPoemEvents(poem);
  }

  /**
   * Extracts chronological timeline events for a single poem
   *
   * @param {Object} poem
   * @returns {Array<Object>} List of validated TimelineEntry objects
   */
  extractPoemEvents(poem) {
    if (!poem || typeof poem !== 'object' || !poem.id) {
      return [];
    }

    const events = [];
    const poemId = String(poem.id);
    const poemTitle = poem.title || 'शीर्षकहीन रचना';

    // 1. Authored / Written date (if explicitly provided in poem metadata)
    const rawAuthored = poem.authoredDate || poem.writtenDate || poem.creationDate;
    if (rawAuthored && !isNaN(Date.parse(rawAuthored))) {
      events.push(createTimelineEntry({
        poemId,
        poemTitle,
        eventType: TIMELINE_EVENT_TYPE.AUTHORED,
        date: rawAuthored,
        label: 'रचना काल'
      }));
    }

    // 2. Created at (library entry)
    if (poem.createdAt && !isNaN(Date.parse(poem.createdAt))) {
      events.push(createTimelineEntry({
        poemId,
        poemTitle,
        eventType: TIMELINE_EVENT_TYPE.CREATED,
        date: poem.createdAt,
        label: 'पुस्तकालय प्रविष्टि'
      }));
    }

    // 3. Digitized date (if linked to a manuscript via poem.manuscriptId or manuscript.poemId)
    if (this.manuscriptRepo) {
      try {
        let manuscript = null;
        if (poem.manuscriptId && typeof this.manuscriptRepo.getById === 'function') {
          manuscript = this.manuscriptRepo.getById(poem.manuscriptId);
        }
        if (!manuscript && typeof this.manuscriptRepo.findByPoemId === 'function') {
          manuscript = this.manuscriptRepo.findByPoemId(poemId);
        }
        if (!manuscript && typeof this.manuscriptRepo.getAll === 'function') {
          const allManuscripts = this.manuscriptRepo.getAll();
          manuscript = allManuscripts.find(m => m.poemId === poemId);
        }
        if (manuscript) {
          const rawDigitized = manuscript.capturedDate || manuscript.createdAt || (manuscript.originalManuscript && manuscript.originalManuscript.capturedAt);
          if (rawDigitized && !isNaN(Date.parse(rawDigitized))) {
            events.push(createTimelineEntry({
              poemId,
              poemTitle,
              eventType: TIMELINE_EVENT_TYPE.DIGITIZED,
              date: rawDigitized,
              label: 'पांडुलिपि डिजिटलीकरण',
              metadata: { title: manuscript.title }
            }));
          }
        }
      } catch {
        // Safe fallback
      }
    }

    // 4. Updated at (if distinct from created)
    if (poem.updatedAt && !isNaN(Date.parse(poem.updatedAt)) && poem.createdAt) {
      const createdTime = new Date(poem.createdAt).getTime();
      const updatedTime = new Date(poem.updatedAt).getTime();

      if (Math.abs(updatedTime - createdTime) > 1000) {
        events.push(createTimelineEntry({
          poemId,
          poemTitle,
          eventType: TIMELINE_EVENT_TYPE.UPDATED,
          date: poem.updatedAt,
          label: 'अंतिम संशोधन'
        }));
      }
    }

    return events;
  }

  /**
   * Generates a unified, chronologically sorted timeline across multiple poems
   *
   * @param {Array<Object>|Object} poemsOrOptions
   * @param {Object} [options={}]
   * @param {'desc'|'asc'} [options.order='desc'] Sort direction
   * @param {string} [options.eventType] Optional event type filter
   * @param {Object} [options.dateRange] Optional { from, to } date bounds
   * @returns {Array<Object>}
   */
  getTimeline(poemsOrOptions = [], options = {}) {
    let poems = [];
    let opts = options;
    if (Array.isArray(poemsOrOptions)) {
      poems = poemsOrOptions;
    } else if (poemsOrOptions && typeof poemsOrOptions === 'object') {
      poems = Array.isArray(poemsOrOptions.poems) ? poemsOrOptions.poems : [];
      opts = poemsOrOptions;
    }

    const { order = 'desc', eventType = null, dateRange = null } = opts;
    if (!Array.isArray(poems)) return [];

    let allEvents = [];
    for (const poem of poems) {
      if (!poem || poem.isArchived) continue;
      const poemEvents = this.extractPoemEvents(poem);
      allEvents.push(...poemEvents);
    }

    // Filter by eventType if requested
    if (eventType) {
      allEvents = allEvents.filter(e => e.eventType === eventType);
    }

    // Filter by date bounds if requested
    if (dateRange && typeof dateRange === 'object') {
      if (dateRange.from && !isNaN(Date.parse(dateRange.from))) {
        const fromTime = new Date(dateRange.from).getTime();
        allEvents = allEvents.filter(e => e.timestamp >= fromTime);
      }
      if (dateRange.to && !isNaN(Date.parse(dateRange.to))) {
        const toTime = new Date(dateRange.to).getTime();
        allEvents = allEvents.filter(e => e.timestamp <= toTime);
      }
    }

    // Deterministic sorting: timestamp DESC -> poemId ASC -> eventType ASC
    allEvents.sort((a, b) => {
      let comparison = b.timestamp - a.timestamp;
      if (comparison === 0) {
        comparison = a.poemId.localeCompare(b.poemId);
      }
      if (comparison === 0) {
        comparison = a.eventType.localeCompare(b.eventType);
      }
      return order === 'asc' ? -comparison : comparison;
    });

    return allEvents;
  }

  /**
   * Groups timeline events by Year or Year-Month for literary chronology views
   *
   * @param {Array<Object>} poems
   * @param {'year'|'month'} [granularity='year']
   * @returns {Array<{ period: string, events: Array<Object> }>}
   */
  getGroupedTimeline(poems = [], granularity = 'year') {
    const events = this.getTimeline(poems, { order: 'desc' });
    const groups = new Map();

    for (const event of events) {
      const d = new Date(event.date);
      const key = granularity === 'month'
        ? `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
        : `${d.getFullYear()}`;

      if (!groups.has(key)) {
        groups.set(key, []);
      }
      groups.get(key).push(event);
    }

    const result = [];
    for (const [period, groupEvents] of groups.entries()) {
      result.push({
        period,
        events: groupEvents
      });
    }

    return result;
  }
}

export const timelineService = new TimelineService();
