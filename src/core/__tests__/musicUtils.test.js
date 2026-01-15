
import { describe, it, expect } from 'vitest';
import { parsePitchToMidi, midiToPitch, midiToVexKey } from '../musicUtils';

describe('musicUtils', () => {
    describe('parsePitchToMidi', () => {
        it('parses natural notes correctly', () => {
            expect(parsePitchToMidi('C4')).toBe(60);
            expect(parsePitchToMidi('E4')).toBe(64);
            expect(parsePitchToMidi('G4')).toBe(67);
            expect(parsePitchToMidi('B4')).toBe(71);
            expect(parsePitchToMidi('C5')).toBe(72);
        });

        it('parses sharp notes correctly', () => {
            expect(parsePitchToMidi('C#4')).toBe(61);
            expect(parsePitchToMidi('F#4')).toBe(66);
            expect(parsePitchToMidi('A#4')).toBe(70);
            expect(parsePitchToMidi('G#3')).toBe(56);
        });

        it('parses flat notes correctly', () => {
            expect(parsePitchToMidi('Bb3')).toBe(58);
            expect(parsePitchToMidi('Eb4')).toBe(63);
            expect(parsePitchToMidi('Ab4')).toBe(68);
        });

        it('handles lowercase input', () => {
            expect(parsePitchToMidi('c4')).toBe(60);
            expect(parsePitchToMidi('f#4')).toBe(66);
        });

        it('handles slash notation', () => {
            expect(parsePitchToMidi('C/4')).toBe(60);
            expect(parsePitchToMidi('F#/4')).toBe(66);
        });

        it('handles edge cases and invalid input', () => {
            expect(parsePitchToMidi('')).toBeNull();
            expect(parsePitchToMidi(null)).toBeNull();
            expect(parsePitchToMidi('H4')).toBeNull();
            expect(parsePitchToMidi('C')).toBeNull();
            expect(parsePitchToMidi(60)).toBe(60); // Identity for numbers
        });
    });

    describe('midiToPitch', () => {
        it('converts midi to pitch string correctly', () => {
            expect(midiToPitch(60)).toBe('C4');
            expect(midiToPitch(61)).toBe('C#4');
            expect(midiToPitch(64)).toBe('E4');
            expect(midiToPitch(21)).toBe('A0');
        });
    });

    describe('midiToVexKey', () => {
        it('converts midi to VexFlow key format correctly', () => {
            expect(midiToVexKey(60)).toBe('c/4');
            expect(midiToVexKey(61)).toBe('c#/4');
            expect(midiToVexKey(64)).toBe('e/4');
        });
    });
});
