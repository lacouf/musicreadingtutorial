// src/core/NoteGenerator.js
import { parsePitchToMidi, midiToPitch, midiToVexKey } from './musicUtils';
import { TIMING, GENERATOR } from './constants';

/**
 * Generates a random sequence of notes within a given range.
 * @param {string} minPitch - Start of range (e.g. 'C4')
 * @param {string} maxPitch - End of range (e.g. 'C5')
 * @param {number} count - Number of notes to generate
 * @param {number} tempo - Tempo in BPM (optional, default 80)
 * @param {boolean} includeSharps - Whether to include sharp/black key notes (default true)
 * @returns {Array} - Timeline of note objects
 */
export function generateRandomTimeline(minPitch, maxPitch, count = GENERATOR.DEFAULT_COUNT, tempo = GENERATOR.DEFAULT_TEMPO_BPM, includeSharps = true) {
    const minMidi = parsePitchToMidi(minPitch) ?? GENERATOR.DEFAULT_MIN_MIDI;
    const maxMidi = parsePitchToMidi(maxPitch) ?? GENERATOR.DEFAULT_MAX_MIDI;
    
    const secPerBeat = TIMING.SECONDS_IN_MINUTE / tempo;
    const timeline = [];
    let currentTime = 0;
    
    // Create pool of available midi numbers
    const pool = [];
    for (let m = minMidi; m <= maxMidi; m++) {
        if (!includeSharps) {
            const p = midiToPitch(m);
            if (p.includes('#')) continue;
        }
        pool.push(m);
    }

    if (pool.length === 0) return []; // Safety check

    for (let i = 0; i < count; i++) {
        const midi = pool[Math.floor(Math.random() * pool.length)];
        const pitch = midiToPitch(midi);
        const vfKey = midiToVexKey(midi);
        const dur = GENERATOR.DEFAULT_NOTE_DURATION_BEATS; // Fixed duration of 1 beat for practice
        
        timeline.push({
            start: currentTime,
            dur: dur * secPerBeat,
            pitch: pitch,
            midi: midi,
            vfKey: vfKey,
            key: vfKey
        });
        
        currentTime += dur * secPerBeat + (GENERATOR.DEFAULT_NOTE_SPACING_BEATS * secPerBeat); // Add some space between notes
    }
    
    return timeline;
}
