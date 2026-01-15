
export function calculateNoteX(measure, beat, beatFraction, pixelsPerBeat, marginLeft, beatsPerMeasure = 4) {
    // 1-based index conversion
    const totalBeats = (measure - 1) * beatsPerMeasure + (beat - 1) + beatFraction;
    return marginLeft + (totalBeats * pixelsPerBeat);
}

export function calculateScrollSpeed(bpm, pixelsPerBeat) {
    const beatsPerSecond = bpm / 60.0;
    return beatsPerSecond * pixelsPerBeat;
}
