
import { describe, it, expect } from 'vitest';
import { beatsToVexDuration } from '../durationConverter';

describe('beatsToVexDuration', () => {
    it('converts standard durations', () => {
        expect(beatsToVexDuration(4)).toEqual({ duration: 'w', dots: 0 });
        expect(beatsToVexDuration(2)).toEqual({ duration: 'h', dots: 0 });
        expect(beatsToVexDuration(1)).toEqual({ duration: 'q', dots: 0 });
        expect(beatsToVexDuration(0.5)).toEqual({ duration: '8', dots: 0 });
        expect(beatsToVexDuration(0.25)).toEqual({ duration: '16', dots: 0 });
    });

    it('converts dotted durations', () => {
        expect(beatsToVexDuration(3)).toEqual({ duration: 'h', dots: 1 }); // Dotted half
        expect(beatsToVexDuration(1.5)).toEqual({ duration: 'q', dots: 1 }); // Dotted quarter
        expect(beatsToVexDuration(0.75)).toEqual({ duration: '8', dots: 1 }); // Dotted eighth
        expect(beatsToVexDuration(6)).toEqual({ duration: 'w', dots: 1 }); // Dotted whole
    });

    it('handles fallback for unknown durations', () => {
        // For now, let's assume simple quantization or direct mapping
        // If it doesn't match known, default to 'q'
        // Actually, 0.33 is close to 1/3 (eighth note triplet)
        expect(beatsToVexDuration(0.33)).toEqual({
            duration: '8',
            dots: 0,
            tuplet: { actual: 3, normal: 2 }
        }); 
    });
});
