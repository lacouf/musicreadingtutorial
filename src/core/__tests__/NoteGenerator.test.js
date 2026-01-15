
import { describe, it, expect } from 'vitest';
import { generateRandomTimeline } from '../NoteGenerator';

describe('NoteGenerator', () => {
    it('generates timeline with new schema fields', () => {
        const count = 5;
        const timeline = generateRandomTimeline('C4', 'E4', count);
        
        expect(timeline).toHaveLength(count);
        
        const note = timeline[0];
        // Check legacy fields
        expect(note.start).toBeDefined();
        expect(note.dur).toBeDefined();
        expect(note.midi).toBeDefined();
        
        // Check new fields
        expect(note.measure).toBeGreaterThan(0);
        expect(note.beat).toBeGreaterThan(0);
        expect(note.durationBeats).toBeDefined();
        expect(note.timeSec).toBeDefined();
        expect(note.beatFraction).toBeDefined();
        
        // Check logic of first note (starts at 0)
        expect(note.start).toBe(0);
        expect(note.measure).toBe(1);
        expect(note.beat).toBe(1);
        expect(note.beatFraction).toBe(0);
    });

    it('advances beats correctly', () => {
        // Default spacing is now 0.0, duration 1.0 -> 1.0 beats per note
        const timeline = generateRandomTimeline('C4', 'C4', 2);
        
        const note1 = timeline[0];
        const note2 = timeline[1];
        
        expect(note1.beat).toBe(1);
        expect(note1.beatFraction).toBe(0);
        
        // Note 1 duration = 1. Spacing = 0.0. Total = 1.0.
        // Start of note 2 = 1.0 beats.
        // Measure 1. Beat 2.
        
        expect(note2.measure).toBe(1);
        expect(note2.beat).toBe(2);
        expect(note2.beatFraction).toBe(0);
    });

    it('respects measure boundaries', () => {
        // Force a note that would cross boundary
        // 4/4 time. Note 1: 3 beats. Note 2: 2 beats (Whole note).
        // Note 2 should be clamped to 1 beat or pick a smaller one.
        const possibleDurations = [3.0, 4.0]; 
        const timeline = generateRandomTimeline('C4', 'C4', 2, 60, true, possibleDurations);
        
        const note1 = timeline[0];
        const note2 = timeline[1];
        
        // Note 1 starts at 0, dur 3.
        expect(note1.durationBeats).toBe(3);
        
        // Note 2 starts at beat 3. Measure 1 has 1 beat left.
        // Even if 4.0 was picked, it must be <= 1.0.
        expect(note2.start).toBe(3);
        expect(note2.durationBeats).toBeLessThanOrEqual(1.0);
        expect(note1.measure).toBe(1);
        expect(note2.measure).toBe(1);
    });
});
