import { useState, useRef, useEffect } from 'react';
import { initializeMidi } from '../midi/MidiInput';
import { audioSynth } from '../audio/AudioSynth';
import { TIMING, RENDERING } from '../core/constants';

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

    // Helper to find events near the playhead
    function findEventsInWindow(timeSec, windowSec = 0.45) {
        const out = [];
        // timelineRef.current might be updated by useTimeline, so we access .current
        if (!timelineRef.current) return [];
        
        for (let i = 0; i < timelineRef.current.length; i++) {
            const ev = timelineRef.current[i];
            const t = ev.start || 0;
            const d = Math.abs(t - timeSec);
            if (d <= windowSec) out.push({ ev, d, index: i });
        }
        out.sort((a, b) => a.d - b.d);
        return out;
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

                // Validation Logic
                const currentBeat = scrollOffsetRef.current / RENDERING.PIXELS_PER_BEAT;
                const secPerBeat = TIMING.SECONDS_IN_MINUTE / lessonMeta.tempo;
                const playTime = currentBeat * secPerBeat;
                const windowSec = TIMING.WIDE_BEAT_TOLERANCE * secPerBeat;
                const strictWindowSec = beatTolerance * secPerBeat;

                cleanupValidatedNotes(now);
                const allCandidates = findEventsInWindow(playTime, windowSec);
                const revalidationWindow = 500; 
                
                const candidates = allCandidates.filter(c => {
                    const lastValidated = validatedNotesRef.current.get(c.index);
                    return !lastValidated || (now - lastValidated) > revalidationWindow;
                });

                if (candidates.length === 0) {
                    setLog(l => [...l, `❌ Extra/Misplaced: played ${note} at ${currentBeat.toFixed(2)}b`]);
                    flashPlayhead('red');
                    return;
                }

                const exact = candidates.find(c => Number.isInteger(c.ev.midi) && c.ev.midi === note && c.d <= strictWindowSec);
                if (exact) {
                    validatedNotesRef.current.set(exact.index, now);
                    activeMatchesRef.current.set(note, { 
                        index: exact.index, 
                        startBeat: currentBeat, 
                        durationBeats: exact.ev.durationBeats 
                    });
                    
                    const key = exact.ev.vfKey || exact.ev.pitch || `midi:${exact.ev.midi}`;
                    const diffBeats = exact.d / secPerBeat;
                    setLog(l => [...l, `✅ Correct: ${key} (dt=${diffBeats.toFixed(2)} beats)`]);
                    flashPlayhead('green');
                } else {
                    const nearest = candidates[0];
                    const expectedKey = nearest.ev.vfKey || nearest.ev.pitch || `midi:${nearest.ev.midi}`;
                    const diffBeats = nearest.d / secPerBeat;
                    setLog(l => [...l, `❌ Wrong: played ${note}, expected ${expectedKey} (dt=${diffBeats.toFixed(2)} beats)`]);
                    flashPlayhead('red');
                }
            },
            onNoteOff: (pitch, note) => {
                audioSynth.stopNote(note);
                setLog(l => [...l, `noteOff ${pitch} (${note})`]);

                if (pausedRef.current) return;

                const match = activeMatchesRef.current.get(note);
                if (match && validateNoteLength) {
                    const currentBeat = scrollOffsetRef.current / RENDERING.PIXELS_PER_BEAT;
                    const heldBeats = currentBeat - match.startBeat;
                    const expected = match.durationBeats;
                    
                    const tolerance = Math.max(0.2, expected * 0.2);
                    const diff = Math.abs(heldBeats - expected);

                    if (diff <= tolerance) {
                        setLog(l => [...l, `✨ Perfect Release! Held ${heldBeats.toFixed(2)}b (target ${expected}b)`]);
                    } else if (heldBeats < expected) {
                        setLog(l => [...l, `⚠️ Released Early: Held ${heldBeats.toFixed(2)}b (target ${expected}b)`]);
                    } else {
                        setLog(l => [...l, `⚠️ Held Too Long: Held ${heldBeats.toFixed(2)}b (target ${expected}b)`]);
                    }
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
