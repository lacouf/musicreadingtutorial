
import { describe, it, expect } from 'vitest';
import { calculateNoteX, calculateScrollSpeed, calculateNoteY } from '../layoutUtils';
import { RENDERING } from '../constants';

describe('Layout Utils', () => {
    const PIXELS_PER_BEAT = 100;
    const MARGIN_LEFT = 20;

    describe('calculateNoteY', () => {
        // RENDERING.TREBLE_Y = 80
        // RENDERING.BASS_Y = 220
        // Treble Base: F5 (77) -> Y=80
        // Bass Base: A3 (57) -> Y=220
        // Step size: 5px
        // Correction Offset: +35px

        it('calculates Y for Treble reference note (F5)', () => {
            expect(calculateNoteY(77)).toBe(RENDERING.TREBLE_Y + 35);
        });

        it('calculates Y for note below reference (E5)', () => {
            // F5(77) -> E5(76) is 1 diatonic step down
            // Y increases by 5, plus 35 offset
            expect(calculateNoteY(76)).toBe(RENDERING.TREBLE_Y + 5 + 35);
        });

        it('calculates Y for Middle C (C4) on Treble Stave', () => {
            // C4 (60) is treated as Treble
            // F5 to C4 is 10 steps down
            // Y = 80 + 50 + 35 = 165
            expect(calculateNoteY(60)).toBe(RENDERING.TREBLE_Y + 50 + 35);
        });

        it('calculates Y for Bass reference note (A3)', () => {
            expect(calculateNoteY(57)).toBe(RENDERING.BASS_Y + 35);
        });

        it('calculates Y for note above Bass reference (B3)', () => {
            // B3 (59) is Bass (< 60)
            // A3 to B3 is 1 step up
            // Y decreases by 5, plus 35 offset
            expect(calculateNoteY(59)).toBe(RENDERING.BASS_Y - 5 + 35);
        });

        it('calculates Y for C3 on Bass Stave', () => {
            // A3 (57) to C3 (48)
            // A, G, F, E, D, C -> 5 steps down
            // Y = 220 + 25 + 35 = 280
            expect(calculateNoteY(48)).toBe(RENDERING.BASS_Y + 25 + 35);
        });
        
        it('falls back to Treble Y for null', () => {
            expect(calculateNoteY(null)).toBe(RENDERING.TREBLE_Y + 35);
        });
    });

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
