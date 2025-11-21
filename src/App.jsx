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
import ScrollingCanvas from './components/ScrollingCanvas';
import { renderScoreToCanvas } from './components/ScoreRenderer';
import { initializeMidi } from './midi/MidiInput';


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

// ---------------------- React App ----------------------
export default function App() {
    const offscreenRef = useRef(null);
    const [midiSupported, setMidiSupported] = useState(false);
    const timelineRef = useRef([]);
    const [log, setLog] = useState([]);
    const [scrollOffset, setScrollOffset] = useState(0);
    const [playheadFlash, setPlayheadFlash] = useState(null);

    const playheadX = 300; // px fixed position of playhead
    const viewportWidth = 800;
    const viewportHeight = 220;
    const pixelsPerSecond = 120;

    useEffect(() => {
        const off = document.createElement('canvas');
        off.width = 2400;
        off.height = viewportHeight;
        offscreenRef.current = off;

        const useJson = true;
        const timeline = useJson
            ? exampleJSONLesson.notes.map(n => ({ start: n.start, dur: n.dur, pitch: n.pitch }))
            : simpleMusicXMLtoTimeline(exampleMusicXML, 80);
        timelineRef.current = timeline;

        renderScoreToCanvas(off, timeline)
            .then(() => setLog(l => [...l, 'Rendered offscreen score']))
            .catch(e => setLog(l => [...l, 'Render error: ' + e.message]));

        let rafId;
        const startTime = performance.now();
        function loop(ts) {
            const elapsed = (ts - startTime) / 1000;
            setScrollOffset(elapsed * pixelsPerSecond);
            rafId = requestAnimationFrame(loop);
        }
        rafId = requestAnimationFrame(loop);

        const cleanupMidi = initializeMidi({
            onNoteOn: (pitch, note) => {
                setLog(l => [...l, `noteOn ${pitch} (${note})`]);
                checkNoteAtPlayhead(pitch);
            },
            onNoteOff: (pitch, note) => {
                setLog(l => [...l, `noteOff ${pitch} (${note})`]);
            },
            onLog: (message) => {
                setLog(l => [...l, message]);
            },
            onReady: (isReady) => {
                setMidiSupported(isReady);
            }
        });

        return () => {
            cancelAnimationFrame(rafId);
            cleanupMidi();
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    function checkNoteAtPlayhead(pitch) {
        const currentTime = scrollOffset / pixelsPerSecond;
        const tolerance = 0.3; // seconds
        const hits = timelineRef.current.filter(n => Math.abs(n.start - currentTime) <= tolerance);
        if (hits.length === 0) {
            setLog(l => [...l, `No expected note near t=${currentTime.toFixed(2)}s`]);
            return;
        }
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
        setPlayheadFlash(color);
        setTimeout(() => setPlayheadFlash(null), 120);
    }

    return (
        <div style={{ fontFamily: 'sans-serif', padding: 12 }}>
            <h2>Music Tutorial — Minimal Starter</h2>
            <p>Open this page in Chrome. Connect a MIDI keyboard (USB). The score scrolls left; play notes at the red playhead.</p>
            <div style={{ border: '1px solid #ccc', width: viewportWidth, height: viewportHeight, overflow: 'hidden' }}>
                <ScrollingCanvas
                    offscreenCanvas={offscreenRef.current}
                    viewportWidth={viewportWidth}
                    viewportHeight={viewportHeight}
                    scrollOffset={scrollOffset}
                    playheadX={playheadX}
                    playheadFlash={playheadFlash}
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
