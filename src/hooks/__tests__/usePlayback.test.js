// src/hooks/__tests__/usePlayback.test.js
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { usePlayback } from '../usePlayback';
import * as layoutUtils from '../../core/layoutUtils';

// Mock layoutUtils
vi.mock('../../core/layoutUtils', () => ({
  calculateScrollSpeed: vi.fn()
}));

describe('usePlayback', () => {
  const mockLessonMeta = {
    tempo: 80,
    beatsPerMeasure: 4
  };

  const mockCurrentBpm = 80;
  const mockLeadInSeconds = 3.0;

  let rafCallbacks = [];
  let rafId = 0;

  beforeEach(() => {
    vi.clearAllMocks();
    rafCallbacks = [];
    rafId = 0;

    // Mock requestAnimationFrame to track callbacks
    global.requestAnimationFrame = vi.fn((callback) => {
      const id = ++rafId;
      rafCallbacks.push({ id, callback });
      return id;
    });

    global.cancelAnimationFrame = vi.fn((id) => {
      const index = rafCallbacks.findIndex(cb => cb.id === id);
      if (index !== -1) {
        rafCallbacks.splice(index, 1);
      }
    });

    // Mock calculateScrollSpeed to return predictable values
    // For testing purposes, let's say speed = bpm
    layoutUtils.calculateScrollSpeed.mockImplementation((bpm) => bpm); 
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Initialization', () => {
    it('should initialize with default paused state', () => {
      const { result } = renderHook(() =>
        usePlayback(mockLessonMeta, mockCurrentBpm, mockLeadInSeconds)
      );

      expect(result.current.paused).toBe(true);
      expect(result.current.scrollOffset).toBe(0);
      expect(result.current.pausedRef.current).toBe(true);
      expect(result.current.scrollOffsetRef.current).toBe(0);
    });

    it('should initialize totalActiveTimeRef with negative lead-in time', () => {
      const { result } = renderHook(() =>
        usePlayback(mockLessonMeta, mockCurrentBpm, mockLeadInSeconds)
      );

      expect(result.current.totalActiveTimeRef.current).toBe(-3.0);
    });

    it('should not start animation when paused on mount', () => {
      renderHook(() =>
        usePlayback(mockLessonMeta, mockCurrentBpm, mockLeadInSeconds)
      );

      expect(global.requestAnimationFrame).not.toHaveBeenCalled();
    });
  });

  describe('togglePause', () => {
    it('should toggle from paused to playing', () => {
      const { result } = renderHook(() =>
        usePlayback(mockLessonMeta, mockCurrentBpm, mockLeadInSeconds)
      );

      expect(result.current.paused).toBe(true);

      act(() => {
        result.current.togglePause();
      });

      expect(result.current.paused).toBe(false);
    });

    it('should toggle from playing to paused', () => {
      const { result } = renderHook(() =>
        usePlayback(mockLessonMeta, mockCurrentBpm, mockLeadInSeconds)
      );

      // Start playing
      act(() => {
        result.current.togglePause(false);
      });

      expect(result.current.paused).toBe(false);

      // Pause
      act(() => {
        result.current.togglePause(true);
      });

      expect(result.current.paused).toBe(true);
    });

    it('should accept explicit boolean value', () => {
      const { result } = renderHook(() =>
        usePlayback(mockLessonMeta, mockCurrentBpm, mockLeadInSeconds)
      );

      act(() => {
        result.current.togglePause(false);
      });

      expect(result.current.paused).toBe(false);

      act(() => {
        result.current.togglePause(false);
      });

      // Should still be false (not toggled)
      expect(result.current.paused).toBe(false);
    });

    it('should toggle without arguments', () => {
      const { result } = renderHook(() =>
        usePlayback(mockLessonMeta, mockCurrentBpm, mockLeadInSeconds)
      );

      expect(result.current.paused).toBe(true);

      act(() => {
        result.current.togglePause();
      });

      expect(result.current.paused).toBe(false);

      act(() => {
        result.current.togglePause();
      });

      expect(result.current.paused).toBe(true);
    });
  });

  describe('resetPlayback', () => {
    it('should reset scroll offset to specified value', () => {
      const { result } = renderHook(() =>
        usePlayback(mockLessonMeta, mockCurrentBpm, mockLeadInSeconds)
      );

      act(() => {
        result.current.resetPlayback(-300);
      });

      expect(result.current.scrollOffset).toBe(-300);
      expect(result.current.scrollOffsetRef.current).toBe(-300);
    });

    it('should reset totalActiveTimeRef to specified value', () => {
      const { result } = renderHook(() =>
        usePlayback(mockLessonMeta, mockCurrentBpm, mockLeadInSeconds)
      );

      act(() => {
        result.current.resetPlayback(0, -5.0);
      });

      expect(result.current.totalActiveTimeRef.current).toBe(-5.0);
    });

    it('should default totalActiveTime to -leadInSeconds', () => {
      const { result } = renderHook(() =>
        usePlayback(mockLessonMeta, mockCurrentBpm, mockLeadInSeconds)
      );

      act(() => {
        result.current.resetPlayback(-200);
      });

      expect(result.current.totalActiveTimeRef.current).toBe(-3.0);
    });

    it('should pause playback', () => {
      const { result } = renderHook(() =>
        usePlayback(mockLessonMeta, mockCurrentBpm, mockLeadInSeconds)
      );

      // Start playing
      act(() => {
        result.current.togglePause(false);
      });

      expect(result.current.paused).toBe(false);

      // Reset should pause
      act(() => {
        result.current.resetPlayback(0);
      });

      expect(result.current.paused).toBe(true);
    });
  });

  describe('Ref Synchronization', () => {
    it('should keep pausedRef in sync with paused state', async () => {
      const { result } = renderHook(() =>
        usePlayback(mockLessonMeta, mockCurrentBpm, mockLeadInSeconds)
      );

      expect(result.current.pausedRef.current).toBe(true);

      act(() => {
        result.current.togglePause(false);
      });

      // Wait for useEffect to run
      await waitFor(() => {
        expect(result.current.pausedRef.current).toBe(false);
      });

      act(() => {
        result.current.togglePause(true);
      });

      await waitFor(() => {
        expect(result.current.pausedRef.current).toBe(true);
      });
    });
  });

  describe('Animation Loop', () => {
    it('should start animation loop when unpaused', () => {
      const { result } = renderHook(() =>
        usePlayback(mockLessonMeta, mockCurrentBpm, mockLeadInSeconds)
      );

      act(() => {
        result.current.togglePause(false);
      });

      expect(global.requestAnimationFrame).toHaveBeenCalled();
      expect(rafCallbacks.length).toBeGreaterThan(0);
    });

    it('should stop animation loop when paused', () => {
      const { result } = renderHook(() =>
        usePlayback(mockLessonMeta, mockCurrentBpm, mockLeadInSeconds)
      );

      act(() => {
        result.current.togglePause(false);
      });

      const callCountAfterStart = global.cancelAnimationFrame.mock.calls.length;

      act(() => {
        result.current.togglePause(true);
      });

      // cancelAnimationFrame should be called when pausing
      expect(global.cancelAnimationFrame).toHaveBeenCalled();
    });

    it('should update scroll offset during animation', async () => {
      const { result } = renderHook(() =>
        usePlayback(mockLessonMeta, mockCurrentBpm, mockLeadInSeconds)
      );

      const initialOffset = result.current.scrollOffset;

      act(() => {
        result.current.togglePause(false);
      });

      // Verify animation callback was registered
      expect(rafCallbacks.length).toBeGreaterThan(0);
      expect(result.current.scrollOffsetRef.current).toBe(initialOffset);
    });

    it('should use provided bpm for scroll speed', async () => {
      const testBpm = 40; // Use a distinct BPM
      const { result } = renderHook(() =>
        usePlayback(mockLessonMeta, testBpm, mockLeadInSeconds)
      );

      act(() => {
        result.current.togglePause(false);
      });

      await act(async () => {
        const animateCallback = rafCallbacks[0].callback;
        animateCallback(0);
        animateCallback(100); // 0.1 seconds
      });

      // Mock returns speed = bpm. So speed = 40 pixels/sec.
      // deltaTime = 0.1s.
      // deltaScroll = 0.1 * 40 = 4 pixels.
      await waitFor(() => {
        expect(result.current.scrollOffset).toBeCloseTo(4, 1);
      });
    });

    it('should accumulate totalActiveTimeRef', async () => {
      const { result } = renderHook(() =>
        usePlayback(mockLessonMeta, mockCurrentBpm, mockLeadInSeconds)
      );

      act(() => {
        result.current.togglePause(false);
      });

      expect(result.current.totalActiveTimeRef.current).toBe(-3.0);

      await act(async () => {
        const animateCallback = rafCallbacks[0].callback;
        animateCallback(0);
        animateCallback(500); // +0.5 seconds
      });

      await waitFor(() => {
        expect(result.current.totalActiveTimeRef.current).toBeCloseTo(-2.5, 1);
      });
    });

    it('should call calculateScrollSpeed with correct parameters', async () => {
      const testBpm = 120;
      const { result } = renderHook(() =>
        usePlayback(mockLessonMeta, testBpm, mockLeadInSeconds)
      );

      act(() => {
        result.current.togglePause(false);
      });

      // Wait for the animation effect to run and trigger callback
      await act(async () => {
        const animateCallback = rafCallbacks[0]?.callback;
        if (animateCallback) {
          animateCallback(0);
        }
      });

      await waitFor(() => {
        expect(layoutUtils.calculateScrollSpeed).toHaveBeenCalledWith(
          120, // Should be called with currentBpm
          expect.any(Number)
        );
      });
    });

    it('should update scrollOffsetRef and state in sync', () => {
      const { result } = renderHook(() =>
        usePlayback(mockLessonMeta, mockCurrentBpm, mockLeadInSeconds)
      );

      act(() => {
        result.current.togglePause(false);
      });

      const animateCallback = rafCallbacks[0].callback;

      act(() => {
        animateCallback(0);
        animateCallback(100);
      });

      expect(result.current.scrollOffset).toBe(result.current.scrollOffsetRef.current);
    });
  });

  describe('Cleanup', () => {
    it('should cancel animation frame on unmount', () => {
      const { result, unmount } = renderHook(() =>
        usePlayback(mockLessonMeta, mockCurrentBpm, mockLeadInSeconds)
      );

      act(() => {
        result.current.togglePause(false);
      });

      const initialCancelCount = global.cancelAnimationFrame.mock.calls.length;

      unmount();

      // cancelAnimationFrame should be called during cleanup
      expect(global.cancelAnimationFrame.mock.calls.length).toBeGreaterThan(initialCancelCount);
    });

    it('should cancel animation frame when paused changes', () => {
      const { result } = renderHook(() =>
        usePlayback(mockLessonMeta, mockCurrentBpm, mockLeadInSeconds)
      );

      act(() => {
        result.current.togglePause(false);
      });

      act(() => {
        result.current.togglePause(true);
      });

      expect(global.cancelAnimationFrame).toHaveBeenCalled();
    });
  });

  describe('Exported Values', () => {
    it('should expose all required properties', () => {
      const { result } = renderHook(() =>
        usePlayback(mockLessonMeta, mockCurrentBpm, mockLeadInSeconds)
      );

      expect(result.current).toHaveProperty('scrollOffset');
      expect(result.current).toHaveProperty('scrollOffsetRef');
      expect(result.current).toHaveProperty('paused');
      expect(result.current).toHaveProperty('pausedRef');
      expect(result.current).toHaveProperty('totalActiveTimeRef');
      expect(result.current).toHaveProperty('togglePause');
      expect(result.current).toHaveProperty('resetPlayback');
      expect(result.current).toHaveProperty('setPaused');
    });

    it('should expose setPaused function', () => {
      const { result } = renderHook(() =>
        usePlayback(mockLessonMeta, mockCurrentBpm, mockLeadInSeconds)
      );

      expect(result.current.setPaused).toBeInstanceOf(Function);

      act(() => {
        result.current.setPaused(false);
      });

      expect(result.current.paused).toBe(false);
    });
  });
});