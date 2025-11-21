/*
Music Tutorial - Minimal React Skeleton
File: music-tutorial-starter.jsx

Instructions:
1) Create a new React app (Vite recommended):
   npm create vite@latest my-music-app -- --template react
   cd my-music-app
   npm install
   npm install vexflow

2) Replace src/App.jsx with this file. Start dev server: npm run dev

What this file contains:
- Minimal React single-file app
- Offscreen VexFlow rendering of grand staff (treble + bass)
- Scrolling viewport drawn to visible canvas using requestAnimationFrame
- Web MIDI listener (works in Chrome) to receive noteOn/noteOff
- Timeline parser for a simple JSON lesson format and a tiny MusicXML parser
- Example lesson in JSON and MusicXML (strings)
- Simple matching logic: when a MIDI note is played near the playhead time, mark correct

Notes / caveats:
- This is a minimal, educational skeleton — many production details omitted (robust MusicXML support, note durations mapping, quantization, device selection UI, error handling, styling, bundling assets, polyfills for older browsers).
- VexFlow rendering is approximated (we draw measures/notes using VexFlow on an offscreen canvas). For complex scores use MusicXML to VexFlow full mapping.

Architecture (ASCII diagram):

  [Lesson Source] -> [Parser (JSON|MusicXML)] -> [Score Timeline]
                                            |          |
                                            v          v
                                  [Offscreen Renderer]  [MIDI Input (Web MIDI)]
                                            |          |
                                            v          v
                                  [Scrolling Viewport Canvas] <-- [Playhead + UI]
                                            |
                                            v
                                   [Validation / Feedback Engine]

*/

import React, { useEffect, useRef, useState } from 'react';
import { Factory, Renderer, Stave, StaveNote, Voice, Formatter } from 'vexflow';
import ScrollingCanvas from './components/ScrollingCanvas';


// ---------------------- Example lessons ----------------------
const exampleJSONLesson = {
    title: 'Simple C Major Exercise',
    tempo: 80,
    notes: [
        // start (s), duration (s), pitch in scientific pitch (e.g., C4), hand
        { start: 0.0, dur: 0.5, pitch: 'C4' },
        { start: 0.5, dur: 0.5, pitch: 'D4' },
        { start: 1.0, dur: 1.0, pitch: 'E4' },
        { start: 2.0, dur: 1.0, pitch: 'G3' },
        { start: 3.0, dur: 1.0, pitch: 'C4' }
    ]
};

const exampleMusicXML = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE score-partwise PUBLIC "-//Recordare//DTD MusicXML 3.1 Partwise//EN" "http://www.musicxml.org/dtds/partwise.dtd">
<score-partwise version="3.1">
  <part-list>
    <score-part id="P1">
      <part-name>Music</part-name>
    </score-part>
  </part-list>
  <part id="P1">
    <measure number="1">
      <attributes>
        <divisions>1</divisions>
        <key>
          <fifths>0</fifths>
        </key>
        <time>
          <beats>4</beats>
          <beat-type>4</beat-type>
        </time>
        <clef>
          <sign>G</sign>
          <line>2</line>
        </clef>
      </attributes>
      <note>
        <pitch>
          <step>C</step>
          <octave>4</octave>
        </pitch>
        <duration>1</duration>
      </note>
      <note>
        <pitch>
          <step>D</step>
          <octave>4</octave>
        </pitch>
        <duration>1</duration>
      </note>
      <note>
        <pitch>
          <step>E</step>
          <octave>4</octave>
        </pitch>
        <duration>2</duration>
      </note>
    </measure>
  </part>
</score-partwise>`;

// ---------------------- Utility functions ----------------------
function midiToPitch(midi) {
    const names = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
    const octave = Math.floor(midi / 12) - 1;
    const name = names[midi % 12];
    return `${name}${octave}`;
}

function pitchToMidi(pitch) {
    // e.g., C4 -> 60
    const match = pitch.match(/^([A-G]#?)(-?\d+)$/);
    if (!match) return null;
    const step = match[1];
    const octave = parseInt(match[2], 10);
    const map = { C: 0, 'C#': 1, D: 2, 'D#': 3, E: 4, F: 5, 'F#': 6, G: 7, 'G#': 8, A: 9, 'A#': 10, B: 11 };
    return (octave + 1) * 12 + map[step];
}

function simpleMusicXMLtoTimeline(xmlString, tempo = 60) {
    // Very small parser: extracts note pitch and duration (in beats) and generates start times in seconds.
    const parser = new DOMParser();
    const doc = parser.parseFromString(xmlString, 'application/xml');
    const notes = Array.from(doc.querySelectorAll('note'))
        .filter(n => !n.querySelector('rest'))
        .map(n => {
            const step = n.querySelector('pitch > step')?.textContent || 'C';
            const alter = n.querySelector('pitch > alter')?.textContent || null;
            const octave = n.querySelector('pitch > octave')?.textContent || '4';
            const dur = parseFloat(n.querySelector('duration')?.textContent || '1');
            const stepName = alter ? `${step}#` : step;
            return { pitch: `${stepName}${octave}`, dur }; // dur is in divisions/beats (approx)
        });

    // convert to seconds assuming divisions=1 and tempo (bpm) -> seconds per beat
    const secPerBeat = 60.0 / tempo;
    let t = 0;
    const timeline = notes.map(n => {
        const item = { start: t, dur: n.dur * secPerBeat, pitch: n.pitch };
        t += n.dur * secPerBeat;
        return item;
    });
    return timeline;
}

