
import { describe, it, expect } from 'vitest';

// Duplicating the logic from App.jsx to ensure it works before/after refactor
function findEventsInWindow(timeline, timeSec, windowSec = 0.45) {
    const out = [];
    for (let i = 0; i < timeline.length; i++) {
        const ev = timeline[i];
        const t = ev.start || 0;
        const d = Math.abs(t - timeSec);
        if (d <= windowSec) out.push({ ev, d, index: i });
    }
    out.sort((a, b) => a.d - b.d);
    return out;
}

const STRICT_BEAT_TOLERANCE = 0.2;
const SECONDS_IN_MINUTE = 60.0;

describe('MIDI Matching Regression', () => {
    const mockTimeline = [
        { start: 1.0, midi: 60, pitch: 'C4' },
        { start: 2.0, midi: 62, pitch: 'D4' },
        { start: 3.0, midi: 64, pitch: 'E4' },
    ];

    it('matches a correct note within strict beat window', () => {
        const tempo = 60; // 1 beat = 1 second
        const secPerBeat = SECONDS_IN_MINUTE / tempo;
        const strictWindowSec = STRICT_BEAT_TOLERANCE * secPerBeat; // 0.2s

        const playTime = 1.1; // 0.1s late (within 0.2s)
        const playedNote = 60;
        
        const candidates = findEventsInWindow(mockTimeline, playTime, 0.5);
        const exact = candidates.find(c => 
            c.ev.midi === playedNote && 
            c.d <= strictWindowSec
        );

        expect(exact).toBeDefined();
    });

    it('fails to match a correct note outside strict beat window', () => {
        const tempo = 120; // 1 beat = 0.5 second
        const secPerBeat = SECONDS_IN_MINUTE / tempo;
        const strictWindowSec = STRICT_BEAT_TOLERANCE * secPerBeat; // 0.1s

        const playTime = 0.65; // Expected 0.5 (for some note). 
        // Let's use our mockTimeline where note 1 is at 1.0s.
        // At 120 BPM, note 1 at 1.0s is beat 2.
        // Tolerance is 0.1s. 
        // 1.15s is 0.15s late, which is > 0.1s.
        
        const playTimeLate = 1.15;
        const playedNote = 60;
        
        const candidates = findEventsInWindow(mockTimeline, playTimeLate, 0.5);
        const exact = candidates.find(c => 
            c.ev.midi === playedNote && 
            c.d <= strictWindowSec
        );

        expect(exact).toBeUndefined();
    });

    it('fails to match a wrong note', () => {
        const playTime = 1.0;
        const playedNote = 61; // Wrong note
        
        const candidates = findEventsInWindow(mockTimeline, playTime, 0.5);
        const exact = candidates.find(c => 
            c.ev.midi === playedNote && 
            c.d <= STRICT_WINDOW_SECONDS
        );

        expect(exact).toBeUndefined();
    });
});
