// src/hooks/__tests__/useMidiSystem.test.js
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useMidiSystem } from '../useMidiSystem';
import * as MidiInput from '../../midi/MidiInput';
import * as AudioSynth from '../../audio/AudioSynth';
import * as validation from '../../core/validation';

// Mock dependencies
vi.mock('../../midi/MidiInput');
vi.mock('../../audio/AudioSynth');

describe('useMidiSystem', () => {
  let mockCallbacks = {};
  let mockAudioSynth;
  let mockTimelineRef;
  let mockScrollOffsetRef;
  let mockPausedRef;
  let mockSettings;
  let mockLessonMeta;

  beforeEach(() => {
    vi.clearAllMocks();

    // Mock performance.now
    let currentTime = 1000;
    vi.spyOn(performance, 'now').mockImplementation(() => currentTime);
    global.advanceTime = (ms) => { currentTime += ms; };
    global.setTime = (ms) => { currentTime = ms; };

    // Mock setTimeout
    vi.useFakeTimers();

    // Mock AudioSynth
    mockAudioSynth = {
      playNote: vi.fn(),
      stopNote: vi.fn()
    };
    AudioSynth.audioSynth = mockAudioSynth;

    // Mock initializeMidi to capture callbacks
    MidiInput.initializeMidi.mockImplementation((callbacks) => {
      mockCallbacks = callbacks;
      // Simulate MIDI ready
      callbacks.onReady(true);
      return vi.fn(); // cleanup function
    });

    // Setup refs and props
    mockTimelineRef = {
      current: [
        { midi: 60, start: 0, durationBeats: 1, vfKey: 'C4', pitch: 'C4' },
        { midi: 62, start: 1, durationBeats: 2, vfKey: 'D4', pitch: 'D4' },
        { midi: 64, start: 3, durationBeats: 1, vfKey: 'E4', pitch: 'E4' }
      ]
    };

    mockScrollOffsetRef = { current: 0 };
    mockPausedRef = { current: false };

    mockSettings = {
      beatTolerance: 0.5,
      validateNoteLength: true
    };

    mockLessonMeta = {
      tempo: 120,
      beatsPerMeasure: 4
    };
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  describe('Initialization', () => {
    it('should initialize with default state', () => {
      const { result } = renderHook(() =>
        useMidiSystem(mockTimelineRef, mockScrollOffsetRef, mockLessonMeta, mockPausedRef, mockSettings)
      );

      expect(result.current.midiSupported).toBe(true);
      expect(result.current.log).toEqual([]);
      expect(result.current.playheadFlash).toBe(null);
      expect(result.current.pulseActive).toBe(false);
      expect(result.current.pulseColor).toBe('red');
    });

    it('should call initializeMidi on mount', () => {
      renderHook(() =>
        useMidiSystem(mockTimelineRef, mockScrollOffsetRef, mockLessonMeta, mockPausedRef, mockSettings)
      );

      expect(MidiInput.initializeMidi).toHaveBeenCalledWith({
        onNoteOn: expect.any(Function),
        onNoteOff: expect.any(Function),
        onLog: expect.any(Function),
        onReady: expect.any(Function)
      });
    });

    it('should set midiSupported based on onReady callback', () => {
      MidiInput.initializeMidi.mockImplementation((callbacks) => {
        mockCallbacks = callbacks;
        callbacks.onReady(false);
        return vi.fn();
      });

      const { result } = renderHook(() =>
        useMidiSystem(mockTimelineRef, mockScrollOffsetRef, mockLessonMeta, mockPausedRef, mockSettings)
      );

      expect(result.current.midiSupported).toBe(false);
    });
  });

  describe('onNoteOn Handler', () => {
    it('should play note through AudioSynth', () => {
      renderHook(() =>
        useMidiSystem(mockTimelineRef, mockScrollOffsetRef, mockLessonMeta, mockPausedRef, mockSettings)
      );

      act(() => {
        mockCallbacks.onNoteOn(60, 'C4');
      });

      expect(mockAudioSynth.playNote).toHaveBeenCalledWith('C4');
    });

    it('should log noteOn events', () => {
      const { result } = renderHook(() =>
        useMidiSystem(mockTimelineRef, mockScrollOffsetRef, mockLessonMeta, mockPausedRef, mockSettings)
      );

      act(() => {
        mockCallbacks.onNoteOn(60, 'C4');
      });

      expect(result.current.log).toContain('noteOn 60 (C4)');
    });

    it('should debounce rapid note events', () => {
      const { result } = renderHook(() =>
        useMidiSystem(mockTimelineRef, mockScrollOffsetRef, mockLessonMeta, mockPausedRef, mockSettings)
      );

      act(() => {
        mockCallbacks.onNoteOn(60, 'C4');
      });

      const firstLogLength = result.current.log.length;

      // Try to trigger same note within 50ms
      global.advanceTime(30);

      act(() => {
        mockCallbacks.onNoteOn(60, 'C4');
      });

      // Should not add new log entry due to debouncing
      expect(result.current.log.length).toBe(firstLogLength);
    });

    it('should allow note after debounce period', () => {
      const { result } = renderHook(() =>
        useMidiSystem(mockTimelineRef, mockScrollOffsetRef, mockLessonMeta, mockPausedRef, mockSettings)
      );

      act(() => {
        mockCallbacks.onNoteOn(60, 'C4');
      });

      const firstLogLength = result.current.log.length;

      // Advance time beyond debounce period
      global.advanceTime(60);

      act(() => {
        mockCallbacks.onNoteOn(60, 'C4');
      });

      // Should add new log entry after debounce period
      expect(result.current.log.length).toBeGreaterThan(firstLogLength);
    });

    it('should skip validation when paused', () => {
      mockPausedRef.current = true;

      const validateSpy = vi.spyOn(validation, 'validateNoteOn');

      renderHook(() =>
        useMidiSystem(mockTimelineRef, mockScrollOffsetRef, mockLessonMeta, mockPausedRef, mockSettings)
      );

      act(() => {
        mockCallbacks.onNoteOn(60, 'C4');
      });

      expect(validateSpy).not.toHaveBeenCalled();
    });

    it('should validate correct note and flash green', () => {
      const validateSpy = vi.spyOn(validation, 'validateNoteOn').mockReturnValue({
        result: 'correct',
        message: '✅ Correct: C4 (dt=0.00 beats)',
        color: 'green',
        matchedIndex: 0,
        matchData: { index: 0, startBeat: 0, durationBeats: 1 }
      });

      const { result } = renderHook(() =>
        useMidiSystem(mockTimelineRef, mockScrollOffsetRef, mockLessonMeta, mockPausedRef, mockSettings)
      );

      act(() => {
        mockCallbacks.onNoteOn(60, 'C4');
      });

      expect(validateSpy).toHaveBeenCalled();
      expect(result.current.log).toContain('✅ Correct: C4 (dt=0.00 beats)');
      expect(result.current.playheadFlash).toBe('green');
      expect(result.current.pulseActive).toBe(true);
      expect(result.current.pulseColor).toBe('green');
    });

    it('should validate wrong note and flash red', () => {
      const validateSpy = vi.spyOn(validation, 'validateNoteOn').mockReturnValue({
        result: 'wrong',
        message: '❌ Wrong: played C4, expected D4 (dt=0.50 beats)',
        color: 'red'
      });

      const { result } = renderHook(() =>
        useMidiSystem(mockTimelineRef, mockScrollOffsetRef, mockLessonMeta, mockPausedRef, mockSettings)
      );

      act(() => {
        mockCallbacks.onNoteOn(60, 'C4');
      });

      expect(result.current.log).toContain('❌ Wrong: played C4, expected D4 (dt=0.50 beats)');
      expect(result.current.playheadFlash).toBe('red');
      expect(result.current.pulseColor).toBe('red');
    });

    it('should validate extra note', () => {
      const validateSpy = vi.spyOn(validation, 'validateNoteOn').mockReturnValue({
        result: 'extra',
        message: '❌ Extra/Misplaced: played C4 at 5.00b',
        color: 'red'
      });

      const { result } = renderHook(() =>
        useMidiSystem(mockTimelineRef, mockScrollOffsetRef, mockLessonMeta, mockPausedRef, mockSettings)
      );

      mockScrollOffsetRef.current = 500; // 5 beats

      act(() => {
        mockCallbacks.onNoteOn(60, 'C4');
      });

      expect(result.current.log).toContain('❌ Extra/Misplaced: played C4 at 5.00b');
    });

    it('should clear playhead flash after timeout', () => {
      const validateSpy = vi.spyOn(validation, 'validateNoteOn').mockReturnValue({
        result: 'correct',
        message: '✅ Correct',
        color: 'green',
        matchedIndex: 0,
        matchData: { index: 0, startBeat: 0, durationBeats: 1 }
      });

      const { result } = renderHook(() =>
        useMidiSystem(mockTimelineRef, mockScrollOffsetRef, mockLessonMeta, mockPausedRef, mockSettings)
      );

      act(() => {
        mockCallbacks.onNoteOn(60, 'C4');
      });

      expect(result.current.playheadFlash).toBe('green');
      expect(result.current.pulseActive).toBe(true);

      // Advance timers to trigger flash timeout
      act(() => {
        vi.advanceTimersByTime(220);
      });

      expect(result.current.playheadFlash).toBe(null);
      expect(result.current.pulseActive).toBe(false);
    });
  });

  describe('onNoteOff Handler', () => {
    it('should stop note through AudioSynth', () => {
      renderHook(() =>
        useMidiSystem(mockTimelineRef, mockScrollOffsetRef, mockLessonMeta, mockPausedRef, mockSettings)
      );

      act(() => {
        mockCallbacks.onNoteOff(60, 'C4');
      });

      expect(mockAudioSynth.stopNote).toHaveBeenCalledWith('C4');
    });

    it('should log noteOff events', () => {
      const { result } = renderHook(() =>
        useMidiSystem(mockTimelineRef, mockScrollOffsetRef, mockLessonMeta, mockPausedRef, mockSettings)
      );

      act(() => {
        mockCallbacks.onNoteOff(60, 'C4');
      });

      expect(result.current.log).toContain('noteOff 60 (C4)');
    });

    it('should skip validation when paused', () => {
      mockPausedRef.current = true;

      const validateSpy = vi.spyOn(validation, 'validateNoteOff');

      renderHook(() =>
        useMidiSystem(mockTimelineRef, mockScrollOffsetRef, mockLessonMeta, mockPausedRef, mockSettings)
      );

      act(() => {
        mockCallbacks.onNoteOff(60, 'C4');
      });

      expect(validateSpy).not.toHaveBeenCalled();
    });

    it('should validate perfect release timing', () => {
      const validateOffSpy = vi.spyOn(validation, 'validateNoteOff').mockReturnValue({
        result: 'perfect_release',
        message: '✨ Perfect Release! Held 1.00b (target 1.00b)'
      });

      const { result } = renderHook(() =>
        useMidiSystem(mockTimelineRef, mockScrollOffsetRef, mockLessonMeta, mockPausedRef, mockSettings)
      );

      // First trigger noteOn to create active match
      vi.spyOn(validation, 'validateNoteOn').mockReturnValue({
        result: 'correct',
        color: 'green',
        matchedIndex: 0,
        matchData: { index: 0, startBeat: 0, durationBeats: 1 }
      });

      act(() => {
        mockCallbacks.onNoteOn(60, 'C4');
      });

      // Move forward in time and trigger noteOff
      mockScrollOffsetRef.current = 100; // 1 beat

      act(() => {
        mockCallbacks.onNoteOff(60, 'C4');
      });

      expect(result.current.log).toContain('✨ Perfect Release! Held 1.00b (target 1.00b)');
    });

    it('should validate early release', () => {
      const validateOffSpy = vi.spyOn(validation, 'validateNoteOff').mockReturnValue({
        result: 'early_release',
        message: '⚠️ Released Early: Held 0.50b (target 1.00b)'
      });

      const { result } = renderHook(() =>
        useMidiSystem(mockTimelineRef, mockScrollOffsetRef, mockLessonMeta, mockPausedRef, mockSettings)
      );

      // Setup active match
      vi.spyOn(validation, 'validateNoteOn').mockReturnValue({
        result: 'correct',
        color: 'green',
        matchedIndex: 0,
        matchData: { index: 0, startBeat: 0, durationBeats: 1 }
      });

      act(() => {
        mockCallbacks.onNoteOn(60, 'C4');
      });

      mockScrollOffsetRef.current = 50; // 0.5 beats

      act(() => {
        mockCallbacks.onNoteOff(60, 'C4');
      });

      expect(result.current.log).toContain('⚠️ Released Early: Held 0.50b (target 1.00b)');
    });

    it('should not validate release when validateNoteLength is false', () => {
      mockSettings.validateNoteLength = false;

      const validateOffSpy = vi.spyOn(validation, 'validateNoteOff').mockReturnValue(null);

      const { result } = renderHook(() =>
        useMidiSystem(mockTimelineRef, mockScrollOffsetRef, mockLessonMeta, mockPausedRef, mockSettings)
      );

      act(() => {
        mockCallbacks.onNoteOff(60, 'C4');
      });

      // Should only have the noteOff log, no validation message
      expect(result.current.log).toEqual(['noteOff 60 (C4)']);
    });
  });

  describe('onLog Handler', () => {
    it('should add log messages', () => {
      const { result } = renderHook(() =>
        useMidiSystem(mockTimelineRef, mockScrollOffsetRef, mockLessonMeta, mockPausedRef, mockSettings)
      );

      act(() => {
        mockCallbacks.onLog('MIDI device connected');
      });

      expect(result.current.log).toContain('MIDI device connected');
    });
  });

  describe('resetMidiState', () => {
    it('should clear all state refs', () => {
      const { result } = renderHook(() =>
        useMidiSystem(mockTimelineRef, mockScrollOffsetRef, mockLessonMeta, mockPausedRef, mockSettings)
      );

      // Setup some state
      vi.spyOn(validation, 'validateNoteOn').mockReturnValue({
        result: 'correct',
        color: 'green',
        matchedIndex: 0,
        matchData: { index: 0, startBeat: 0, durationBeats: 1 }
      });

      act(() => {
        mockCallbacks.onNoteOn(60, 'C4');
        mockCallbacks.onNoteOn(62, 'D4');
      });

      // Reset
      act(() => {
        result.current.resetMidiState();
      });

      // Verify state is cleared by checking that a noteOff doesn't find an active match
      const validateOffSpy = vi.spyOn(validation, 'validateNoteOff');

      act(() => {
        mockCallbacks.onNoteOff(60, 'C4');
      });

      // Should be called with undefined activeMatch
      expect(validateOffSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          activeMatch: undefined
        })
      );
    });
  });

  describe('setLog', () => {
    it('should allow external log updates', () => {
      const { result } = renderHook(() =>
        useMidiSystem(mockTimelineRef, mockScrollOffsetRef, mockLessonMeta, mockPausedRef, mockSettings)
      );

      act(() => {
        result.current.setLog(['Test message']);
      });

      expect(result.current.log).toEqual(['Test message']);
    });

    it('should clear logs', () => {
      const { result } = renderHook(() =>
        useMidiSystem(mockTimelineRef, mockScrollOffsetRef, mockLessonMeta, mockPausedRef, mockSettings)
      );

      act(() => {
        mockCallbacks.onLog('Message 1');
        mockCallbacks.onLog('Message 2');
      });

      expect(result.current.log.length).toBe(2);

      act(() => {
        result.current.setLog([]);
      });

      expect(result.current.log).toEqual([]);
    });
  });

  describe('Cleanup', () => {
    it('should call cleanup function on unmount', () => {
      const cleanupMock = vi.fn();
      MidiInput.initializeMidi.mockReturnValue(cleanupMock);

      const { unmount } = renderHook(() =>
        useMidiSystem(mockTimelineRef, mockScrollOffsetRef, mockLessonMeta, mockPausedRef, mockSettings)
      );

      unmount();

      expect(cleanupMock).toHaveBeenCalled();
    });

    it('should cleanup on settings change', () => {
      const cleanupMock = vi.fn();
      MidiInput.initializeMidi.mockReturnValue(cleanupMock);

      const { rerender } = renderHook(
        ({ settings }) => useMidiSystem(mockTimelineRef, mockScrollOffsetRef, mockLessonMeta, mockPausedRef, settings),
        { initialProps: { settings: mockSettings } }
      );

      // Change settings to trigger effect cleanup and re-run
      const newSettings = { ...mockSettings, beatTolerance: 1.0 };

      rerender({ settings: newSettings });

      expect(cleanupMock).toHaveBeenCalled();
    });
  });

  describe('activeNotes Tracking', () => {
    it('should track currently pressed notes', () => {
      const { result } = renderHook(() =>
        useMidiSystem(mockTimelineRef, mockScrollOffsetRef, mockLessonMeta, mockPausedRef, mockSettings)
      );

      act(() => {
        mockCallbacks.onNoteOn('C4', 60);
      });

      expect(result.current.activeNotes).toEqual([{ pitch: 'C4', note: 60 }]);

      act(() => {
        mockCallbacks.onNoteOn('E4', 64);
      });

      expect(result.current.activeNotes).toEqual([
        { pitch: 'C4', note: 60 },
        { pitch: 'E4', note: 64 }
      ]);
    });

    it('should remove notes on noteOff', () => {
      const { result } = renderHook(() =>
        useMidiSystem(mockTimelineRef, mockScrollOffsetRef, mockLessonMeta, mockPausedRef, mockSettings)
      );

      act(() => {
        mockCallbacks.onNoteOn('C4', 60);
        mockCallbacks.onNoteOn('E4', 64);
      });

      act(() => {
        mockCallbacks.onNoteOff('C4', 60);
      });

      expect(result.current.activeNotes).toEqual([{ pitch: 'E4', note: 64 }]);

      act(() => {
        mockCallbacks.onNoteOff('E4', 64);
      });

      expect(result.current.activeNotes).toEqual([]);
    });

    it('should keep notes sorted by MIDI number', () => {
      const { result } = renderHook(() =>
        useMidiSystem(mockTimelineRef, mockScrollOffsetRef, mockLessonMeta, mockPausedRef, mockSettings)
      );

      act(() => {
        mockCallbacks.onNoteOn('E4', 64);
        mockCallbacks.onNoteOn('C4', 60);
        mockCallbacks.onNoteOn('G4', 67);
      });

      expect(result.current.activeNotes).toEqual([
        { pitch: 'C4', note: 60 },
        { pitch: 'E4', note: 64 },
        { pitch: 'G4', note: 67 }
      ]);
    });

    it('should clear activeNotes on resetMidiState', () => {
      const { result } = renderHook(() =>
        useMidiSystem(mockTimelineRef, mockScrollOffsetRef, mockLessonMeta, mockPausedRef, mockSettings)
      );

      act(() => {
        mockCallbacks.onNoteOn('C4', 60);
      });

      expect(result.current.activeNotes.length).toBe(1);

      act(() => {
        result.current.resetMidiState();
      });

      expect(result.current.activeNotes).toEqual([]);
    });
  });

  describe('Exported Values', () => {
    it('should expose all required properties', () => {
      const { result } = renderHook(() =>
        useMidiSystem(mockTimelineRef, mockScrollOffsetRef, mockLessonMeta, mockPausedRef, mockSettings)
      );

      expect(result.current).toHaveProperty('midiSupported');
      expect(result.current).toHaveProperty('log');
      expect(result.current).toHaveProperty('setLog');
      expect(result.current).toHaveProperty('playheadFlash');
      expect(result.current).toHaveProperty('pulseActive');
      expect(result.current).toHaveProperty('pulseColor');
      expect(result.current).toHaveProperty('hits');
      expect(result.current).toHaveProperty('wrongNotes');
      expect(result.current).toHaveProperty('misses');
      expect(result.current).toHaveProperty('activeNotes');
      expect(result.current).toHaveProperty('resetMidiState');
    });
  });

  describe('Scoring System', () => {
    describe('Initialization', () => {
      it('should initialize scoring counters to zero', () => {
        const { result } = renderHook(() =>
          useMidiSystem(mockTimelineRef, mockScrollOffsetRef, mockLessonMeta, mockPausedRef, mockSettings)
        );

        expect(result.current.hits).toBe(0);
        expect(result.current.wrongNotes).toBe(0);
        expect(result.current.misses).toBe(0);
      });
    });

    describe('Hit Counting', () => {
      it('should increment hits when correct note is played', () => {
        vi.spyOn(validation, 'validateNoteOn').mockReturnValue({
          result: 'correct',
          message: '✅ Correct: C4 (dt=0.01 beats)',
          color: 'green',
          matchedIndex: 0,
          matchData: { index: 0, startBeat: 0, durationBeats: 1 }
        });

        const { result } = renderHook(() =>
          useMidiSystem(mockTimelineRef, mockScrollOffsetRef, mockLessonMeta, mockPausedRef, mockSettings)
        );

        act(() => {
          mockCallbacks.onNoteOn(60, 'C4');
        });

        expect(result.current.hits).toBe(1);
        expect(result.current.wrongNotes).toBe(0);
        expect(result.current.misses).toBe(0);
      });

      it('should increment hits for multiple correct notes', () => {
        const { result } = renderHook(() =>
          useMidiSystem(mockTimelineRef, mockScrollOffsetRef, mockLessonMeta, mockPausedRef, mockSettings)
        );

        // Play three correct notes
        vi.spyOn(validation, 'validateNoteOn')
          .mockReturnValueOnce({
            result: 'correct',
            color: 'green',
            matchedIndex: 0,
            matchData: { index: 0, startBeat: 0, durationBeats: 1 }
          })
          .mockReturnValueOnce({
            result: 'correct',
            color: 'green',
            matchedIndex: 1,
            matchData: { index: 1, startBeat: 1, durationBeats: 1 }
          })
          .mockReturnValueOnce({
            result: 'correct',
            color: 'green',
            matchedIndex: 2,
            matchData: { index: 2, startBeat: 2, durationBeats: 1 }
          });

        act(() => {
          global.advanceTime(60);
          mockCallbacks.onNoteOn(60, 'C4');
          global.advanceTime(60);
          mockCallbacks.onNoteOn(62, 'D4');
          global.advanceTime(60);
          mockCallbacks.onNoteOn(64, 'E4');
        });

        expect(result.current.hits).toBe(3);
      });
    });

    describe('Wrong Note Counting', () => {
      it('should increment wrongNotes when wrong pitch is played', () => {
        vi.spyOn(validation, 'validateNoteOn').mockReturnValue({
          result: 'wrong',
          message: '❌ Wrong: played 65, expected C4 (dt=0.05 beats)',
          color: 'red',
          nearestIndex: 0
        });

        const { result } = renderHook(() =>
          useMidiSystem(mockTimelineRef, mockScrollOffsetRef, mockLessonMeta, mockPausedRef, mockSettings)
        );

        act(() => {
          mockCallbacks.onNoteOn(65, 'F4');
        });

        expect(result.current.hits).toBe(0);
        expect(result.current.wrongNotes).toBe(1);
        expect(result.current.misses).toBe(0);
      });

      it('should increment wrongNotes for extra notes', () => {
        vi.spyOn(validation, 'validateNoteOn').mockReturnValue({
          result: 'extra',
          message: '❌ Extra/Misplaced: played 60 at 5.00b',
          color: 'red'
        });

        const { result } = renderHook(() =>
          useMidiSystem(mockTimelineRef, mockScrollOffsetRef, mockLessonMeta, mockPausedRef, mockSettings)
        );

        mockScrollOffsetRef.current = 500; // 5 beats

        act(() => {
          mockCallbacks.onNoteOn(60, 'C4');
        });

        expect(result.current.hits).toBe(0);
        expect(result.current.wrongNotes).toBe(1);
        expect(result.current.misses).toBe(0);
      });

      it('should count multiple wrong notes', () => {
        const { result } = renderHook(() =>
          useMidiSystem(mockTimelineRef, mockScrollOffsetRef, mockLessonMeta, mockPausedRef, mockSettings)
        );

        vi.spyOn(validation, 'validateNoteOn')
          .mockReturnValueOnce({
            result: 'wrong',
            color: 'red',
            nearestIndex: 0
          })
          .mockReturnValueOnce({
            result: 'extra',
            color: 'red'
          });

        act(() => {
          global.advanceTime(60);
          mockCallbacks.onNoteOn(65, 'F4'); // wrong note
          global.advanceTime(60);
          mockCallbacks.onNoteOn(70, 'A4'); // extra note
        });

        expect(result.current.wrongNotes).toBe(2);
      });
    });

    describe('Passive Miss Watchdog', () => {
      it('should mark notes as missed when they scroll past without being played', async () => {
        const { result } = renderHook(() =>
          useMidiSystem(mockTimelineRef, mockScrollOffsetRef, mockLessonMeta, mockPausedRef, mockSettings)
        );

        // Move playhead far past the first note (beyond 5.5 beat threshold)
        mockScrollOffsetRef.current = 650; // 6.5 beats (note at 0 beats + 5.5 buffer = 5.5)

        // Wait for watchdog interval to run (200ms)
        await act(async () => {
          vi.advanceTimersByTime(200);
        });

        expect(result.current.misses).toBe(1);
        expect(result.current.log.some(l => l.includes('❌ Missed'))).toBe(true);
      });

      it('should not mark notes as missed if they are within the tolerance buffer', async () => {
        const { result } = renderHook(() =>
          useMidiSystem(mockTimelineRef, mockScrollOffsetRef, mockLessonMeta, mockPausedRef, mockSettings)
        );

        // Move playhead just past the note but within buffer (5.5 beats)
        mockScrollOffsetRef.current = 500; // 5.0 beats (note at 0 + buffer 5.5 = still valid)

        await act(async () => {
          vi.advanceTimersByTime(200);
        });

        expect(result.current.misses).toBe(0);
      });

      it('should not mark attempted notes as missed', async () => {
        vi.spyOn(validation, 'validateNoteOn').mockReturnValue({
          result: 'correct',
          color: 'green',
          matchedIndex: 0,
          matchData: { index: 0, startBeat: 0, durationBeats: 1 }
        });

        const { result } = renderHook(() =>
          useMidiSystem(mockTimelineRef, mockScrollOffsetRef, mockLessonMeta, mockPausedRef, mockSettings)
        );

        // Play the note
        act(() => {
          mockCallbacks.onNoteOn(60, 'C4');
        });

        // Move playhead past the note
        mockScrollOffsetRef.current = 650; // 6.5 beats

        // Wait for watchdog
        await act(async () => {
          vi.advanceTimersByTime(200);
        });

        expect(result.current.hits).toBe(1);
        expect(result.current.misses).toBe(0);
      });

      it('should not mark wrong notes as missed', async () => {
        vi.spyOn(validation, 'validateNoteOn').mockReturnValue({
          result: 'wrong',
          color: 'red',
          nearestIndex: 0
        });

        const { result } = renderHook(() =>
          useMidiSystem(mockTimelineRef, mockScrollOffsetRef, mockLessonMeta, mockPausedRef, mockSettings)
        );

        // Play wrong note for index 0
        act(() => {
          mockCallbacks.onNoteOn(65, 'F4');
        });

        // Move playhead past the note
        mockScrollOffsetRef.current = 650; // 6.5 beats

        // Wait for watchdog
        await act(async () => {
          vi.advanceTimersByTime(200);
        });

        expect(result.current.wrongNotes).toBe(1);
        expect(result.current.misses).toBe(0); // Should not also count as missed
      });

      it('should not run watchdog when paused', async () => {
        mockPausedRef.current = true;

        const { result } = renderHook(() =>
          useMidiSystem(mockTimelineRef, mockScrollOffsetRef, mockLessonMeta, mockPausedRef, mockSettings)
        );

        mockScrollOffsetRef.current = 650; // 6.5 beats

        await act(async () => {
          vi.advanceTimersByTime(200);
        });

        expect(result.current.misses).toBe(0);
      });

      it('should handle multiple missed notes', async () => {
        const { result } = renderHook(() =>
          useMidiSystem(mockTimelineRef, mockScrollOffsetRef, mockLessonMeta, mockPausedRef, mockSettings)
        );

        // Move playhead past all notes
        mockScrollOffsetRef.current = 950; // 9.5 beats (all 3 notes at 0, 1, 3 + 5.5 buffer)

        // Wait for watchdog
        await act(async () => {
          vi.advanceTimersByTime(200);
        });

        expect(result.current.misses).toBe(3); // All 3 notes should be marked as missed
      });
    });

    describe('Mixed Scenarios', () => {
      it('should correctly count hits, wrong notes, and misses', async () => {
        const { result } = renderHook(() =>
          useMidiSystem(mockTimelineRef, mockScrollOffsetRef, mockLessonMeta, mockPausedRef, mockSettings)
        );

        // Play first note correctly
        vi.spyOn(validation, 'validateNoteOn').mockReturnValueOnce({
          result: 'correct',
          color: 'green',
          matchedIndex: 0,
          matchData: { index: 0, startBeat: 0, durationBeats: 1 }
        });

        act(() => {
          global.advanceTime(60);
          mockCallbacks.onNoteOn(60, 'C4');
        });

        // Play second note incorrectly
        vi.spyOn(validation, 'validateNoteOn').mockReturnValueOnce({
          result: 'wrong',
          color: 'red',
          nearestIndex: 1
        });

        act(() => {
          global.advanceTime(60);
          mockScrollOffsetRef.current = 100; // 1 beat
          mockCallbacks.onNoteOn(65, 'F4');
        });

        // Skip third note (let it pass)
        mockScrollOffsetRef.current = 950; // 9.5 beats

        // Wait for watchdog to detect missed note
        await act(async () => {
          vi.advanceTimersByTime(200);
        });

        expect(result.current.hits).toBe(1);
        expect(result.current.wrongNotes).toBe(1);
        expect(result.current.misses).toBe(1); // Only index 2 should be missed
      });
    });

    describe('Reset Functionality', () => {
      it('should reset score when resetMidiState is called with default parameter', () => {
        vi.spyOn(validation, 'validateNoteOn').mockReturnValue({
          result: 'correct',
          color: 'green',
          matchedIndex: 0,
          matchData: { index: 0, startBeat: 0, durationBeats: 1 }
        });

        const { result } = renderHook(() =>
          useMidiSystem(mockTimelineRef, mockScrollOffsetRef, mockLessonMeta, mockPausedRef, mockSettings)
        );

        // Build up some score
        act(() => {
          global.advanceTime(60);
          mockCallbacks.onNoteOn(60, 'C4');
        });

        expect(result.current.hits).toBe(1);

        // Reset with default parameter (should reset score)
        act(() => {
          result.current.resetMidiState();
        });

        expect(result.current.hits).toBe(0);
        expect(result.current.wrongNotes).toBe(0);
        expect(result.current.misses).toBe(0);
      });

      it('should preserve score when resetMidiState is called with false', () => {
        vi.spyOn(validation, 'validateNoteOn').mockReturnValue({
          result: 'correct',
          color: 'green',
          matchedIndex: 0,
          matchData: { index: 0, startBeat: 0, durationBeats: 1 }
        });

        const { result } = renderHook(() =>
          useMidiSystem(mockTimelineRef, mockScrollOffsetRef, mockLessonMeta, mockPausedRef, mockSettings)
        );

        // Build up some score
        act(() => {
          global.advanceTime(60);
          mockCallbacks.onNoteOn(60, 'C4');
        });

        expect(result.current.hits).toBe(1);

        // Reset without resetting score
        act(() => {
          result.current.resetMidiState(false);
        });

        expect(result.current.hits).toBe(1); // Score should be preserved
      });
    });
  });
});
