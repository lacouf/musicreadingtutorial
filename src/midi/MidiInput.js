// src/midi/MidiInput.js
import { midiToPitch } from '../core/musicUtils';

export function initializeMidi({ onNoteOn, onNoteOff, onLog, onReady }) {
    if (!navigator.requestMIDIAccess) {
        onLog('Web MIDI not supported in this browser.');
        return () => {};
    }

    let midiAccess = null;

    const onMIDIMessage = (msg) => {
        const [status, note, velocity] = msg.data;
        const kind = status & 0xf0;
        const pitch = midiToPitch(note);

        if (kind === 144 && velocity > 0) {
            onNoteOn(pitch, note);
        } else if (kind === 128 || (kind === 144 && velocity === 0)) {
            onNoteOff(pitch, note);
        }
    };

    const onStateChange = (e) => {
        onLog(`MIDI device ${e.port.name} ${e.port.state}`);
    };

    navigator.requestMIDIAccess()
        .then(access => {
            midiAccess = access;
            onReady(true);
            onLog('MIDI ready.');

            for (let input of midiAccess.inputs.values()) {
                input.onmidimessage = onMIDIMessage;
            }

            midiAccess.onstatechange = onStateChange;
        })
        .catch(err => {
            onReady(false);
            onLog('MIDI error: ' + err.message);
        });

    // Return a cleanup function
    return () => {
        if (midiAccess) {
            midiAccess.onstatechange = null;
            for (let input of midiAccess.inputs.values()) {
                input.onmidimessage = null;
            }
        }
    };
}
