// src/core/NoteGenerator.js
import { parsePitchToMidi, midiToPitch, midiToVexKey } from './musicUtils';
import { TIMING, GENERATOR } from './constants';

/**
 * Generates a random sequence of notes within given ranges for multiple hands.
 * @param {Object} options - Generation options
 * @param {Object} options.trebleRange - { min, max } pitch for right hand
 * @param {Object} options.bassRange - { min, max } pitch for left hand
 * @param {string[]} options.hands - Array of hands to generate for ('left', 'right')
 * @param {number} options.count - Number of notes to generate per hand
 * @param {number} options.tempo - Tempo in BPM
 * @param {boolean} options.includeSharps - Whether to include sharp/black key notes
 * @param {number[]} options.possibleDurations - Array of allowed durations in beats
 * @returns {Array} - Combined timeline of note objects
 */
export function generateRandomTimeline({
    trebleRange = { min: 'C4', max: 'G4' },
    bassRange = { min: 'C3', max: 'G3' },
    hands = ['right'],
    count = GENERATOR.DEFAULT_COUNT,
    tempo = GENERATOR.DEFAULT_TEMPO_BPM,
    includeSharps = true,
    possibleDurations = [1.0]
}) {
    const secPerBeat = TIMING.SECONDS_IN_MINUTE / tempo;
    const combinedTimeline = [];

    hands.forEach(hand => {
        const isLeft = hand === 'left';
        const range = isLeft ? bassRange : trebleRange;
        const minMidi = parsePitchToMidi(range.min) ?? (isLeft ? 48 : 60); // Default C3 or C4
        const maxMidi = parsePitchToMidi(range.max) ?? (isLeft ? 55 : 67); // Default G3 or G4
        
        // Create pool of available midi numbers for this hand
        const pool = [];
        for (let m = minMidi; m <= maxMidi; m++) {
            if (!includeSharps) {
                const p = midiToPitch(m);
                if (p.includes('#')) continue;
            }
            pool.push(m);
        }

        if (pool.length === 0) return;

        let currentBeatAbs = 0;
        const beatsPerMeasure = 4;

        for (let i = 0; i < count; i++) {
            const midi = pool[Math.floor(Math.random() * pool.length)];
            const pitch = midiToPitch(midi);
            const vfKey = midiToVexKey(midi);
            
            let remainingInMeasure = beatsPerMeasure - (currentBeatAbs % beatsPerMeasure);
            if (remainingInMeasure < 0.01) remainingInMeasure = beatsPerMeasure;

            let durBeats = possibleDurations[Math.floor(Math.random() * possibleDurations.length)];
            
            if (durBeats > remainingInMeasure) {
                const fitOptions = possibleDurations.filter(d => d <= remainingInMeasure);
                if (fitOptions.length > 0) {
                    durBeats = fitOptions[Math.floor(Math.random() * fitOptions.length)];
                } else {
                    durBeats = remainingInMeasure;
                }
            }
            
            const measure = Math.floor(currentBeatAbs / beatsPerMeasure) + 1;
            const startBeatInMeasure = (currentBeatAbs % beatsPerMeasure);
            const beat = Math.floor(startBeatInMeasure) + 1;
            const beatFraction = startBeatInMeasure % 1;
            
            const timeSec = currentBeatAbs * secPerBeat;

            combinedTimeline.push({
                start: timeSec,
                dur: durBeats * secPerBeat,
                pitch: pitch,
                midi: midi,
                vfKey: vfKey,
                key: vfKey,
                timeSec: timeSec,
                durationBeats: durBeats,
                measure: measure,
                beat: beat,
                beatFraction: beatFraction,
                staff: isLeft ? 2 : 1 // 1 = treble, 2 = bass
            });
            
            currentBeatAbs += durBeats + GENERATOR.DEFAULT_NOTE_SPACING_BEATS; 
        }
    });
    
    // Sort the combined timeline by start time
    return combinedTimeline.sort((a, b) => a.start - b.start);
}
