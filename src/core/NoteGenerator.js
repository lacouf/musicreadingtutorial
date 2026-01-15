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
 * @param {number[]} possibleDurations - Array of allowed durations in beats (default [1.0])
 * @returns {Array} - Timeline of note objects
 */
export function generateRandomTimeline(minPitch, maxPitch, count = GENERATOR.DEFAULT_COUNT, tempo = GENERATOR.DEFAULT_TEMPO_BPM, includeSharps = true, possibleDurations = [1.0]) {
    const minMidi = parsePitchToMidi(minPitch) ?? GENERATOR.DEFAULT_MIN_MIDI;
    const maxMidi = parsePitchToMidi(maxPitch) ?? GENERATOR.DEFAULT_MAX_MIDI;
    
    const secPerBeat = TIMING.SECONDS_IN_MINUTE / tempo;
    const timeline = [];
    
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

    let currentBeatAbs = 0;
    const beatsPerMeasure = 4; // Assume 4/4 for random practice

    for (let i = 0; i < count; i++) {
        const midi = pool[Math.floor(Math.random() * pool.length)];
        const pitch = midiToPitch(midi);
        const vfKey = midiToVexKey(midi);
        
        // Calculate remaining space in the current measure
        // We use a small epsilon to handle floating point precision issues
        let remainingInMeasure = beatsPerMeasure - (currentBeatAbs % beatsPerMeasure);
        if (remainingInMeasure < 0.01) remainingInMeasure = beatsPerMeasure;

        // Randomly pick a duration from the allowed set
        let durBeats = possibleDurations[Math.floor(Math.random() * possibleDurations.length)];
        
        // Ensure note doesn't cross barline:
        // Try to pick a smaller allowed duration if the current one doesn't fit
        if (durBeats > remainingInMeasure) {
            const fitOptions = possibleDurations.filter(d => d <= remainingInMeasure);
            if (fitOptions.length > 0) {
                durBeats = fitOptions[Math.floor(Math.random() * fitOptions.length)];
            } else {
                // If none of the user's selected notes fit, clamp to the measure boundary
                durBeats = remainingInMeasure;
            }
        }
        
        // Calculate measure and beat info
        // measure is 1-based
        const measure = Math.floor(currentBeatAbs / beatsPerMeasure) + 1;
        // beat is 1-based within measure
        const startBeatInMeasure = (currentBeatAbs % beatsPerMeasure);
        const beat = Math.floor(startBeatInMeasure) + 1;
        const beatFraction = startBeatInMeasure % 1;
        
        const timeSec = currentBeatAbs * secPerBeat;

        timeline.push({
            start: timeSec, // Keep for legacy
            dur: durBeats * secPerBeat, // Keep for legacy
            pitch: pitch,
            midi: midi,
            vfKey: vfKey,
            key: vfKey,
            // New fields
            timeSec: timeSec,
            durationBeats: durBeats,
            measure: measure,
            beat: beat,
            beatFraction: beatFraction
        });
        
        currentBeatAbs += durBeats + GENERATOR.DEFAULT_NOTE_SPACING_BEATS; 
    }
    
    return timeline;
}
