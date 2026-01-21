// src/hooks/__tests__/useTimeline.test.js
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useTimeline } from '../useTimeline';
import * as TimeLineParser from '../../parser/TimeLineParser';
import * as NoteGenerator from '../../core/NoteGenerator';
import * as musicUtils from '../../core/musicUtils';

// Mock the dependencies
vi.mock('../../parser/TimeLineParser', () => ({
  parseTimeline: vi.fn(),
  AVAILABLE_LESSONS: [
    {
      id: 'test-lesson-1',
      name: 'Test Lesson 1',
      data: {
        tempo: 100,
        timeSignature: { numerator: 4, denominator: 4 },
        notes: []
      }
    },
    {
      id: 'test-lesson-2',
      name: 'Test Lesson 2',
      data: {
        tempo: 120,
        timeSignature: { numerator: 3, denominator: 4 },
        notes: []
      }
    }
  ]
}));

vi.mock('../../core/NoteGenerator', () => ({
  generateRandomTimeline: vi.fn()
}));

describe('useTimeline', () => {
  const mockSettings = {
    enabledDurations: {
      whole: true,
      half: true,
      quarter: true,
      eighth: false,
      sixteenth: false
    },
    minNote: 'C4',
    maxNote: 'G4',
    includeSharps: false
  };

  beforeEach(() => {
    vi.clearAllMocks();

    // Default mock returns for parseTimeline
    TimeLineParser.parseTimeline.mockReturnValue({
        timeline: [
            { midi: 60, pitch: 'C4', vfKey: 'c/4', start: 0, durationBeats: 1 },
            { midi: 62, pitch: 'D4', vfKey: 'd/4', start: 1, durationBeats: 1 }
        ],
        metadata: {
            beatsPerMeasure: 4,
            beatType: 4
        }
    });

    // Default mock returns for generateRandomTimeline
    NoteGenerator.generateRandomTimeline.mockReturnValue([
      { midi: 60, pitch: 'C4', start: 0, durationBeats: 1 },
      { midi: 64, pitch: 'E4', start: 1, durationBeats: 1 }
    ]);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Initialization', () => {
    it('should initialize with default state', () => {
      const { result } = renderHook(() =>
        useTimeline('lesson', 'test-lesson-1', mockSettings)
      );

      expect(result.current.timelineRef.current).toEqual([]);
      expect(result.current.lessonMeta).toEqual({
        tempo: 80,
        beatsPerMeasure: 4
      });
      expect(result.current.timelineVersion).toBe(0);
      expect(result.current.loadTimeline).toBeInstanceOf(Function);
    });
  });

  describe('Lesson Mode Loading', () => {
    it('should load lesson with valid lesson ID', async () => {
      const { result } = renderHook(() =>
        useTimeline('lesson', 'test-lesson-1', mockSettings)
      );

      await act(async () => {
        await result.current.loadTimeline();
      });

      expect(TimeLineParser.parseTimeline).toHaveBeenCalledWith(
        'json',
        expect.objectContaining({ tempo: 100 }),
        80
      );
      expect(result.current.lessonMeta.tempo).toBe(100);
      expect(result.current.lessonMeta.beatsPerMeasure).toBe(4);
      expect(result.current.timelineVersion).toBe(1);
    });

    it('should load lesson with different time signature', async () => {
      // Mock specific return for this test
      TimeLineParser.parseTimeline.mockReturnValueOnce({
        timeline: [],
        metadata: { beatsPerMeasure: 3, beatType: 4 }
      });

      const { result } = renderHook(() =>
        useTimeline('lesson', 'test-lesson-2', mockSettings)
      );

      await act(async () => {
        await result.current.loadTimeline();
      });

      expect(result.current.lessonMeta.tempo).toBe(120);
      expect(result.current.lessonMeta.beatsPerMeasure).toBe(3);
    });

    it('should fallback to first lesson if ID not found', async () => {
      const { result } = renderHook(() =>
        useTimeline('lesson', 'non-existent-id', mockSettings)
      );

      await act(async () => {
        await result.current.loadTimeline();
      });

      // Should use first lesson
      expect(result.current.lessonMeta.tempo).toBe(100);
    });

    it('should handle lesson without time signature', async () => {
      const lessonWithoutTimeSig = {
        id: 'no-timesig',
        data: { tempo: 90, notes: [] }
      };

      TimeLineParser.AVAILABLE_LESSONS.push(lessonWithoutTimeSig);

      const { result } = renderHook(() =>
        useTimeline('lesson', 'no-timesig', mockSettings)
      );

      await act(async () => {
        await result.current.loadTimeline();
      });

      expect(result.current.lessonMeta.beatsPerMeasure).toBe(4); // default
    });

    it('should prioritize sources correctly (file > xml > data)', async () => {
        const complexLesson = {
            id: 'priority-test',
            data: { notes: [], tempo: 100 },
            xml: '<score-partwise><part><measure number="1"><note><duration>1</duration></note></measure></part></score-partwise>'
        };
        TimeLineParser.AVAILABLE_LESSONS.push(complexLesson);

        const { result } = renderHook(() =>
            useTimeline('lesson', 'priority-test', mockSettings)
        );

        await act(async () => {
            await result.current.loadTimeline();
        });

        // Should have called parseTimeline with 'musicxml' because 'xml' exists, even though 'data' also exists
        expect(TimeLineParser.parseTimeline).toHaveBeenCalledWith(
            'musicxml',
            complexLesson.xml,
            80
        );
    });
  });

  describe('Practice Mode Loading', () => {
    it('should generate random timeline in practice mode', async () => {
      const { result } = renderHook(() =>
        useTimeline('practice', null, mockSettings)
      );

      await act(async () => {
        await result.current.loadTimeline();
      });

      expect(NoteGenerator.generateRandomTimeline).toHaveBeenCalledWith(
        'C4',
        'G4',
        20,
        80,
        false,
        [4.0, 2.0, 1.0] // whole, half, quarter enabled
      );
    });

    it('should use default tempo and time signature in practice mode', async () => {
      const { result } = renderHook(() =>
        useTimeline('practice', null, mockSettings)
      );

      await act(async () => {
        await result.current.loadTimeline();
      });

      expect(result.current.lessonMeta.tempo).toBe(80);
      expect(result.current.lessonMeta.beatsPerMeasure).toBe(4);
    });

    it('should handle different enabled durations', async () => {
      const customSettings = {
        ...mockSettings,
        enabledDurations: {
          whole: false,
          half: true,
          quarter: false,
          eighth: true,
          sixteenth: true
        }
      };

      const { result } = renderHook(() =>
        useTimeline('practice', null, customSettings)
      );

      await act(async () => {
        await result.current.loadTimeline();
      });

      expect(NoteGenerator.generateRandomTimeline).toHaveBeenCalledWith(
        expect.anything(),
        expect.anything(),
        expect.anything(),
        expect.anything(),
        expect.anything(),
        [2.0, 0.5, 0.25] // half, eighth, sixteenth
      );
    });

    it('should default to quarter notes if no durations enabled', async () => {
      const noEnabledSettings = {
        ...mockSettings,
        enabledDurations: {
          whole: false,
          half: false,
          quarter: false,
          eighth: false,
          sixteenth: false
        }
      };

      const { result } = renderHook(() =>
        useTimeline('practice', null, noEnabledSettings)
      );

      await act(async () => {
        await result.current.loadTimeline();
      });

      expect(NoteGenerator.generateRandomTimeline).toHaveBeenCalledWith(
        expect.anything(),
        expect.anything(),
        expect.anything(),
        expect.anything(),
        expect.anything(),
        [1.0] // default quarter note
      );
    });

    it('should pass includeSharps setting to generator', async () => {
      const sharpsSettings = { ...mockSettings, includeSharps: true };

      const { result } = renderHook(() =>
        useTimeline('practice', null, sharpsSettings)
      );

      await act(async () => {
        await result.current.loadTimeline();
      });

      expect(NoteGenerator.generateRandomTimeline).toHaveBeenCalledWith(
        expect.anything(),
        expect.anything(),
        expect.anything(),
        expect.anything(),
        true,
        expect.anything()
      );
    });
  });

  describe('Timeline Normalization', () => {
    it('should normalize timeline with midi field present', async () => {
      TimeLineParser.parseTimeline.mockReturnValueOnce({
        timeline: [{ midi: 60, start: 0, durationBeats: 1 }],
        metadata: { beatsPerMeasure: 4 }
      });

      const { result } = renderHook(() =>
        useTimeline('lesson', 'test-lesson-1', mockSettings)
      );

      await act(async () => {
        await result.current.loadTimeline();
      });

      const timeline = result.current.timelineRef.current;
      expect(timeline[0].midi).toBe(60);
      expect(timeline[0].vfKey).toBe('c/4');
      expect(timeline[0].pitch).toBe('C4');
    });

    it('should fallback to pitch field when midi is missing', async () => {
      TimeLineParser.parseTimeline.mockReturnValueOnce({
        timeline: [{ pitch: 'D4', start: 0, durationBeats: 1 }],
        metadata: { beatsPerMeasure: 4 }
      });

      const { result } = renderHook(() =>
        useTimeline('lesson', 'test-lesson-1', mockSettings)
      );

      await act(async () => {
        await result.current.loadTimeline();
      });

      const timeline = result.current.timelineRef.current;
      expect(timeline[0].midi).toBe(62); // D4 = MIDI 62
      expect(timeline[0].vfKey).toBe('d/4');
    });

    it('should fallback through multiple fields (midi → pitch → key → note → name → vfKey)', async () => {
      TimeLineParser.parseTimeline.mockReturnValueOnce({
        timeline: [
            { key: 'E4', start: 0, durationBeats: 1 },
            { note: 'F4', start: 1, durationBeats: 1 },
            { name: 'G4', start: 2, durationBeats: 1 }
        ],
        metadata: { beatsPerMeasure: 4 }
      });

      const { result } = renderHook(() =>
        useTimeline('lesson', 'test-lesson-1', mockSettings)
      );

      await act(async () => {
        await result.current.loadTimeline();
      });

      const timeline = result.current.timelineRef.current;
      expect(timeline[0].midi).toBe(64); // E4
      expect(timeline[1].midi).toBe(65); // F4
      expect(timeline[2].midi).toBe(67); // G4
    });

    it('should handle vfKey field correctly', async () => {
      TimeLineParser.parseTimeline.mockReturnValueOnce({
        timeline: [{ vfKey: 'g/4', start: 0, durationBeats: 1 }],
        metadata: { beatsPerMeasure: 4 }
      });

      const { result } = renderHook(() =>
        useTimeline('lesson', 'test-lesson-1', mockSettings)
      );

      await act(async () => {
        await result.current.loadTimeline();
      });

      const timeline = result.current.timelineRef.current;
      expect(timeline[0].midi).toBe(67); // G4
      expect(timeline[0].vfKey).toBe('g/4');
    });

    it('should handle keys array (first element)', async () => {
      TimeLineParser.parseTimeline.mockReturnValueOnce({
        timeline: [{ keys: ['a/4', 'c/5'], start: 0, durationBeats: 1 }],
        metadata: { beatsPerMeasure: 4 }
      });

      const { result } = renderHook(() =>
        useTimeline('lesson', 'test-lesson-1', mockSettings)
      );

      await act(async () => {
        await result.current.loadTimeline();
      });

      const timeline = result.current.timelineRef.current;
      expect(timeline[0].midi).toBe(69); // A4 from keys[0]
    });

    it('should handle numeric MIDI values correctly', async () => {
      TimeLineParser.parseTimeline.mockReturnValueOnce({
        timeline: [{ midi: 72, start: 0, durationBeats: 1 }], // C5
        metadata: { beatsPerMeasure: 4 }
      });

      const { result } = renderHook(() =>
        useTimeline('lesson', 'test-lesson-1', mockSettings)
      );

      await act(async () => {
        await result.current.loadTimeline();
      });

      const timeline = result.current.timelineRef.current;
      expect(timeline[0].midi).toBe(72);
      expect(timeline[0].vfKey).toBe('c/5');
    });

    it('should set null values when no valid pitch source found', async () => {
      TimeLineParser.parseTimeline.mockReturnValueOnce({
        timeline: [{ start: 0, durationBeats: 1 }], // No pitch info at all
        metadata: { beatsPerMeasure: 4 }
      });

      const { result } = renderHook(() =>
        useTimeline('lesson', 'test-lesson-1', mockSettings)
      );

      await act(async () => {
        await result.current.loadTimeline();
      });

      const timeline = result.current.timelineRef.current;
      expect(timeline[0].midi).toBeNull();
      expect(timeline[0].vfKey).toBeNull();
    });
  });

  describe('onTimelineLoaded Callback', () => {
    it('should invoke callback when timeline loads', async () => {
      const onLoaded = vi.fn();

      const { result } = renderHook(() =>
        useTimeline('lesson', 'test-lesson-1', mockSettings, onLoaded)
      );

      await act(async () => {
        await result.current.loadTimeline();
      });

      expect(onLoaded).toHaveBeenCalledWith(
        expect.objectContaining({ tempo: 100 }),
        'lesson'
      );
    });

    it('should handle undefined callback gracefully', async () => {
      const { result } = renderHook(() =>
        useTimeline('lesson', 'test-lesson-1', mockSettings, undefined)
      );

      await expect(async () => {
        await act(async () => {
            await result.current.loadTimeline();
        });
      }).not.toThrow();
    });

    it('should update callback reference when it changes', async () => {
      const onLoaded1 = vi.fn();
      const onLoaded2 = vi.fn();

      const { result, rerender } = renderHook(
        ({ callback }) => useTimeline('lesson', 'test-lesson-1', mockSettings, callback),
        { initialProps: { callback: onLoaded1 } }
      );

      await act(async () => {
        await result.current.loadTimeline();
      });

      expect(onLoaded1).toHaveBeenCalledTimes(1);

      // Change callback
      rerender({ callback: onLoaded2 });

      await act(async () => {
        await result.current.loadTimeline();
      });

      expect(onLoaded2).toHaveBeenCalledTimes(1);
      expect(onLoaded1).toHaveBeenCalledTimes(1); // Not called again
    });
  });

  describe('Timeline Version', () => {
    it('should increment timelineVersion on each load', async () => {
      const { result } = renderHook(() =>
        useTimeline('lesson', 'test-lesson-1', mockSettings)
      );

      expect(result.current.timelineVersion).toBe(0);

      await act(async () => {
        await result.current.loadTimeline();
      });

      expect(result.current.timelineVersion).toBe(1);

      await act(async () => {
        await result.current.loadTimeline();
      });

      expect(result.current.timelineVersion).toBe(2);
    });
  });

  describe('TimelineRef', () => {
    it('should update timelineRef.current with normalized timeline', async () => {
      const { result } = renderHook(() =>
        useTimeline('lesson', 'test-lesson-1', mockSettings)
      );

      await act(async () => {
        await result.current.loadTimeline();
      });

      expect(result.current.timelineRef.current).toHaveLength(2);
      expect(result.current.timelineRef.current[0]).toMatchObject({
        midi: 60,
        vfKey: 'c/4'
      });
    });

    it('should preserve all original event properties', async () => {
      TimeLineParser.parseTimeline.mockReturnValueOnce({
        timeline: [{
            midi: 60,
            start: 0,
            durationBeats: 1,
            measure: 1,
            beat: 1,
            customField: 'test'
        }],
        metadata: { beatsPerMeasure: 4 }
      });

      const { result } = renderHook(() =>
        useTimeline('lesson', 'test-lesson-1', mockSettings)
      );

      await act(async () => {
        await result.current.loadTimeline();
      });

      const event = result.current.timelineRef.current[0];
      expect(event.customField).toBe('test');
      expect(event.measure).toBe(1);
      expect(event.beat).toBe(1);
    });
  });
});
