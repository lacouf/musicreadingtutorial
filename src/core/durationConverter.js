
import { BEATS } from './constants';

export function beatsToVexDuration(beats) {
    // Standard durations
    if (Math.abs(beats - BEATS.WHOLE) < BEATS.EPSILON) return { duration: 'w', dots: 0 };
    if (Math.abs(beats - BEATS.HALF) < BEATS.EPSILON) return { duration: 'h', dots: 0 };
    if (Math.abs(beats - BEATS.QUARTER) < BEATS.EPSILON) return { duration: 'q', dots: 0 };
    if (Math.abs(beats - BEATS.EIGHTH) < BEATS.EPSILON) return { duration: '8', dots: 0 };
    if (Math.abs(beats - BEATS.SIXTEENTH) < BEATS.EPSILON) return { duration: '16', dots: 0 };

    // Dotted durations (value * 1.5)
    if (Math.abs(beats - BEATS.DOTTED_WHOLE) < BEATS.EPSILON) return { duration: 'wd', dots: 1 };
    if (Math.abs(beats - BEATS.DOTTED_HALF) < BEATS.EPSILON) return { duration: 'hd', dots: 1 };
    if (Math.abs(beats - BEATS.DOTTED_QUARTER) < BEATS.EPSILON) return { duration: 'qd', dots: 1 };
    if (Math.abs(beats - BEATS.DOTTED_EIGHTH) < BEATS.EPSILON) return { duration: '8d', dots: 1 };
    
    // Default fallback
    return { duration: 'q', dots: 0 };
}
