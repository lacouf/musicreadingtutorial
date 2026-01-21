import { describe, it, expect } from 'vitest';
import { findEventsInWindow, validateNoteOn, validateNoteOff } from '../validation';

describe('Validation Utilities', () => {
    const timeline = [
        { start: 0.0, midi: 60, pitch: 'C4', durationBeats: 1.0 },
        { start: 1.0, midi: 62, pitch: 'D4', durationBeats: 1.0 },
        { start: 2.0, midi: 64, pitch: 'E4', durationBeats: 1.0 },
    ];

    describe('findEventsInWindow', () => {
        it('finds events within the window', () => {
            const results = findEventsInWindow(timeline, 1.0, 0.1);
            expect(results).toHaveLength(1);
            expect(results[0].ev.midi).toBe(62);
        });

        it('returns multiple events if they fall in the window', () => {
            const results = findEventsInWindow(timeline, 1.5, 0.6);
            expect(results).toHaveLength(2); // D4 and E4
        });

        it('sorts events by distance from target time', () => {
            const results = findEventsInWindow(timeline, 1.2, 1.0);
            expect(results[0].ev.midi).toBe(62); // 1.0 is closer to 1.2 than 2.0 or 0.0
        });
    });

    describe('validateNoteOn', () => {
        const tempo = 60; // 1 beat = 1 second
        const validatedNotes = new Map();

        it('returns "correct" for an exact match', () => {
        const result = validateNoteOn({
            note: 60,
            currentBeat: 0,
            tempo: 60,
            timeline,
            validatedNotes: new Map()
        });
        
        expect(result.result).toBe('correct');
        expect(result.color).toBe('green');
        expect(result.targetMidi).toBe(60);
    });

        it('returns "wrong" for pitch mismatch in window', () => {
            const result = validateNoteOn({
                note: 61, // played C#4 instead of C4
                currentBeat: 0,
                tempo,
                timeline,
                validatedNotes,
                beatTolerance: 0.1
            });
            expect(result.result).toBe('wrong');
            expect(result.color).toBe('red');
            expect(result.message).toContain('expected C4');
            expect(result.targetMidi).toBe(61); // Expecting the played note (C#4)
        });

        it('returns "extra" for note played where none expected', () => {
            const result = validateNoteOn({
                note: 60,
                currentBeat: 5.0, // way outside timeline
                tempo,
                timeline,
                validatedNotes,
                beatTolerance: 0.1
            });
            expect(result.result).toBe('extra');
            expect(result.color).toBe('red');
        });

        it('prevents double-triggering using revalidationWindow', () => {
            const vNotes = new Map([[0, 1000]]);
            const result = validateNoteOn({
                note: 60,
                currentBeat: 0,
                tempo,
                timeline,
                validatedNotes: vNotes,
                beatTolerance: 0.1,
                now: 1100, // Only 100ms later
                revalidationWindow: 500
            });
            // Should ignore the note at index 0 because it was just validated
            expect(result.result).toBe('extra'); 
        });
    });

    describe('validateNoteOff', () => {
        const activeMatch = { index: 0, startBeat: 0, durationBeats: 1.0 };

        it('returns null if validation is disabled', () => {
            const result = validateNoteOff({
                note: 60,
                currentBeat: 1.0,
                activeMatch,
                validateNoteLength: false
            });
            expect(result).toBeNull();
        });

        it('returns perfect_release for correct duration', () => {
            const result = validateNoteOff({
                note: 60,
                currentBeat: 1.0,
                activeMatch,
                validateNoteLength: true
            });
            expect(result.result).toBe('perfect_release');
        });

        it('returns early_release if released too soon', () => {
            const result = validateNoteOff({
                note: 60,
                currentBeat: 0.5,
                activeMatch,
                validateNoteLength: true
            });
            expect(result.result).toBe('early_release');
        });

        it('returns late_release if held too long', () => {
            const result = validateNoteOff({
                note: 60,
                currentBeat: 2.0,
                activeMatch,
                validateNoteLength: true
            });
            expect(result.result).toBe('late_release');
        });
    });
});