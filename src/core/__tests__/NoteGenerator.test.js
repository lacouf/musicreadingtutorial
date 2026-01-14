
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
        // Default spacing is 0.5, duration 1.0 -> 1.5 beats per note
        const timeline = generateRandomTimeline('C4', 'C4', 2);
        
        const note1 = timeline[0];
        const note2 = timeline[1];
        
        expect(note1.beat).toBe(1);
        
        // Note 1 duration = 1. Spacing = 0.5. Total = 1.5.
        // Start of note 2 = 1.5 beats.
        // Measure 1. Beat 2.5.
        // Math.floor(2.5) + 1 = 3? No.
        // Beat 1 (0.0). Beat 2 (1.0). Beat 2.5 (1.5).
        // startBeatInMeasure = 1.5.
        // beat = floor(1.5) + 1 = 2.
        // beatFraction = 0.5.
        
        expect(note2.measure).toBe(1);
        expect(note2.beat).toBe(2);
        expect(note2.beatFraction).toBe(0.5);
    });
});
