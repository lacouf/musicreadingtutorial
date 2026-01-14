
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

const STRICT_WINDOW_SECONDS = 0.15;

describe('MIDI Matching Regression', () => {
    const mockTimeline = [
        { start: 1.0, midi: 60, pitch: 'C4' },
        { start: 2.0, midi: 62, pitch: 'D4' },
        { start: 3.0, midi: 64, pitch: 'E4' },
    ];

    it('matches a correct note within strict window', () => {
        const playTime = 1.05; // 0.05s late
        const playedNote = 60;
        
        const candidates = findEventsInWindow(mockTimeline, playTime, 0.5);
        const exact = candidates.find(c => 
            c.ev.midi === playedNote && 
            c.d <= STRICT_WINDOW_SECONDS
        );

        expect(exact).toBeDefined();
        expect(exact.ev.pitch).toBe('C4');
    });

    it('fails to match a correct note outside strict window', () => {
        const playTime = 1.2; // 0.2s late, > 0.15s
        const playedNote = 60;
        
        const candidates = findEventsInWindow(mockTimeline, playTime, 0.5);
        const exact = candidates.find(c => 
            c.ev.midi === playedNote && 
            c.d <= STRICT_WINDOW_SECONDS
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
