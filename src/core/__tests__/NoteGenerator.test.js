
import { describe, it, expect } from 'vitest';
import { generateRandomTimeline } from '../NoteGenerator';

describe('NoteGenerator', () => {
    it('generates timeline with new schema fields', () => {
        const count = 5;
        const timeline = generateRandomTimeline({
            trebleRange: { min: 'C4', max: 'E4' },
            count
        });
        
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
        const timeline = generateRandomTimeline({
            trebleRange: { min: 'C4', max: 'C4' },
            count: 2
        });
        
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
        const timeline = generateRandomTimeline({
            trebleRange: { min: 'C4', max: 'C4' },
            count: 2,
            tempo: 60,
            possibleDurations: [3.0]
        });
        
        const note1 = timeline[0];
        const note2 = timeline[1];
        
        // Note 1 starts at 0, dur 3.
        expect(note1.durationBeats).toBe(3);
        
        // Note 2 starts at beat 3. Measure 1 has 1 beat left.
        expect(note2.start).toBe(3 * (60/60)); // 3 seconds at 60bpm
        expect(note2.durationBeats).toBeLessThanOrEqual(1.0);
        expect(note1.measure).toBe(1);
        expect(note2.measure).toBe(1);
    });

    it('generates for both hands and sorts correctly', () => {
        const timeline = generateRandomTimeline({
            trebleRange: { min: 'C4', max: 'C4' },
            bassRange: { min: 'C3', max: 'C3' },
            hands: ['left', 'right'],
            count: 2
        });

        // 2 notes per hand = 4 total
        expect(timeline).toHaveLength(4);

        // Check if both staffs are present
        const staffs = new Set(timeline.map(n => n.staff));
        expect(staffs.has(1)).toBe(true); // Treble
        expect(staffs.has(2)).toBe(true); // Bass

        // Check if sorted by start time
        for (let i = 0; i < timeline.length - 1; i++) {
            expect(timeline[i].start).toBeLessThanOrEqual(timeline[i+1].start);
        }
    });
});
