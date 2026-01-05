// src/core/musicUtils.js

export const NOTES_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

export const STRICT_WINDOW_SECONDS = 0.10;

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
    return (octave + 1) * 12 + stepIndex;
}

export function midiToPitch(midi) {
    if (midi == null || !Number.isInteger(midi)) return null;
    const name = NOTES_NAMES[midi % 12];
    const octave = Math.floor(midi / 12) - 1;
    return `${name}${octave}`;
}

export function midiToVexKey(midi) {
    if (midi == null || !Number.isInteger(midi)) return null;
    const name = NOTES_NAMES[midi % 12].toLowerCase();
    const octave = Math.floor(midi / 12) - 1;
    return `${name}/${octave}`;
}
