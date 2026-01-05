// src/core/musicUtils.js

import { MIDI, TIMING } from './constants';

export const NOTES_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

export const STRICT_WINDOW_SECONDS = TIMING.STRICT_WINDOW_SECONDS;

export function parsePitchToMidi(pitchStr) {
    if (typeof pitchStr === 'number' && Number.isFinite(pitchStr)) return Math.trunc(pitchStr);
    if (!pitchStr || typeof pitchStr !== 'string') return null;
    
    // Support both C4 and C/4 formats
    const s = pitchStr.replace('/', '').toUpperCase();
    const m = s.match(/^([A-G]#?)(-?\d+)$/);
    if (!m) return null;
    
    const step = m[1];
    const octave = parseInt(m[2], 10);
    const stepIndex = NOTES_NAMES.indexOf(step);
    
    if (stepIndex === -1) return null;
    return (octave + MIDI.OCTAVE_OFFSET) * MIDI.OCTAVE_SIZE + stepIndex;
}

export function midiToPitch(midi) {
    if (midi == null || !Number.isInteger(midi)) return null;
    const name = NOTES_NAMES[midi % MIDI.OCTAVE_SIZE];
    const octave = Math.floor(midi / MIDI.OCTAVE_SIZE) - MIDI.OCTAVE_OFFSET;
    return `${name}${octave}`;
}

export function midiToVexKey(midi) {
    if (midi == null || !Number.isInteger(midi)) return null;
    const name = NOTES_NAMES[midi % MIDI.OCTAVE_SIZE].toLowerCase();
    const octave = Math.floor(midi / MIDI.OCTAVE_SIZE) - MIDI.OCTAVE_OFFSET;
    return `${name}/${octave}`;
}
