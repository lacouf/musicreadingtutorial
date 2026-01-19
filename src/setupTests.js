import '@testing-library/jest-dom';

// Mock ResizeObserver for canvas testing
class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}

window.ResizeObserver = ResizeObserver;

// Mock AudioContext for audio testing
global.AudioContext = class {
  constructor() {
    this.state = 'running';
    this.currentTime = 0;
    this.destination = {};
  }

  createOscillator() {
    const mockOscillator = {
      type: 'sine',
      frequency: { value: 440 },
      connect: function() { return this; },
      start: function() {},
      stop: function() {}
    };
    return mockOscillator;
  }

  createGain() {
    const mockGain = {
      gain: {
        value: 0,
        setValueAtTime: function() { return this; },
        linearRampToValueAtTime: function() { return this; },
        exponentialRampToValueAtTime: function() { return this; },
        cancelScheduledValues: function() { return this; }
      },
      connect: function() { return this; }
    };
    return mockGain;
  }

  resume() {
    return Promise.resolve();
  }
};

// Mock performance.now for timing tests
if (!global.performance) {
  global.performance = {
    now: () => Date.now()
  };
}

// Mock requestAnimationFrame and cancelAnimationFrame
global.requestAnimationFrame = (cb) => {
  return setTimeout(cb, 16);
};

global.cancelAnimationFrame = (id) => {
  clearTimeout(id);
};
