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
      expect(result.current).toHaveProperty('resetMidiState');
    });
  });
});
