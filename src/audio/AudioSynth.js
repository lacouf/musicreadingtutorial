// src/audio/AudioSynth.js
// Simple piano-like synthesizer using Web Audio API

class AudioSynth {
    constructor() {
        this.audioContext = null;
        this.activeNotes = new Map(); // Track playing notes by MIDI number
        this.masterGain = null;
    }

    // Initialize audio context (must be called after user interaction)
    init() {
        if (this.audioContext) return;

        this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
        this.masterGain = this.audioContext.createGain();
        this.masterGain.gain.value = 0.3; // Master volume
        this.masterGain.connect(this.audioContext.destination);
    }

    // Convert MIDI note number to frequency (Hz)
    midiToFrequency(midiNote) {
        // A4 (MIDI 69) = 440 Hz
        return 440 * Math.pow(2, (midiNote - 69) / 12);
    }

    // Play a note with piano-like envelope
    playNote(midiNote, velocity = 100) {
        if (!this.audioContext) {
            this.init();
        }

        // Resume audio context if suspended (browser autoplay policy)
        if (this.audioContext.state === 'suspended') {
            this.audioContext.resume();
        }

        // Stop existing note if already playing
        this.stopNote(midiNote);

        const frequency = this.midiToFrequency(midiNote);
        const now = this.audioContext.currentTime;
        const velocityScale = velocity / 127;

        // Create oscillator (main tone)
        const oscillator = this.audioContext.createOscillator();
        oscillator.type = 'triangle'; // Triangle wave sounds more mellow than sine
        oscillator.frequency.value = frequency;

        // Add a subtle second harmonic for richness
        const oscillator2 = this.audioContext.createOscillator();
        oscillator2.type = 'sine';
        oscillator2.frequency.value = frequency * 2;

        // Create gain nodes for envelope
        const gainNode = this.audioContext.createGain();
        const gainNode2 = this.audioContext.createGain();

        // Piano-like ADSR envelope
        // Attack: quick rise
        gainNode.gain.setValueAtTime(0, now);
        gainNode.gain.linearRampToValueAtTime(0.5 * velocityScale, now + 0.01);
        // Decay: gradual fall
        gainNode.gain.exponentialRampToValueAtTime(0.3 * velocityScale, now + 0.1);
        // Sustain: held level
        gainNode.gain.exponentialRampToValueAtTime(0.2 * velocityScale, now + 0.3);

        // Second harmonic is quieter
        gainNode2.gain.setValueAtTime(0, now);
        gainNode2.gain.linearRampToValueAtTime(0.15 * velocityScale, now + 0.01);
        gainNode2.gain.exponentialRampToValueAtTime(0.05 * velocityScale, now + 0.2);

        // Connect audio graph
        oscillator.connect(gainNode);
        oscillator2.connect(gainNode2);
        gainNode.connect(this.masterGain);
        gainNode2.connect(this.masterGain);

        // Start oscillators
        oscillator.start(now);
        oscillator2.start(now);

        // Store references for stopping later
        this.activeNotes.set(midiNote, {
            oscillator,
            oscillator2,
            gainNode,
            gainNode2
        });
    }

    // Stop a playing note with release envelope
    stopNote(midiNote) {
        if (!this.activeNotes.has(midiNote)) return;

        const { oscillator, oscillator2, gainNode, gainNode2 } = this.activeNotes.get(midiNote);
        const now = this.audioContext.currentTime;
        const releaseTime = 0.3; // Release duration in seconds

        // Fade out (release)
        gainNode.gain.cancelScheduledValues(now);
        gainNode.gain.setValueAtTime(gainNode.gain.value, now);
        gainNode.gain.exponentialRampToValueAtTime(0.001, now + releaseTime);

        gainNode2.gain.cancelScheduledValues(now);
        gainNode2.gain.setValueAtTime(gainNode2.gain.value, now);
        gainNode2.gain.exponentialRampToValueAtTime(0.001, now + releaseTime);

        // Stop oscillators after release
        oscillator.stop(now + releaseTime);
        oscillator2.stop(now + releaseTime);

        // Clean up
        this.activeNotes.delete(midiNote);
    }

    // Stop all notes
    stopAll() {
        const notes = Array.from(this.activeNotes.keys());
        notes.forEach(note => this.stopNote(note));
    }

    // Set master volume (0.0 to 1.0)
    setVolume(volume) {
        if (this.masterGain) {
            this.masterGain.gain.value = Math.max(0, Math.min(1, volume));
        }
    }
}

// Export singleton instance
export const audioSynth = new AudioSynth();
