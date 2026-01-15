
import { describe, it, expect } from 'vitest';
import { calculateNoteX, calculateScrollSpeed } from '../layoutUtils';

describe('Layout Utils', () => {
    const PIXELS_PER_BEAT = 100;
    const MARGIN_LEFT = 20;

    describe('calculateNoteX', () => {
        it('calculates X based on measure and beat (4/4 time)', () => {
            // Measure 1, Beat 1 -> 0 beats from start
            expect(calculateNoteX(1, 1, 0, PIXELS_PER_BEAT, MARGIN_LEFT)).toBe(MARGIN_LEFT + 0);

            // Measure 1, Beat 2 -> 1 beat from start
            expect(calculateNoteX(1, 2, 0, PIXELS_PER_BEAT, MARGIN_LEFT)).toBe(MARGIN_LEFT + 100);

            // Measure 2, Beat 1 -> 4 beats from start
            expect(calculateNoteX(2, 1, 0, PIXELS_PER_BEAT, MARGIN_LEFT)).toBe(MARGIN_LEFT + 400);

            // Measure 2, Beat 3.5 -> 4 + 2.5 = 6.5 beats from start
            expect(calculateNoteX(2, 3, 0.5, PIXELS_PER_BEAT, MARGIN_LEFT)).toBe(MARGIN_LEFT + 650);
        });

        it('handles custom time signatures (3/4)', () => {
            const beatsPerMeasure = 3;
            // Measure 2, Beat 1 -> 3 beats from start
            expect(calculateNoteX(2, 1, 0, PIXELS_PER_BEAT, MARGIN_LEFT, beatsPerMeasure)).toBe(MARGIN_LEFT + 300);
        });
    });

    describe('calculateScrollSpeed', () => {
        it('calculates correct pixel speed from BPM', () => {
            // 60 BPM = 1 beat/sec. Speed should be 100px/sec
            expect(calculateScrollSpeed(60, PIXELS_PER_BEAT)).toBe(100);

            // 120 BPM = 2 beats/sec. Speed should be 200px/sec
            expect(calculateScrollSpeed(120, PIXELS_PER_BEAT)).toBe(200);

            // 30 BPM = 0.5 beats/sec. Speed should be 50px/sec
            expect(calculateScrollSpeed(30, PIXELS_PER_BEAT)).toBe(50);
        });
    });
});
