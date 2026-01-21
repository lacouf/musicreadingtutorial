// src/core/validation.js
import { TIMING } from './constants';

/**
 * Finds events in the timeline that fall within a specific time window.
 * @param {Array} timeline - The music timeline.
 * @param {number} timeSec - The current playback time in seconds.
 * @param {number} windowSec - The tolerance window in seconds.
 * @returns {Array} List of candidate events with their distance from the target time.
 */
export function findEventsInWindow(timeline, timeSec, windowSec = 0.45) {
    if (!timeline) return [];
    
    const out = [];
    for (let i = 0; i < timeline.length; i++) {
        const ev = timeline[i];
        const t = ev.start || 0;
        const d = Math.abs(t - timeSec);
        if (d <= windowSec) out.push({ ev, d, index: i });
    }
    out.sort((a, b) => a.d - b.d);
    return out;
}

/**
 * Validates a MIDI "Note On" event against the timeline.
 * @returns {Object} Validation result { result, message, color, matchedIndex, matchData }
 */
export function validateNoteOn({
    note,
    currentBeat,
    tempo,
    timeline,
    validatedNotes, // Map of index -> timestamp
    beatTolerance = 0.1,
    revalidationWindow = 500,
    now = Date.now()
}) {
    const secPerBeat = TIMING.SECONDS_IN_MINUTE / tempo;
    const playTime = currentBeat * secPerBeat;
    const windowSec = TIMING.WIDE_BEAT_TOLERANCE * secPerBeat;
    const strictWindowSec = beatTolerance * secPerBeat;

    const allCandidates = findEventsInWindow(timeline, playTime, windowSec);
    
    // Filter out recently validated notes to prevent double-triggering
    const candidates = allCandidates.filter(c => {
        const lastValidated = validatedNotes.get(c.index);
        return !lastValidated || (now - lastValidated) > revalidationWindow;
    });

    if (candidates.length === 0) {
        return {
            result: 'extra',
            message: `❌ Extra/Misplaced: played ${note} at ${currentBeat.toFixed(2)}b`,
            color: 'red',
            targetMidi: note
        };
    }

    const exact = candidates.find(c => 
        Number.isInteger(c.ev.midi) && 
        c.ev.midi === note && 
        c.d <= strictWindowSec
    );

    if (exact) {
        const key = exact.ev.vfKey || exact.ev.pitch || `midi:${exact.ev.midi}`;
        const diffBeats = exact.d / secPerBeat;
        return {
            result: 'correct',
            message: `✅ Correct: ${key} (dt=${diffBeats.toFixed(2)} beats)`,
            color: 'green',
            matchedIndex: exact.index,
            targetMidi: exact.ev.midi,
            matchData: {
                index: exact.index,
                startBeat: currentBeat,
                durationBeats: exact.ev.durationBeats
            }
        };
    } else {
        const nearest = candidates[0];
        const expectedKey = nearest.ev.vfKey || nearest.ev.pitch || `midi:${nearest.ev.midi}`;
        const diffBeats = nearest.d / secPerBeat;
        return {
            result: 'wrong',
            message: `❌ Wrong: played ${note}, expected ${expectedKey} (dt=${diffBeats.toFixed(2)} beats)`,
            color: 'red',
            nearestIndex: nearest.index,
            targetMidi: note
        };
    }
}

/**
 * Validates a MIDI "Note Off" event (release timing).
 * @returns {Object} Release validation result
 */
export function validateNoteOff({
    note,
    currentBeat,
    activeMatch, // { index, startBeat, durationBeats }
    validateNoteLength = false
}) {
    if (!activeMatch || !validateNoteLength) return null;

    const heldBeats = currentBeat - activeMatch.startBeat;
    const expected = activeMatch.durationBeats;
    
    // Tolerance for release: 0.2 beats or 20% of note length, whichever is larger
    const tolerance = Math.max(0.2, expected * 0.2);
    const diff = Math.abs(heldBeats - expected);

    if (diff <= tolerance) {
        return {
            result: 'perfect_release',
            message: `✨ Perfect Release! Held ${heldBeats.toFixed(2)}b (target ${expected}b)`
        };
    } else if (heldBeats < expected) {
        return {
            result: 'early_release',
            message: `⚠️ Released Early: Held ${heldBeats.toFixed(2)}b (target ${expected}b)`
        };
    } else {
        return {
            result: 'late_release',
            message: `⚠️ Held Too Long: Held ${heldBeats.toFixed(2)}b (target ${expected}b)`
        };
    }
}