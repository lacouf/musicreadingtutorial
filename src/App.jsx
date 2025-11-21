/*
Music Tutorial - Minimal React Skeleton
File: music-tutorial-starter.jsx
*/

import React, { useEffect, useRef, useState } from 'react';
import ScrollingCanvas from './components/ScrollingCanvas';
import { renderScoreToCanvases } from './components/ScoreRenderer';
import { initializeMidi } from './midi/MidiInput';
import { exampleJSONLesson, exampleMusicXML, parseTimeline } from './parser/TimeLineParser';
import LogDisplay from './components/LogDisplay';
import LessonDisplay from './components/LessonDisplay';
import { checkNoteAtPlayhead as checkNote } from './core/validation';

// ---------------------- React App ----------------------
export default function App() {
    const stavesRef = useRef(null);
    const notesRef = useRef(null);
    const [midiSupported, setMidiSupported] = useState(false);
    const timelineRef = useRef([]);
    const [log, setLog] = useState([]);
    const [scrollOffset, setScrollOffset] = useState(0);
    const [playheadFlash, setPlayheadFlash] = useState(null);
    const [paused, setPaused] = useState(true); // Start in paused state

    const animationFrameId = useRef(null);
    const lastFrameTimeRef = useRef(0);
    const totalActiveTimeRef = useRef(0);
    const scrollOffsetRef = useRef(0); // Ref to hold the current scroll offset for callbacks

    const playheadX = 300;
    const viewportWidth = 800;
    const viewportHeight = 220;
    const pixelsPerSecond = 120;

    useEffect(() => {
        stavesRef.current = document.createElement('canvas');
        notesRef.current = document.createElement('canvas');

        const useJson = true;
        const timeline = parseTimeline(
            useJson ? 'json' : 'musicxml',
            useJson ? exampleJSONLesson : exampleMusicXML,
            exampleJSONLesson.tempo
        );
        timelineRef.current = timeline;

        renderScoreToCanvases(stavesRef.current, notesRef.current, timeline, { viewportWidth, viewportHeight })
            .then(() => setLog(l => [...l, 'Rendered offscreen score']))
            .catch(e => setLog(l => [...l, 'Render error: ' + e.message]));

        const cleanupMidi = initializeMidi({
            onNoteOn: (pitch, note) => {
                setLog(l => [...l, `noteOn ${pitch} (${note})`]);
                // Use the ref for the current scroll offset to avoid stale state
                const validationResult = checkNote(pitch, timelineRef.current, scrollOffsetRef.current, pixelsPerSecond);
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

        const handleKeyDown = (e) => {
            if (e.code === 'Space') {
                e.preventDefault(); // Prevent default spacebar action (like scrolling)
                togglePause();
            }
        };

        window.addEventListener('keydown', handleKeyDown);

        return () => {
            cancelAnimationFrame(animationFrameId.current);
            cleanupMidi();
            window.removeEventListener('keydown', handleKeyDown);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

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

            const newScrollOffset = totalActiveTimeRef.current * pixelsPerSecond;
            scrollOffsetRef.current = newScrollOffset; // Update the ref
            setScrollOffset(newScrollOffset); // Update state to trigger re-render

            animationFrameId.current = requestAnimationFrame(animate);
        };

        animationFrameId.current = requestAnimationFrame(animate);

        return () => {
            cancelAnimationFrame(animationFrameId.current);
        };
    }, [paused, pixelsPerSecond]);

    function flashPlayhead(color) {
        setPlayheadFlash(color);
        setTimeout(() => setPlayheadFlash(null), 120);
    }

    const togglePause = () => {
        setPaused(prevPaused => !prevPaused);
    };

    return (
        <div style={{ fontFamily: 'sans-serif', padding: 12 }}>
            <h2>Music Tutorial — Minimal Starter</h2>
            <p>Open this page in Chrome. Connect a MIDI keyboard (USB). The score scrolls left; play notes at the red playhead.</p>
            <div style={{ border: '1px solid #ccc', width: viewportWidth, height: viewportHeight, overflow: 'hidden' }}>
                <ScrollingCanvas
                    stavesCanvas={stavesRef.current}
                    notesCanvas={notesRef.current}
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

            <button onClick={togglePause} style={{ marginTop: 10, padding: '8px 16px', cursor: 'pointer' }}>
                {paused ? 'Resume Scrolling' : 'Pause Scrolling'}
            </button>

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
