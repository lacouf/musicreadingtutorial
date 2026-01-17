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

    // Logic State Refs
    const validatedNotesRef = useRef(new Map());
    const recentMidiEventsRef = useRef(new Map());
    const activeMatchesRef = useRef(new Map()); // midi -> { index, startBeat, durationBeats }

    const { beatTolerance, validateNoteLength } = settings;

    function flashPlayhead(color) {
        setPlayheadFlash(color);
        setPulseColor(color || 'red');
        setPulseActive(true);
        window.setTimeout(() => {
            setPlayheadFlash(null);
            setPulseActive(false);
        }, 220);
    }

    function cleanupValidatedNotes(currentTime) {
        const expiryTime = 2000; 
        for (const [index, timestamp] of validatedNotesRef.current.entries()) {
            if (currentTime - timestamp > expiryTime) validatedNotesRef.current.delete(index);
        }
    }

    // Main MIDI Effect
    useEffect(() => {
        const cleanupMidi = initializeMidi({
            onNoteOn: (pitch, note) => {
                const now = performance.now();
                
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
                if (validation.color) flashPlayhead(validation.color);

                if (validation.result === 'correct') {
                    validatedNotesRef.current.set(validation.matchedIndex, now);
                    activeMatchesRef.current.set(note, validation.matchData);
                }
            },
            onNoteOff: (pitch, note) => {
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

    const resetMidiState = () => {
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
        resetMidiState
    };
}
