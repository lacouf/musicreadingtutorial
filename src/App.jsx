/*
Music Tutorial - Minimal React Skeleton
File: music-tutorial-starter.jsx
*/

import React, { useEffect, useRef, useState } from 'react';
import ScrollingCanvas from './components/ScrollingCanvas';
import { renderScoreToCanvas } from './components/ScoreRenderer';
import { initializeMidi } from './midi/MidiInput';
import { exampleJSONLesson, exampleMusicXML, parseTimeline } from './parser/TimeLineParser';
import LogDisplay from './components/LogDisplay';
import LessonDisplay from './components/LessonDisplay';
import { checkNoteAtPlayhead as checkNote } from './core/validation';

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
        const timeline = parseTimeline(
            useJson ? 'json' : 'musicxml',
            useJson ? exampleJSONLesson : exampleMusicXML,
            exampleJSONLesson.tempo
        );
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
                const validationResult = checkNote(pitch, timelineRef.current, scrollOffset, pixelsPerSecond);
                setLog(l => [...l, validationResult.message]);
                if (validationResult.color) {
                    flashPlayhead(validationResult.color);
                }
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

            <LessonDisplay jsonLesson={exampleJSONLesson} musicXmlLesson={exampleMusicXML} />
            <LogDisplay log={log} />

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
