
import { describe, it, expect } from 'vitest';

const timeline = [
    { start: 0.0, midi: 60 }, // C4
    { start: 5.0, midi: 60 }, // C4
    { start: 10.0, midi: 60 }, // C4
];

function findEventsInWindow(timeSec, windowSec = 0.45) {
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

describe('Validation Logic', () => {
    it('matches note at exact time', () => {
        const result = findEventsInWindow(5.0);
        expect(result).toHaveLength(1);
        expect(result[0].ev.start).toBe(5.0);
    });

    it('does not match note outside window (5.5s)', () => {
        const result = findEventsInWindow(5.5);
        expect(result).toHaveLength(0);
    });

    it('does not match note outside window (8.0s)', () => {
        const result = findEventsInWindow(8.0);
        expect(result).toHaveLength(0);
    });
});
