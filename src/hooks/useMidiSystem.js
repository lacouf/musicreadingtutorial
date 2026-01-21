import { useState, useRef, useEffect } from 'react';
import { initializeMidi } from '../midi/MidiInput';
import { audioSynth } from '../audio/AudioSynth';
import { TIMING, RENDERING } from '../core/constants';
import { validateNoteOn, validateNoteOff } from '../core/validation';

export function useMidiSystem(timelineRef, scrollOffsetRef, lessonMeta, pausedRef, settings) {
    const [midiSupported, setMidiSupported] = useState(false);
    const [log, setLog] = useState([]);
    
    // Visual Feedback State
    const [playheadFlash, setPlayheadFlash] = useState(null);
    const [pulseActive, setPulseActive] = useState(false);
    const [pulseColor, setPulseColor] = useState('red');
    const [pulseMidi, setPulseMidi] = useState(null);

    // Scoring State
    const [hits, setHits] = useState(0);
    const [wrongNotes, setWrongNotes] = useState(0);
    const [misses, setMisses] = useState(0);
    const [activeNotes, setActiveNotes] = useState([]);

    // Logic State Refs
    const validatedNotesRef = useRef(new Map());
    const hitIndicesRef = useRef(new Set()); // Notes that were hit correctly
    const attemptedIndicesRef = useRef(new Set()); // ALL notes attempted (hit or wrong)
    const missedIndicesRef = useRef(new Set()); // Notes that scrolled past without attempt
    const recentMidiEventsRef = useRef(new Map());
    const activeMatchesRef = useRef(new Map()); // midi -> { index, startBeat, durationBeats }

    const { beatTolerance, validateNoteLength } = settings;

    function flashPlayhead(color, midi = null) {
        setPlayheadFlash(color);
        setPulseColor(color || 'red');
        setPulseMidi(midi);
        setPulseActive(true);
        window.setTimeout(() => {
            setPlayheadFlash(null);
            setPulseActive(false);
            // We don't clear pulseMidi immediately to avoid it jumping back during fade out
        }, 220);
    }

    function cleanupValidatedNotes(currentTime) {
        const expiryTime = 2000;
        for (const [index, timestamp] of validatedNotesRef.current.entries()) {
            if (currentTime - timestamp > expiryTime) validatedNotesRef.current.delete(index);
        }
    }

    /**
     * Passive Miss Watchdog
     * Scans the timeline for notes that have scrolled past without being attempted.
     * Uses WIDE_BEAT_TOLERANCE to account for the full validation window.
     */
    useEffect(() => {
        const checkMisses = () => {
            if (pausedRef.current || !timelineRef.current) return;

            const currentBeat = scrollOffsetRef.current / RENDERING.PIXELS_PER_BEAT;
            // Use the wide tolerance window plus an EXTRA LARGE safety buffer
            // This ensures notes are only marked as missed AFTER the validation window has completely passed
            // The buffer accounts for: validation window (0.5) + processing delay + user reaction time + safety margin
            // Must be large enough to prevent race conditions between watchdog checks and MIDI events
            const MISS_THRESHOLD_BEATS = TIMING.WIDE_BEAT_TOLERANCE + 5.0; // 0.5 + 5.0 = 5.5 beats total

            timelineRef.current.forEach((ev, index) => {
                const noteStart = ev.start || 0;

                // Only process notes that are past the validation window + safety buffer
                if (currentBeat > noteStart + MISS_THRESHOLD_BEATS) {
                    // Check if this note was attempted (correctly or incorrectly)
                    if (attemptedIndicesRef.current.has(index)) return;
                    if (missedIndicesRef.current.has(index)) return;
                    // Also check if it was recently validated (race condition protection)
                    if (validatedNotesRef.current.has(index)) return;

                    // This note was never attempted - mark as missed
                    setMisses(m => m + 1);
                    missedIndicesRef.current.add(index);
                    setLog(l => [...l, `❌ Missed: ${ev.pitch || ev.midi} (at beat ${currentBeat.toFixed(2)})`]);
                }
            });
        };

        const intervalId = window.setInterval(checkMisses, 200);
        return () => window.clearInterval(intervalId);
    }, [timelineRef, scrollOffsetRef, pausedRef]);

    // Main MIDI Effect
    useEffect(() => {
        const cleanupMidi = initializeMidi({
            onNoteOn: (pitch, note) => {
                const now = performance.now();
                
                // Track active notes for display
                setActiveNotes(prev => {
                    if (prev.find(n => n.note === note)) return prev;
                    const next = [...prev, { pitch, note }];
                    // Keep them sorted by MIDI note number
                    return next.sort((a, b) => a.note - b.note);
                });

                // Debounce
                const lastEventTime = recentMidiEventsRef.current.get(note);
                if (lastEventTime && (now - lastEventTime) < 50) return;
                recentMidiEventsRef.current.set(note, now);
                
                audioSynth.playNote(note);
                setLog(l => [...l, `noteOn ${pitch} (${note})`]);
                
                if (pausedRef.current) return;

                const currentBeat = scrollOffsetRef.current / RENDERING.PIXELS_PER_BEAT;
                cleanupValidatedNotes(now);

                const validation = validateNoteOn({
                    note,
                    currentBeat,
                    tempo: lessonMeta.tempo,
                    timeline: timelineRef.current,
                    validatedNotes: validatedNotesRef.current,
                    beatTolerance,
                    now
                });

                if (validation.message) setLog(l => [...l, validation.message]);
                if (validation.color) flashPlayhead(validation.color, validation.targetMidi);

                if (validation.result === 'correct') {
                    // Correct hit - increment hits and mark as attempted
                    setHits(h => h + 1);
                    hitIndicesRef.current.add(validation.matchedIndex);
                    attemptedIndicesRef.current.add(validation.matchedIndex);
                    validatedNotesRef.current.set(validation.matchedIndex, now);
                    activeMatchesRef.current.set(note, validation.matchData);
                } else if (validation.result === 'wrong') {
                    // Wrong note (wrong pitch, too early, too late) - increment wrong notes
                    setWrongNotes(w => w + 1);
                    // Mark the expected note as attempted so it doesn't count as missed
                    if (validation.nearestIndex !== undefined) {
                        attemptedIndicesRef.current.add(validation.nearestIndex);
                    }
                } else if (validation.result === 'extra') {
                    // Extra note (no expected note nearby) - increment wrong notes
                    setWrongNotes(w => w + 1);
                }
            },
            onNoteOff: (pitch, note) => {
                setActiveNotes(prev => prev.filter(n => n.note !== note));
                audioSynth.stopNote(note);
                setLog(l => [...l, `noteOff ${pitch} (${note})`]);

                if (pausedRef.current) return;

                const currentBeat = scrollOffsetRef.current / RENDERING.PIXELS_PER_BEAT;
                const releaseValidation = validateNoteOff({
                    note,
                    currentBeat,
                    activeMatch: activeMatchesRef.current.get(note),
                    validateNoteLength
                });

                if (releaseValidation && releaseValidation.message) {
                    setLog(l => [...l, releaseValidation.message]);
                }

                activeMatchesRef.current.delete(note);
            },
            onLog: (message) => setLog(l => [...l, message]),
            onReady: (isReady) => setMidiSupported(isReady)
        });

        return () => {
            cleanupMidi();
        };
    }, [lessonMeta, beatTolerance, validateNoteLength]); 
    // Added dependency on beatTolerance and validateNoteLength as they are used in closures.
    // Note: scrollOffsetRef, timelineRef, pausedRef are refs, so they don't need to be dependencies, 
    // but lessonMeta is an object/state.

    const resetMidiState = (resetScore = true) => {
        if (resetScore) {
            setHits(0);
            setWrongNotes(0);
            setMisses(0);
            hitIndicesRef.current.clear();
            attemptedIndicesRef.current.clear();
            missedIndicesRef.current.clear();
        }
        setActiveNotes([]);
        validatedNotesRef.current.clear();
        recentMidiEventsRef.current.clear();
        activeMatchesRef.current.clear();
    };

    return {
        midiSupported,
        log,
        setLog,
        playheadFlash,
        pulseActive,
        pulseColor,
        pulseMidi,
        hits,
        wrongNotes,
        misses,
        activeNotes,
        resetMidiState
    };
}
