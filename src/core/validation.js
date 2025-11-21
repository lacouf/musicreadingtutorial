// src/core/validation.js

export function checkNoteAtPlayhead(pitch, timeline, scrollOffset, pixelsPerSecond) {
    const currentTime = scrollOffset / pixelsPerSecond;
    const tolerance = 0.3; // seconds
    const hits = timeline.filter(n => Math.abs(n.start - currentTime) <= tolerance);

    if (hits.length === 0) {
        return {
            result: 'no_note',
            message: `No expected note near t=${currentTime.toFixed(2)}s`
        };
    }

    const matched = hits.find(h => h.pitch === pitch);
    if (matched) {
        return {
            result: 'correct',
            message: `✅ Correct: ${pitch} at t=${matched.start.toFixed(2)}s`,
            color: 'green'
        };
    } else {
        return {
            result: 'wrong',
            message: `❌ Wrong: played ${pitch}, expected ${hits.map(h => h.pitch).join(',')}`,
            color: 'orange'
        };
    }
}
