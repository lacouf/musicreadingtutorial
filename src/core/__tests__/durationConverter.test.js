
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
        expect(beatsToVexDuration(3)).toEqual({ duration: 'hd', dots: 1 }); // Dotted half
        expect(beatsToVexDuration(1.5)).toEqual({ duration: 'qd', dots: 1 }); // Dotted quarter
        expect(beatsToVexDuration(0.75)).toEqual({ duration: '8d', dots: 1 }); // Dotted eighth
        expect(beatsToVexDuration(6)).toEqual({ duration: 'wd', dots: 1 }); // Dotted whole
    });

    it('handles fallback for unknown durations', () => {
        // Fallback to quarter for weird values, or maybe closest?
        // For now, let's assume simple quantization or direct mapping
        // If it doesn't match known, default to 'q'
        expect(beatsToVexDuration(0.33)).toEqual({ duration: 'q', dots: 0 }); 
    });
});
