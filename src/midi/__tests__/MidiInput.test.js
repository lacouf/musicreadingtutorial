// src/midi/__tests__/MidiInput.test.js
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { initializeMidi } from '../MidiInput';

describe('MidiInput', () => {
  let mockCallbacks;
  let mockMIDIAccess;
  let mockInput;

  beforeEach(() => {
    // Setup mock callbacks
    mockCallbacks = {
      onNoteOn: vi.fn(),
      onNoteOff: vi.fn(),
      onLog: vi.fn(),
      onReady: vi.fn()
    };

    // Setup mock MIDI input device
    mockInput = {
      onmidimessage: null,
      name: 'Test MIDI Device'
    };

    // Setup mock MIDI access object
    mockMIDIAccess = {
      inputs: new Map([['input1', mockInput]]),
      onstatechange: null
    };

    // Mock navigator.requestMIDIAccess
    global.navigator.requestMIDIAccess = vi.fn(() =>
      Promise.resolve(mockMIDIAccess)
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Browser Support', () => {
    it('should detect when Web MIDI is not supported', () => {
      // Remove requestMIDIAccess to simulate unsupported browser
      delete global.navigator.requestMIDIAccess;

      const cleanup = initializeMidi(mockCallbacks);

      expect(mockCallbacks.onLog).toHaveBeenCalledWith(
        'Web MIDI not supported in this browser.'
      );
      expect(cleanup).toBeInstanceOf(Function);
    });

    it('should return no-op cleanup function when not supported', () => {
      delete global.navigator.requestMIDIAccess;

      const cleanup = initializeMidi(mockCallbacks);

      // Should not throw when called
      expect(() => cleanup()).not.toThrow();
    });
  });

  describe('Successful Initialization', () => {
    it('should initialize MIDI successfully', async () => {
      initializeMidi(mockCallbacks);

      // Wait for Promise to resolve
      await vi.waitFor(() => {
        expect(mockCallbacks.onReady).toHaveBeenCalledWith(true);
      });

      expect(mockCallbacks.onLog).toHaveBeenCalledWith('MIDI ready.');
      expect(mockInput.onmidimessage).not.toBeNull();
      expect(mockMIDIAccess.onstatechange).not.toBeNull();
    });

    it('should register message handler for all inputs', async () => {
      // Add multiple inputs
      const mockInput2 = { onmidimessage: null, name: 'Test Device 2' };
      mockMIDIAccess.inputs.set('input2', mockInput2);

      initializeMidi(mockCallbacks);

      await vi.waitFor(() => {
        expect(mockInput.onmidimessage).not.toBeNull();
        expect(mockInput2.onmidimessage).not.toBeNull();
      });
    });
  });

  describe('MIDI Message Parsing', () => {
    beforeEach(async () => {
      initializeMidi(mockCallbacks);
      // Wait for initialization
      await vi.waitFor(() => {
        expect(mockInput.onmidimessage).not.toBeNull();
      });
    });

    it('should parse Note On message correctly (status 144, velocity > 0)', () => {
      const noteOnMessage = {
        data: [144, 60, 100] // Note On, C4 (MIDI 60), velocity 100
      };

      mockInput.onmidimessage(noteOnMessage);

      expect(mockCallbacks.onNoteOn).toHaveBeenCalledWith('C4', 60);
      expect(mockCallbacks.onNoteOff).not.toHaveBeenCalled();
    });

    it('should parse Note Off message correctly (status 128)', () => {
      const noteOffMessage = {
        data: [128, 60, 64] // Note Off, C4 (MIDI 60), velocity 64
      };

      mockInput.onmidimessage(noteOffMessage);

      expect(mockCallbacks.onNoteOff).toHaveBeenCalledWith('C4', 60);
      expect(mockCallbacks.onNoteOn).not.toHaveBeenCalled();
    });

    it('should treat Note On with velocity 0 as Note Off (MIDI standard)', () => {
      const noteOnVelocityZero = {
        data: [144, 60, 0] // Note On, C4, velocity 0 (= Note Off)
      };

      mockInput.onmidimessage(noteOnVelocityZero);

      expect(mockCallbacks.onNoteOff).toHaveBeenCalledWith('C4', 60);
      expect(mockCallbacks.onNoteOn).not.toHaveBeenCalled();
    });

    it('should correctly apply bitwise mask (status & 0xf0)', () => {
      // Test with status 145 (0x91) - Note On channel 2
      const noteOnChannel2 = {
        data: [145, 62, 80] // 0x91 & 0xf0 = 0x90 (144)
      };

      mockInput.onmidimessage(noteOnChannel2);

      expect(mockCallbacks.onNoteOn).toHaveBeenCalledWith('D4', 62);
    });

    it('should handle different MIDI note numbers', () => {
      // Test with A4 (MIDI 69)
      const noteOnA4 = {
        data: [144, 69, 100]
      };

      mockInput.onmidimessage(noteOnA4);

      expect(mockCallbacks.onNoteOn).toHaveBeenCalledWith('A4', 69);
    });
  });

  describe('State Change Handling', () => {
    beforeEach(async () => {
      initializeMidi(mockCallbacks);
      await vi.waitFor(() => {
        expect(mockMIDIAccess.onstatechange).not.toBeNull();
      });
    });

    it('should handle device connection', () => {
      const stateChangeEvent = {
        port: { name: 'New Device', state: 'connected' }
      };

      mockMIDIAccess.onstatechange(stateChangeEvent);

      expect(mockCallbacks.onLog).toHaveBeenCalledWith(
        'MIDI device New Device connected'
      );
    });

    it('should handle device disconnection', () => {
      const stateChangeEvent = {
        port: { name: 'Old Device', state: 'disconnected' }
      };

      mockMIDIAccess.onstatechange(stateChangeEvent);

      expect(mockCallbacks.onLog).toHaveBeenCalledWith(
        'MIDI device Old Device disconnected'
      );
    });
  });

  describe('Error Handling', () => {
    it('should handle requestMIDIAccess rejection', async () => {
      const mockError = new Error('MIDI access denied');
      global.navigator.requestMIDIAccess = vi.fn(() =>
        Promise.reject(mockError)
      );

      initializeMidi(mockCallbacks);

      await vi.waitFor(() => {
        expect(mockCallbacks.onReady).toHaveBeenCalledWith(false);
      });

      expect(mockCallbacks.onLog).toHaveBeenCalledWith(
        'MIDI error: MIDI access denied'
      );
    });

    it('should handle errors gracefully without crashing', async () => {
      global.navigator.requestMIDIAccess = vi.fn(() =>
        Promise.reject(new Error('Permission denied'))
      );

      expect(() => initializeMidi(mockCallbacks)).not.toThrow();

      await vi.waitFor(() => {
        expect(mockCallbacks.onReady).toHaveBeenCalledWith(false);
      });
    });
  });

  describe('Cleanup Function', () => {
    it('should return a cleanup function', () => {
      const cleanup = initializeMidi(mockCallbacks);

      expect(cleanup).toBeInstanceOf(Function);
    });

    it('should clean up MIDI listeners when cleanup is called', async () => {
      const cleanup = initializeMidi(mockCallbacks);

      // Wait for initialization
      await vi.waitFor(() => {
        expect(mockInput.onmidimessage).not.toBeNull();
        expect(mockMIDIAccess.onstatechange).not.toBeNull();
      });

      // Call cleanup
      cleanup();

      // Verify cleanup
      expect(mockInput.onmidimessage).toBeNull();
      expect(mockMIDIAccess.onstatechange).toBeNull();
    });

    it('should handle cleanup safely when MIDI was not initialized', () => {
      // Simulate initialization failure
      global.navigator.requestMIDIAccess = vi.fn(() =>
        Promise.reject(new Error('Failed'))
      );

      const cleanup = initializeMidi(mockCallbacks);

      // Should not throw even if midiAccess is null
      expect(() => cleanup()).not.toThrow();
    });

    it('should clean up multiple inputs', async () => {
      const mockInput2 = { onmidimessage: null, name: 'Device 2' };
      mockMIDIAccess.inputs.set('input2', mockInput2);

      const cleanup = initializeMidi(mockCallbacks);

      await vi.waitFor(() => {
        expect(mockInput.onmidimessage).not.toBeNull();
        expect(mockInput2.onmidimessage).not.toBeNull();
      });

      cleanup();

      expect(mockInput.onmidimessage).toBeNull();
      expect(mockInput2.onmidimessage).toBeNull();
    });
  });
});
