// Test utility functions and mock factories
// Provides reusable test data for consistent testing across test files

/**
 * Creates a mock timeline with customizable count
 * @param {number} count - Number of timeline entries to create
 * @returns {Array} Array of mock timeline entries
 */
export const createMockTimeline = (count = 3) => {
  return Array.from({ length: count }, (_, i) => ({
    start: i * 1.0,
    timeSec: i * 1.0,
    midi: 60 + i,
    pitch: `C${4 + Math.floor(i / 12)}`,
    vfKey: `c/${4 + Math.floor(i / 12)}`,
    key: `c/${4 + Math.floor(i / 12)}`,
    durationBeats: 1.0,
    dur: 1.0,
    measure: Math.floor(i / 4) + 1,
    beat: (i % 4) + 1,
    beatFraction: 0
  }));
};

/**
 * Creates mock lesson metadata
 * @param {Object} overrides - Properties to override defaults
 * @returns {Object} Mock lesson metadata
 */
export const createMockLessonMeta = (overrides = {}) => ({
  tempo: 80,
  beatsPerMeasure: 4,
  ...overrides
});

/**
 * Creates mock settings object
 * @param {Object} overrides - Properties to override defaults
 * @returns {Object} Mock settings
 */
export const createMockSettings = (overrides = {}) => ({
  beatTolerance: 0.1,
  validateNoteLength: false,
  enabledDurations: {
    whole: true,
    half: true,
    quarter: true,
    eighth: true,
    sixteenth: false
  },
  minNote: 'C4',
  maxNote: 'C5',
  includeSharps: true,
  ...overrides
});

/**
 * Creates a mock lesson for timeline loading
 * @param {Object} overrides - Properties to override defaults
 * @returns {Object} Mock lesson data
 */
export const createMockLesson = (overrides = {}) => ({
  id: 'test-lesson',
  name: 'Test Lesson',
  data: {
    title: 'Test Lesson',
    tempo: 80,
    timeSignature: { numerator: 4, denominator: 4 },
    notes: createMockTimeline(3)
  },
  xml: '<score-partwise></score-partwise>',
  ...overrides
});
