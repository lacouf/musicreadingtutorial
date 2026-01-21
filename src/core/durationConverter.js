
import { BEATS } from './constants';

export function beatsToVexDuration(beats) {
    const b = Number(beats);
    
    // Exact standard mappings
    if (Math.abs(b - 6) < 0.01) return { duration: 'w', dots: 1 };
    if (Math.abs(b - 4) < 0.01) return { duration: 'w', dots: 0 };
    if (Math.abs(b - 3) < 0.01) return { duration: 'h', dots: 1 };
    if (Math.abs(b - 2) < 0.01) return { duration: 'h', dots: 0 };
    if (Math.abs(b - 1.5) < 0.01) return { duration: 'q', dots: 1 };
    if (Math.abs(b - 1) < 0.01) return { duration: 'q', dots: 0 };
    if (Math.abs(b - 0.75) < 0.01) return { duration: '8', dots: 1 };
    if (Math.abs(b - 0.5) < 0.01) return { duration: '8', dots: 0 };
    if (Math.abs(b - 0.375) < 0.01) return { duration: '16', dots: 1 };
    if (Math.abs(b - 0.25) < 0.01) return { duration: '16', dots: 0 };
    if (Math.abs(b - 0.125) < 0.01) return { duration: '32', dots: 0 };

    // Triplets
    // 16th triplet = 1/6 beat = 0.1666...
    if (Math.abs(b - (1/6)) < 0.01) return { duration: '16', dots: 0, tuplet: { actual: 3, normal: 2 } };
    // 8th triplet = 1/3 beat = 0.333...
    if (Math.abs(b - (1/3)) < 0.01) return { duration: '8', dots: 0, tuplet: { actual: 3, normal: 2 } };
    // Quarter triplet = 2/3 beat = 0.666...
    if (Math.abs(b - (2/3)) < 0.01) return { duration: 'q', dots: 0, tuplet: { actual: 3, normal: 2 } };
    // Half triplet = 4/3 beat = 1.333...
    if (Math.abs(b - (4/3)) < 0.01) return { duration: 'h', dots: 0, tuplet: { actual: 3, normal: 2 } };

    // Fallback to closest power of 2
    if (b > 2) return { duration: 'w', dots: 0 };
    if (b > 1) return { duration: 'h', dots: 0 };
    if (b > 0.5) return { duration: 'q', dots: 0 };
    if (b > 0.25) return { duration: '8', dots: 0 };
    return { duration: '16', dots: 0 };
}
