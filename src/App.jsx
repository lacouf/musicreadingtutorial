// javascript
// File: `src/App.jsx`
import React, { useEffect, useRef, useState } from 'react';
import ScrollingCanvas from './components/ScrollingCanvas';
import { renderScoreToCanvases } from './components/ScoreRenderer';
import { initializeMidi } from './midi/MidiInput';
import { exampleJSONLesson, exampleMusicXML, parseTimeline } from './parser/TimeLineParser';
import LogDisplay from './components/LogDisplay';
import LessonDisplay from './components/LessonDisplay';
import { audioSynth } from './audio/AudioSynth';
import { parsePitchToMidi, midiToVexKey } from './core/musicUtils';
import { generateRandomTimeline } from './core/NoteGenerator';
import { RENDERING, TIMING, MIDI } from './core/constants';

const PIXELS_PER_SECOND = RENDERING.PIXELS_PER_SECOND;
const DEFAULT_TEMPO = TIMING.DEFAULT_TEMPO;
const LEAD_IN_SECONDS = TIMING.LEAD_IN_SECONDS;
const STRICT_WINDOW_SECONDS = TIMING.STRICT_WINDOW_SECONDS;

export default function App() {
    const containerRef = useRef(null);
    const stavesRef = useRef(null);
    const notesRef = useRef(null);
    const [midiSupported, setMidiSupported] = useState(false);
    const timelineRef = useRef([]);
    const [log, setLog] = useState([]);
    
    // Calculate initial scroll based on lead-in and default tempo
    const initialScroll = (-LEAD_IN_SECONDS * PIXELS_PER_SECOND) / DEFAULT_TEMPO;
    
    const [scrollOffset, setScrollOffset] = useState(initialScroll);
    const [renderTrigger, setRenderTrigger] = useState(0); // Forces canvas repaint
    const [playheadFlash, setPlayheadFlash] = useState(null);
    const [paused, setPaused] = useState(true);
    const pausedRef = useRef(true); // Track paused state in ref for synchronous access

    // pulse state for expanded visual feedback
    const [pulseActive, setPulseActive] = useState(false);
    const [pulseColor, setPulseColor] = useState('red');

    const animationFrameId = useRef(null);
    const lastFrameTimeRef = useRef(0);
    const totalActiveTimeRef = useRef(-LEAD_IN_SECONDS); // Start with lead-in
    const scrollOffsetRef = useRef(initialScroll);

    // Track recently validated notes to support polyphony
    // Map: timeline event index -> timestamp when it was last validated
    const validatedNotesRef = useRef(new Map());

    // De-duplication: track recent MIDI events to prevent duplicate processing
    // Map: MIDI note number -> timestamp of last event
    const recentMidiEventsRef = useRef(new Map());

    const playheadX = RENDERING.PLAYHEAD_X;
    const [viewportWidth, setViewportWidth] = useState(RENDERING.VIEWPORT_WIDTH);
    const viewportHeight = RENDERING.VIEWPORT_HEIGHT;
    // pixelsPerSecond moved to constant PIXELS_PER_SECOND

    // tempoFactor: 1 = original speed; >1 slows playback (notes take longer to reach playhead)
    const [tempoFactor, setTempoFactor] = useState(DEFAULT_TEMPO);

    const [minNote, setMinNote] = useState('C3');
    const [maxNote, setMaxNote] = useState('C6');
    const [includeSharps, setIncludeSharps] = useState(true);
    const [showValidTiming, setShowValidTiming] = useState(true);

    const [mode, setMode] = useState('lesson'); // 'lesson' or 'practice'

    const renderCurrentTimeline = () => {
        if (!stavesRef.current || !notesRef.current || !timelineRef.current) return;
        
        const minMidi = parsePitchToMidi(minNote) ?? MIDI.MIN_MIDI;
        const maxMidi = parsePitchToMidi(maxNote) ?? MIDI.MAX_MIDI;

        renderScoreToCanvases(stavesRef.current, notesRef.current, timelineRef.current, { 
            viewportWidth, 
            viewportHeight, 
            pixelsPerSecond: PIXELS_PER_SECOND, 
            playheadX, 
            minMidi, 
            maxMidi,
            showValidTiming
        })
            .then(() => {
                setRenderTrigger(t => t + 1);
            })
            .catch(e => setLog(l => [...l, 'Render error: ' + e.message]));
    };

    const loadTimeline = () => {
        // Ensure canvases exist
        if (!stavesRef.current) stavesRef.current = document.createElement('canvas');
        if (!notesRef.current) notesRef.current = document.createElement('canvas');

        let rawTimeline;
        if (mode === 'lesson') {
            const useJson = true;
            rawTimeline = parseTimeline(
                useJson ? 'json' : 'musicxml',
                useJson ? exampleJSONLesson : exampleMusicXML,
                exampleJSONLesson.tempo
            );
        } else {
            rawTimeline = generateRandomTimeline(minNote, maxNote, 20, 80, includeSharps);
        }

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
        setLog(l => [...l, `Loaded ${mode} timeline`]);
        
        renderCurrentTimeline();
    };

    useEffect(() => {
        stavesRef.current = document.createElement('canvas');
        notesRef.current = document.createElement('canvas');

        // find all timeline events within a time window, sorted by distance
        function findEventsInWindow(timeSec, windowSec = 0.45) {
            const out = [];
            for (let i = 0; i < timelineRef.current.length; i++) {
                const ev = timelineRef.current[i];
                const t = ev.start || 0;
                const d = Math.abs(t - timeSec);
                if (d <= windowSec) out.push({ ev, d, index: i });
            }
            out.sort((a, b) => a.d - b.d);
            return out;
        }

        // Clean up old validated notes (older than 2 seconds)
        function cleanupValidatedNotes(currentTime) {
            const expiryTime = 2000; // 2 seconds in ms
            for (const [index, timestamp] of validatedNotesRef.current.entries()) {
                if (currentTime - timestamp > expiryTime) {
                    validatedNotesRef.current.delete(index);
                }
            }
        }

        const cleanupMidi = initializeMidi({
            onNoteOn: (pitch, note) => {
                const now = performance.now();

                // De-duplication: ignore duplicate MIDI events within 50ms
                const lastEventTime = recentMidiEventsRef.current.get(note);
                if (lastEventTime && (now - lastEventTime) < 50) {
                    // This is a duplicate event, ignore it
                    return;
                }
                recentMidiEventsRef.current.set(note, now);

                // Play audio tone
                audioSynth.playNote(note);

                // numeric `note` is the MIDI note number from the device
                setLog(l => [...l, `noteOn ${pitch} (${note})`]);

                // Don't validate notes when paused
                if (pausedRef.current) {
                    return; // Skip validation entirely when paused
                }

                // Only validate when not paused
                const playTime = scrollOffsetRef.current / PIXELS_PER_SECOND;
                const windowSec = 0.5; // wider window to detect misses/timing errors
                const strictWindowSec = STRICT_WINDOW_SECONDS; // strict window for success

                // Clean up old validated notes
                cleanupValidatedNotes(now);

                // Find all expected notes in the wide window
                const allCandidates = findEventsInWindow(playTime, windowSec);

                // Filter out recently validated notes (supports polyphony)
                const revalidationWindow = 500; // ms - allow same note to be validated again after this time
                const candidates = allCandidates.filter(c => {
                    const lastValidated = validatedNotesRef.current.get(c.index);
                    return !lastValidated || (now - lastValidated) > revalidationWindow;
                });

                if (candidates.length === 0) {
                    if (allCandidates.length > 0) {
                        setLog(l => [...l, `Note already played recently`]);
                    } else {
                        setLog(l => [...l, `No expected note near t=${playTime.toFixed(2)}s`]);
                    }
                    return; // Exit early, don't validate further
                }

                // Look for strict match (correct pitch AND within strict time window)
                const exact = candidates.find(c => 
                    Number.isInteger(c.ev.midi) && 
                    c.ev.midi === note && 
                    c.d <= strictWindowSec
                );

                if (exact) {
                    // Mark this note as validated
                    validatedNotesRef.current.set(exact.index, now);

                    const key = exact.ev.vfKey || exact.ev.pitch || `midi:${exact.ev.midi}`;
                    setLog(l => [...l, `✅ Correct: played ${note} matched ${key} dt=${exact.d.toFixed(2)}s`]);
                    flashPlayhead('green');
                } else {
                    // Missed strict window OR wrong pitch
                    // Show what was expected (closest candidate)
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

    // Handle window resize
    useEffect(() => {
        const handleResize = (entries) => {
            for (let entry of entries) {
                // Use contentRect.width to get the width of the container
                setViewportWidth(entry.contentRect.width);
            }
        };

        const observer = new ResizeObserver(handleResize);
        if (containerRef.current) {
            observer.observe(containerRef.current);
        }

        return () => {
            observer.disconnect();
        };
    }, []);

    // Re-load timeline when generation params change
    useEffect(() => {
        loadTimeline();
    }, [mode, minNote, maxNote, includeSharps]);

    // Re-render when display params change
    useEffect(() => {
        renderCurrentTimeline();
    }, [viewportWidth, showValidTiming]);

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
            const newScrollOffset = totalActiveTimeRef.current * PIXELS_PER_SECOND / tempoFactor;
            scrollOffsetRef.current = newScrollOffset;
            setScrollOffset(newScrollOffset);

            animationFrameId.current = requestAnimationFrame(animate);
        };

        animationFrameId.current = requestAnimationFrame(animate);

        return () => {
            cancelAnimationFrame(animationFrameId.current);
        };
    }, [paused, tempoFactor]); // include tempoFactor so changes apply immediately

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
        setPaused(prev => {
            const newPaused = !prev;
            pausedRef.current = newPaused; // Keep ref in sync

            // Clear validated notes when pausing to avoid stale state
            if (newPaused) {
                // About to pause - clear validated notes and MIDI deduplication
                validatedNotesRef.current.clear();
                recentMidiEventsRef.current.clear();
            }
            return newPaused;
        });
    };

    const restart = () => {
        // Reset to beginning with lead-in
        totalActiveTimeRef.current = -LEAD_IN_SECONDS;
        scrollOffsetRef.current = (-LEAD_IN_SECONDS * PIXELS_PER_SECOND) / tempoFactor;
        setScrollOffset(scrollOffsetRef.current);
        lastFrameTimeRef.current = 0;

        // Clear all tracking
        validatedNotesRef.current.clear();
        recentMidiEventsRef.current.clear();

        // Pause on restart
        setPaused(true);
        pausedRef.current = true; // Keep ref in sync

        setLog(l => [...l, '🔄 Restarted']);
    };

    // overlay sizing for the pulse visual
    const overlayWidth = 120;
    const circleSize = 18;

    return (
        <div style={{ fontFamily: 'sans-serif', padding: 12 }}>
            <h2>Music Tutorial — Minimal Starter</h2>
            <p>Open this page in Chrome. Connect a MIDI keyboard (USB). The score scrolls left; play notes at the red playhead.</p>

            <div 
                ref={containerRef} 
                style={{ 
                    border: '1px solid #ccc', 
                    width: viewportWidth, 
                    maxWidth: '100%', 
                    height: viewportHeight, 
                    overflow: 'hidden', 
                    position: 'relative',
                    resize: 'horizontal', 
                    minWidth: '300px'
                }}
            >
                <ScrollingCanvas
                    stavesCanvas={stavesRef.current}
                    notesCanvas={notesRef.current}
                    viewportWidth={viewportWidth}
                    viewportHeight={viewportHeight}
                    scrollOffset={scrollOffset}
                    playheadX={playheadX}
                    playheadFlash={playheadFlash}
                    renderTrigger={renderTrigger}
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
                        justifyContent: 'center',
                        zIndex: 10
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
                <div style={{ marginBottom: 8 }}>
                    <button 
                        onClick={() => setMode('lesson')} 
                        style={{ padding: '8px 16px', fontWeight: mode === 'lesson' ? 'bold' : 'normal' }}
                    >
                        Lesson Mode
                    </button>
                    <button 
                        onClick={() => setMode('practice')} 
                        style={{ padding: '8px 16px', marginLeft: 8, fontWeight: mode === 'practice' ? 'bold' : 'normal' }}
                    >
                        Random Practice Mode
                    </button>
                    {mode === 'practice' && (
                        <button 
                            onClick={() => loadTimeline()}
                            style={{ padding: '8px 16px', marginLeft: 16, backgroundColor: '#e0ffe0' }}
                        >
                            Generate New Exercise
                        </button>
                    )}
                </div>

                <label>
                    Min note:
                    <input style={{ marginLeft: 8 }} value={minNote} onChange={(e) => setMinNote(e.target.value)} />
                </label>

                <label style={{ marginLeft: 12 }}>
                    Max note:
                    <input style={{ marginLeft: 8 }} value={maxNote} onChange={(e) => setMaxNote(e.target.value)} />
                </label>

                {mode === 'practice' && (
                    <label style={{ marginLeft: 12 }}>
                        <input 
                            type="checkbox" 
                            checked={includeSharps} 
                            onChange={(e) => setIncludeSharps(e.target.checked)} 
                        />
                        <span style={{ marginLeft: 4 }}>Include Sharps (Black Keys)</span>
                    </label>
                )}

                <label style={{ marginLeft: 12 }}>
                    <input 
                        type="checkbox" 
                        checked={showValidTiming} 
                        onChange={(e) => setShowValidTiming(e.target.checked)} 
                    />
                    <span style={{ marginLeft: 4 }}>Show Valid Timing</span>
                </label>

                <button onClick={togglePause} style={{ padding: '8px 16px', cursor: 'pointer' }}>
                    {paused ? 'Resume Scrolling' : 'Pause Scrolling'}
                </button>

                <button onClick={restart} style={{ padding: '8px 16px', cursor: 'pointer', marginLeft: 8 }}>
                    Restart
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