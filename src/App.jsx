// javascript
// File: `src/App.jsx`
import React, { useEffect, useRef, useState } from 'react';
import ScrollingCanvas from './components/ScrollingCanvas';
import { renderScoreToCanvases } from './components/ScoreRenderer';
import { initializeMidi } from './midi/MidiInput';
import { exampleJSONLesson, exampleMusicXML, parseTimeline } from './parser/TimeLineParser';
import LogDisplay from './components/LogDisplay';
import LessonDisplay from './components/LessonDisplay';
import { checkNoteAtPlayhead as checkNote } from './core/validation';
import { audioSynth } from './audio/AudioSynth';

export default function App() {
    const stavesRef = useRef(null);
    const notesRef = useRef(null);
    const [midiSupported, setMidiSupported] = useState(false);
    const timelineRef = useRef([]);
    const [log, setLog] = useState([]);
    const [scrollOffset, setScrollOffset] = useState(0);
    const [playheadFlash, setPlayheadFlash] = useState(null);
    const [paused, setPaused] = useState(true);

    // pulse state for expanded visual feedback
    const [pulseActive, setPulseActive] = useState(false);
    const [pulseColor, setPulseColor] = useState('red');

    const animationFrameId = useRef(null);
    const lastFrameTimeRef = useRef(0);
    const totalActiveTimeRef = useRef(0);
    const scrollOffsetRef = useRef(0);

    const playheadX = 300;
    const viewportWidth = 800;
    const viewportHeight = 220;
    const pixelsPerSecond = 120;

    // tempoFactor: 1 = original speed; >1 slows playback (notes take longer to reach playhead)
    const [tempoFactor, setTempoFactor] = useState(1.6);

    function parsePitchToMidi(pitchStr) {
        if (typeof pitchStr === 'number' && Number.isFinite(pitchStr)) return pitchStr;
        if (!pitchStr || typeof pitchStr !== 'string') return null;
        const s = pitchStr.replace('/', '').toUpperCase();
        const m = s.match(/^([A-G])(#?)(-?\d+)$/);
        if (!m) return null;
        const step = m[1] + (m[2] || '');
        const octave = parseInt(m[3], 10);
        const map = { C: 0, 'C#': 1, D: 2, 'D#': 3, E: 4, F: 5, 'F#': 6, G: 7, 'G#': 8, A: 9, 'A#': 10, B: 11 };
        const off = map[step];
        if (off === undefined) return null;
        return (octave + 1) * 12 + off;
    }

    function midiToVexKey(midi) {
        if (!Number.isInteger(midi)) return null;
        const names = ['c','c#','d','d#','e','f','f#','g','g#','a','a#','b'];
        const name = names[midi % 12];
        const octave = Math.floor(midi / 12) - 1;
        return `${name}/${octave}`;
    }

    useEffect(() => {
        stavesRef.current = document.createElement('canvas');
        notesRef.current = document.createElement('canvas');

        const useJson = true;

        const rawTimeline = parseTimeline(
            useJson ? 'json' : 'musicxml',
            useJson ? exampleJSONLesson : exampleMusicXML,
            exampleJSONLesson.tempo
        );

        // normalize and annotate timeline events with midi and a canonical VexFlow key
        const normalizedTimeline = rawTimeline.map(ev => {
            // try many possible sources for pitch
            const pitchSource = ev.midi ?? ev.pitch ?? ev.key ?? ev.note ?? ev.name ?? ev.vfKey ?? (Array.isArray(ev.keys) ? ev.keys[0] : '') ;
            // prefer any existing numeric midi, otherwise parse known pitch strings
            let midi = (typeof pitchSource === 'number' && Number.isFinite(pitchSource)) ? Math.trunc(pitchSource) : parsePitchToMidi(String(pitchSource || ''));
            // if still null and there is a vfKey like 'c/4', try parsing that too
            if (midi == null && ev.vfKey) {
                midi = parsePitchToMidi(String(ev.vfKey));
            }
            const vfKey = midi ? midiToVexKey(midi) : (ev.vfKey || (Array.isArray(ev.keys) ? ev.keys[0] : null));
            // ensure renderer sees a canonical pitch/key and keep midi available
            const canonicalPitch = vfKey || (ev.pitch || ev.key || null);
            return { ...ev, midi: midi ?? null, vfKey: vfKey ?? null, pitch: canonicalPitch, key: canonicalPitch };
        });

        timelineRef.current = normalizedTimeline;

        // debug: log mapping so you can check expected midi numbers
        setLog(l => [...l, 'Timeline mapped: ' + normalizedTimeline.map(e => `${(e.start||0).toFixed(2)}s -> ${e.midi ?? '??'} (${e.vfKey ?? '??'})`).join(', ')]);

        // render offscreen canvases
        renderScoreToCanvases(stavesRef.current, notesRef.current, normalizedTimeline, { viewportWidth, viewportHeight, pixelsPerSecond, playheadX })
            .then(() => setLog(l => [...l, 'Rendered offscreen score']))
            .catch(e => setLog(l => [...l, 'Render error: ' + e.message]));

        // find all timeline events within a time window, sorted by distance
        function findEventsInWindow(timeSec, windowSec = 0.45) {
            const out = [];
            for (const ev of timelineRef.current) {
                const t = ev.start || 0;
                const d = Math.abs(t - timeSec);
                if (d <= windowSec) out.push({ ev, d });
            }
            out.sort((a, b) => a.d - b.d);
            return out;
        }

        const cleanupMidi = initializeMidi({
            onNoteOn: (pitch, note) => {
                // Play audio tone
                audioSynth.playNote(note);

                // numeric `note` is the MIDI note number from the device
                setLog(l => [...l, `noteOn ${pitch} (${note})`]);

                const playTime = scrollOffsetRef.current / pixelsPerSecond;
                const windowSec = 0.45;

                const candidates = findEventsInWindow(playTime, windowSec);
                if (candidates.length === 0) {
                    setLog(l => [...l, `No expected note near t=${playTime.toFixed(2)}s`]);
                    const validationResult = checkNote(note, timelineRef.current, scrollOffsetRef.current, pixelsPerSecond);
                    setLog(l => [...l, validationResult.message]);
                    if (validationResult.color) flashPlayhead(validationResult.color);
                    return;
                }

                const exact = candidates.find(c => Number.isInteger(c.ev.midi) && c.ev.midi === note);
                if (exact) {
                    const key = exact.ev.vfKey || exact.ev.pitch || `midi:${exact.ev.midi}`;
                    setLog(l => [...l, `✅ Correct: played ${note} matched ${key} dt=${exact.d.toFixed(2)}s`]);
                    flashPlayhead('green');
                } else {
                    const nearest = candidates[0];
                    const expectedKey = nearest.ev.vfKey || nearest.ev.pitch || `midi:${nearest.ev.midi}`;
                    setLog(l => [...l, `❌ Wrong: played ${note}, expected ${expectedKey} (midi=${nearest.ev.midi}) dt=${nearest.d.toFixed(2)}s`]);
                    flashPlayhead('red');
                }
            },
            onNoteOff: (pitch, note) => {
                // Stop audio tone
                audioSynth.stopNote(note);

                setLog(l => [...l, `noteOff ${pitch} (${note})`]);
            },
            onLog: (message) => {
                setLog(l => [...l, message]);
            },
            onReady: (isReady) => {
                setMidiSupported(isReady);
            }
        });

        const handleKeyDown = (e) => {
            if (e.code === 'Space') {
                e.preventDefault();
                togglePause();
            }
        };

        window.addEventListener('keydown', handleKeyDown);

        return () => {
            cancelAnimationFrame(animationFrameId.current);
            cleanupMidi();
            window.removeEventListener('keydown', handleKeyDown);
        };
    }, []); // initial setup only

    useEffect(() => {
        if (paused) {
            cancelAnimationFrame(animationFrameId.current);
            lastFrameTimeRef.current = 0;
            return;
        }

        const animate = (timestamp) => {
            if (!lastFrameTimeRef.current) {
                lastFrameTimeRef.current = timestamp;
            }

            const deltaTime = (timestamp - lastFrameTimeRef.current) / 1000;
            totalActiveTimeRef.current += deltaTime;
            lastFrameTimeRef.current = timestamp;

            // tempoFactor slows playback: larger tempoFactor => slower scrolling (longer to reach playhead)
            const newScrollOffset = totalActiveTimeRef.current * pixelsPerSecond / tempoFactor;
            scrollOffsetRef.current = newScrollOffset;
            setScrollOffset(newScrollOffset);

            animationFrameId.current = requestAnimationFrame(animate);
        };

        animationFrameId.current = requestAnimationFrame(animate);

        return () => {
            cancelAnimationFrame(animationFrameId.current);
        };
    }, [paused, pixelsPerSecond, tempoFactor]); // include tempoFactor so changes apply immediately

    // improved flash: also trigger a brief expanding pulse overlay for better visual feedback
    function flashPlayhead(color) {
        // existing small color flash (kept for compatibility)
        setPlayheadFlash(color);
        // pulse overlay
        setPulseColor(color || 'red');
        setPulseActive(true);
        // clear both states after short time
        window.setTimeout(() => {
            setPlayheadFlash(null);
            setPulseActive(false);
        }, 220);
    }

    const togglePause = () => {
        setPaused(prev => !prev);
    };

    // overlay sizing for the pulse visual
    const overlayWidth = 120;
    const circleSize = 18;

    return (
        <div style={{ fontFamily: 'sans-serif', padding: 12 }}>
            <h2>Music Tutorial — Minimal Starter</h2>
            <p>Open this page in Chrome. Connect a MIDI keyboard (USB). The score scrolls left; play notes at the red playhead.</p>

            <div style={{ border: '1px solid #ccc', width: viewportWidth, height: viewportHeight, overflow: 'hidden', position: 'relative' }}>
                <ScrollingCanvas
                    stavesCanvas={stavesRef.current}
                    notesCanvas={notesRef.current}
                    viewportWidth={viewportWidth}
                    viewportHeight={viewportHeight}
                    scrollOffset={scrollOffset}
                    playheadX={playheadX}
                    playheadFlash={playheadFlash}
                />

                {/* pulse overlay centered on the playhead - purely visual (pointer-events: none) */}
                <div
                    aria-hidden
                    style={{
                        position: 'absolute',
                        left: Math.max(0, playheadX - overlayWidth / 2),
                        top: 0,
                        width: overlayWidth,
                        height: viewportHeight,
                        pointerEvents: 'none',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                    }}
                >
                    <div
                        style={{
                            width: circleSize,
                            height: circleSize,
                            borderRadius: '50%',
                            background: pulseActive ? pulseColor : 'transparent',
                            transform: pulseActive ? 'scale(2.6)' : 'scale(1)',
                            opacity: pulseActive ? 0.85 : 0,
                            transition: 'transform 200ms cubic-bezier(.2,.9,.2,1), opacity 220ms ease-out',
                            boxShadow: pulseActive ? `0 0 24px ${pulseColor}` : 'none'
                        }}
                    />
                </div>
            </div>

            <div style={{ marginTop: 8 }}>
                <strong>MIDI supported:</strong> {midiSupported ? 'Yes' : 'No or not yet initialized'}
            </div>

            <div style={{ marginTop: 10 }}>
                <button onClick={togglePause} style={{ padding: '8px 16px', cursor: 'pointer' }}>
                    {paused ? 'Resume Scrolling' : 'Pause Scrolling'}
                </button>

                {/* simple tempo control: increase tempoFactor to slow playback */}
                <label style={{ marginLeft: 12 }}>
                    Tempo scale:
                    <input
                        type="range"
                        min="0.5"
                        max="3.0"
                        step="0.1"
                        value={tempoFactor}
                        onChange={(e) => setTempoFactor(Number(e.target.value))}
                        style={{ marginLeft: 8, verticalAlign: 'middle' }}
                    />
                    <span style={{ marginLeft: 8 }}>{tempoFactor.toFixed(1)}x</span>
                </label>

                {/* volume control */}
                <label style={{ marginLeft: 12 }}>
                    Volume:
                    <input
                        type="range"
                        min="0"
                        max="1"
                        step="0.05"
                        defaultValue="0.3"
                        onChange={(e) => audioSynth.setVolume(Number(e.target.value))}
                        style={{ marginLeft: 8, verticalAlign: 'middle' }}
                    />
                </label>
            </div>

            <LessonDisplay jsonLesson={exampleJSONLesson} musicXmlLesson={exampleMusicXML} />
            <LogDisplay log={log} />

            <div style={{ marginTop: 12 }}>
                <h4>Next steps (suggested)</h4>
                <ol>
                    <li>Map MusicXML durations and beaming precisely to VexFlow note durations.</li>
                    <li>Implement precise timing: map score beat \-\> px so tempo changes affect speed correctly.</li>
                    <li>Improve timeline-event matching with quantization and per-note windows.</li>
                    <li>Add UI to select MIDI input device and tempo control.</li>
                    <li>Support multi-voice scores and right/left-hand highlighting.</li>
                </ol>
            </div>
        </div>
    );
}