// ---------------------- Renderer helpers ----------------------
async function renderScoreToCanvas(offscreenCanvas, timeline, opts = {}) {
    const width = offscreenCanvas.width;
    const height = offscreenCanvas.height;

    // --- Create direct VexFlow renderer (safe for offscreen canvases) ---
    const renderer = new Renderer(offscreenCanvas, Renderer.Backends.CANVAS);
    const ctx = renderer.getContext();

    // Clear previous drawing
    ctx.clearRect(0, 0, width, height);

    // --- Basic layout ---
    const marginLeft = 20;
    const staveWidth = width - marginLeft - 20;

    const trebleY = 20;
    const bassY = 120;
    const staveGap = 80; // distance between staves

    // --- Draw staves manually ---
    const trebleStave = new Stave(marginLeft, trebleY, staveWidth);
    trebleStave.addClef("treble").addTimeSignature("4/4");
    trebleStave.setContext(ctx).draw();

    const bassStave = new Stave(marginLeft, bassY, staveWidth);
    bassStave.addClef("bass").addTimeSignature("4/4");
    bassStave.setContext(ctx).draw();

    // --- Split notes by register ---
    const trebleNotes = [];
    const bassNotes = [];

    for (const item of timeline) {
        const midi = pitchToMidi(item.pitch);
        if (midi >= 60) trebleNotes.push(item);
        else bassNotes.push(item);
    }

    // --- Convert note objects to VexFlow StaveNotes ---
    function makeVexNotes(items) {
        return items.map(n => {
            const m = n.pitch.match(/^([A-G]#?)(-?\d+)$/);
            const step = m ? m[1].toLowerCase() : 'c';
            const oct = m ? m[2] : '4';
            const dur = n.dur >= 1.5 ? "h" : "q"; // naive duration

            return new StaveNote({
                keys: [`${step}/${oct}`],
                duration: dur
            });
        });
    }

    const trebleVexNotes = makeVexNotes(trebleNotes);
    const bassVexNotes = makeVexNotes(bassNotes);

    // --- Create voices ---
    const trebleVoice = new Voice({ num_beats: 4, beat_value: 4 });
    trebleVoice.addTickables(trebleVexNotes);

    const bassVoice = new Voice({ num_beats: 4, beat_value: 4 });
    bassVoice.addTickables(bassVexNotes);

    // --- Format voices on their respective staves ---
    Formatter.FormatAndDraw(ctx, trebleStave, trebleVexNotes);
    Formatter.FormatAndDraw(ctx, bassStave, bassVexNotes);

    // --- (Optional) Connect staves with a brace/line ---
    ctx.beginPath();
    ctx.strokeStyle = "#000";
    ctx.lineWidth = 2;
    ctx.moveTo(marginLeft - 10, trebleY);
    ctx.lineTo(marginLeft - 10, bassY + 60);
    ctx.stroke();
}


// ---------------------- React App ----------------------
export default function App() {
    const visibleCanvasRef = useRef(null);
    const offscreenRef = useRef(null);
    const rafRef = useRef(null);
    const [midiSupported, setMidiSupported] = useState(false);
    const timelineRef = useRef([]);
    const [log, setLog] = useState([]);
    const playheadX = 300; // px fixed position of playhead

    // viewport config
    const viewportWidth = 800;
    const viewportHeight = 220;
    const pixelsPerSecond = 120; // scroll speed (px per second) — adjust with tempo
    const startTimeRef = useRef(null);
    const scrollOffsetRef = useRef(0);

    useEffect(() => {
        // initialize offscreen canvas
        const off = document.createElement('canvas');
        off.width = 2400; // entire score width
        off.height = viewportHeight;
        offscreenRef.current = off;

        // parse timeline from JSON example (or MusicXML)
        // For demo we combine both: JSON overrides if available
        const useJson = true;
        let timeline = [];
        if (useJson) {
            timeline = exampleJSONLesson.notes.map(n => ({ start: n.start, dur: n.dur, pitch: n.pitch }));
        } else {
            timeline = simpleMusicXMLtoTimeline(exampleMusicXML, 80);
        }
        timelineRef.current = timeline;

        // render to offscreen
        renderScoreToCanvas(off, timeline)
            .then(() => setLog(l => [...l, 'Rendered offscreen score']))
            .catch(e => setLog(l => [...l, 'Render error: ' + e.message]));


        // start animation
        startTimeRef.current = performance.now();
        scrollOffsetRef.current = 0;
        function loop(ts) {
            if (!startTimeRef.current) startTimeRef.current = ts;
            const elapsed = (ts - startTimeRef.current) / 1000; // seconds since start
            scrollOffsetRef.current = elapsed * pixelsPerSecond;
            rafRef.current = requestAnimationFrame(loop);
        }
        rafRef.current = requestAnimationFrame(loop);

        // start MIDI
        initMIDI();

        return () => {
            cancelAnimationFrame(rafRef.current);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);



    // ---------------- MIDI ----------------
    function initMIDI() {
        if (!navigator.requestMIDIAccess) {
            setLog(l => [...l, 'Web MIDI not supported']);
            return;
        }
        navigator.requestMIDIAccess().then(midi => {
            setMidiSupported(true);
            setLog(l => [...l, 'MIDI ready']);
            for (let input of midi.inputs.values()) {
                input.onmidimessage = onMIDIMessage;
            }
            midi.onstatechange = e => {
                setLog(l => [...l, `MIDI device ${e.port.name} ${e.port.state}`]);
            };
        }).catch(err => {
            setLog(l => [...l, 'MIDI error: ' + err.message]);
        });
    }

    function onMIDIMessage(msg) {
        const [status, note, velocity] = msg.data;
        const kind = status & 0xf0;
        if (kind === 144 && velocity > 0) {
            // note on
            const pitch = midiToPitch(note);
            setLog(l => [...l, `noteOn ${pitch} (${note})`]);
            checkNoteAtPlayhead(pitch);
        } else if (kind === 128 || (kind === 144 && velocity === 0)) {
            // note off
            const pitch = midiToPitch(note);
            setLog(l => [...l, `noteOff ${pitch} (${note})`]);
        }
    }

    function checkNoteAtPlayhead(pitch) {
        // Find timeline note whose expected start time corresponds to playhead position
        // Compute current time from scrollOffset
        const currentTime = scrollOffsetRef.current / pixelsPerSecond;
        // The playhead corresponds to time slightly ahead of viewport center. For simplicity, we find a note which start is within a tolerance
        const tolerance = 0.3; // seconds
        const hits = timelineRef.current.filter(n => Math.abs(n.start - currentTime) <= tolerance);
        if (hits.length === 0) {
            setLog(l => [...l, `No expected note near t=${currentTime.toFixed(2)}s`]);
            return;
        }
        // If any hit matches pitch, success
        const matched = hits.find(h => h.pitch === pitch);
        if (matched) {
            setLog(l => [...l, `✅ Correct: ${pitch} at t=${matched.start.toFixed(2)}s`]);
            flashPlayhead('green');
        } else {
            setLog(l => [...l, `❌ Wrong: played ${pitch}, expected ${hits.map(h => h.pitch).join(',')}`]);
            flashPlayhead('orange');
        }
    }

    function flashPlayhead(color) {
        const vis = visibleCanvasRef.current;
        if (!vis) return;
        const ctx = vis.getContext('2d');
        const prev = ctx.fillStyle;
        ctx.fillStyle = color;
        ctx.fillRect(playheadX - 2, 0, 4, vis.height);
        setTimeout(() => drawFrame(), 120);
    }

    // ---------------- UI ----------------
    return (
        <div style={{ fontFamily: 'sans-serif', padding: 12 }}>
            <h2>Music Tutorial — Minimal Starter</h2>
            <p>Open this page in Chrome. Connect a MIDI keyboard (USB). The score scrolls left; play notes at the red playhead.</p>
            <div style={{ border: '1px solid #ccc', width: viewportWidth, height: viewportHeight, overflow: 'hidden' }}>
                <ScrollingCanvas
                    offscreenCanvas={offscreenRef.current}
                    viewportWidth={viewportWidth}
                    viewportHeight={viewportHeight}
                    playheadX={playheadX}
                    pixelsPerSecond={pixelsPerSecond}
                />
            </div>

            <div style={{ marginTop: 8 }}>
                <strong>MIDI supported:</strong> {midiSupported ? 'Yes' : 'No or not yet initialized'}
            </div>

            <div style={{ marginTop: 10 }}>
                <details>
                    <summary>Example lesson (JSON)</summary>
                    <pre style={{ maxHeight: 200, overflow: 'auto' }}>{JSON.stringify(exampleJSONLesson, null, 2)}</pre>
                </details>
                <details>
                    <summary>Example lesson (MusicXML)</summary>
                    <pre style={{ maxHeight: 200, overflow: 'auto' }}>{exampleMusicXML}</pre>
                </details>
            </div>

            <div style={{ marginTop: 10 }}>
                <h4>Log</h4>
                <div style={{ maxHeight: 200, overflow: 'auto', background: '#fafafa', padding: 8 }}>
                    {log.map((l, i) => <div key={i}><code>{l}</code></div>)}
                </div>
            </div>

            <div style={{ marginTop: 12 }}>
                <h4>Next steps (suggested)</h4>
                <ol>
                    <li>Map MusicXML durations and beaming precisely to VexFlow note durations.</li>
                    <li>Implement precise timing: map score beat -> px so tempo changes affect speed correctly.</li>
                    <li>Improve timeline-event matching with quantization and per-note windows.</li>
                    <li>Add UI to select MIDI input device and tempo control.</li>
                    <li>Support multi-voice scores and right/left-hand highlighting.</li>
                </ol>
            </div>
        </div>
    );
}
