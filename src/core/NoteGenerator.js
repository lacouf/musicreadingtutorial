// src/core/NoteGenerator.js
import { parsePitchToMidi, midiToPitch, midiToVexKey } from './musicUtils';

/**
 * Generates a random sequence of notes within a given range.
 * @param {string} minPitch - Start of range (e.g. 'C4')
 * @param {string} maxPitch - End of range (e.g. 'C5')
 * @param {number} count - Number of notes to generate
 * @param {number} tempo - Tempo in BPM (optional, default 80)
 * @param {boolean} includeSharps - Whether to include sharp/black key notes (default true)
 * @returns {Array} - Timeline of note objects
 */
export function generateRandomTimeline(minPitch, maxPitch, count = 20, tempo = 80, includeSharps = true) {
    const minMidi = parsePitchToMidi(minPitch) ?? 60;
    const maxMidi = parsePitchToMidi(maxPitch) ?? 72;
    
    const secPerBeat = 60.0 / tempo;
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
        const dur = 1.0; // Fixed duration of 1 beat for practice
        
        timeline.push({
            start: currentTime,
            dur: dur * secPerBeat,
            pitch: pitch,
            midi: midi,
            vfKey: vfKey,
            key: vfKey
        });
        
        currentTime += dur * secPerBeat + 0.5; // Add some space between notes
    }
    
    return timeline;
}
