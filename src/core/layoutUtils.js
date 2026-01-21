import { RENDERING, MIDI } from './constants';

export function calculateNoteX(measure, beat, beatFraction, pixelsPerBeat, marginLeft, beatsPerMeasure = 4) {
    // 1-based index conversion
    const totalBeats = (measure - 1) * beatsPerMeasure + (beat - 1) + beatFraction;
    return marginLeft + (totalBeats * pixelsPerBeat);
}

export function calculateScrollSpeed(bpm, pixelsPerBeat) {
    const beatsPerSecond = bpm / 60.0;
    return beatsPerSecond * pixelsPerBeat;
}

export function calculateNoteY(midi) {
    if (midi == null) return RENDERING.TREBLE_Y + 35; // Fallback

    const isTreble = midi >= MIDI.C4_MIDI;
    const baseY = isTreble ? RENDERING.TREBLE_Y : RENDERING.BASS_Y;
    
    // Reference note: Treble top line is F5 (77), Bass top line is A3 (57)
    // Actually VexFlow standard stave has 5 lines.
    // We determined F5 is the top line of Treble Stave.
    // A3 is the top line of Bass Stave.
    const referenceMidi = isTreble ? 77 : 57;

    const getDiatonicStep = (m) => {
        const octave = Math.floor(m / 12);
        const note = m % 12;
        // Map chromatic note index (0-11) to diatonic step (0-6)
        // C=0, C#=0, D=1, D#=1, E=2, F=3, F#=3, G=4, G#=4, A=5, A#=5, B=6
        const stepMap = [0, 0, 1, 1, 2, 3, 3, 4, 4, 5, 5, 6];
        return octave * 7 + stepMap[note];
    };

    const refStep = getDiatonicStep(referenceMidi);
    const targetStep = getDiatonicStep(midi);
    
    // Each diatonic step is half a space (5px usually, if space is 10px)
    // VexFlow default spacing is 10px between lines.
    // 5 lines, 4 spaces.
    // Moving DOWN in pitch means INCREASING Y.
    // So (Ref - Target) * 5px.
    // If Target < Ref, Diff is positive, Y increases (goes down). Correct.
    
        const diff = refStep - targetStep;
    
        // Add +35 pixels to correct visual alignment (determined empirically based on user feedback)
    
        return baseY + (diff * 5) + 35; 
    
    }
    
    