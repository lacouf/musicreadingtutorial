// javascript
// File: `src/App.jsx`
import React, { useEffect, useRef, useState } from 'react';
import ScrollingCanvas from './components/ScrollingCanvas';
import { renderScoreToCanvases } from './components/ScoreRenderer';
import { initializeMidi } from './midi/MidiInput';
import { exampleJSONLesson, exampleMusicXML, parseTimeline } from './parser/TimeLineParser';
import LogDisplay from './components/LogDisplay';
import { audioSynth } from './audio/AudioSynth';
import { parsePitchToMidi, midiToVexKey } from './core/musicUtils';
import { generateRandomTimeline } from './core/NoteGenerator';
import { RENDERING, TIMING, MIDI } from './core/constants';
import { calculateScrollSpeed } from './core/layoutUtils';

const PIXELS_PER_SECOND = RENDERING.PIXELS_PER_SECOND; // Still used for lead-in calculation?
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
    
    // Calculate initial scroll based on lead-in and default tempo (80 BPM)
    const defaultSpeed = calculateScrollSpeed(80, RENDERING.PIXELS_PER_BEAT);
    const initialScroll = (-LEAD_IN_SECONDS * defaultSpeed) / DEFAULT_TEMPO;
    
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

    const [minNote, setMinNote] = useState('C4');
    const [maxNote, setMaxNote] = useState('G4');
    const [includeSharps, setIncludeSharps] = useState(false);
    const [showValidTiming, setShowValidTiming] = useState(false);

    const [mode, setMode] = useState('practice'); // 'lesson' or 'practice'
    const [lessonMeta, setLessonMeta] = useState({ tempo: 80, beatsPerMeasure: 4 });

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
            showValidTiming,
            tempo: lessonMeta.tempo,
            beatsPerMeasure: lessonMeta.beatsPerMeasure
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
        let newMeta = { tempo: 80, beatsPerMeasure: 4 };

        if (mode === 'lesson') {
            const useJson = true;
            const lessonData = useJson ? exampleJSONLesson : exampleMusicXML;
            newMeta = { 
                tempo: lessonData.tempo || 80, 
                beatsPerMeasure: lessonData.timeSignature?.numerator || 4 
            };
            rawTimeline = parseTimeline(
                useJson ? 'json' : 'musicxml',
                lessonData,
                newMeta.tempo
            );
        } else {
            newMeta = { tempo: 80, beatsPerMeasure: 4 };
            rawTimeline = generateRandomTimeline(minNote, maxNote, 20, newMeta.tempo, includeSharps);
        }

        setLessonMeta(newMeta);

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
                // Calculate current time in seconds based on scroll position (beats) and tempo
                const currentBeat = scrollOffsetRef.current / RENDERING.PIXELS_PER_BEAT;
                const secPerBeat = TIMING.SECONDS_IN_MINUTE / lessonMeta.tempo;
                const playTime = currentBeat * secPerBeat;
                
                // Calculate beat-based windows
                const windowSec = TIMING.WIDE_BEAT_TOLERANCE * secPerBeat;
                const strictWindowSec = TIMING.STRICT_BEAT_TOLERANCE * secPerBeat;

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
                    const diffBeats = exact.d / secPerBeat;
                    setLog(l => [...l, `✅ Correct: ${key} (dt=${diffBeats.toFixed(2)} beats)`]);
                    flashPlayhead('green');
                } else {
                    // Missed strict window OR wrong pitch
                    // Show what was expected (closest candidate)
                    const nearest = candidates[0];
                    const expectedKey = nearest.ev.vfKey || nearest.ev.pitch || `midi:${nearest.ev.midi}`;
                    const diffBeats = nearest.d / secPerBeat;
                    setLog(l => [...l, `❌ Wrong: played ${note}, expected ${expectedKey} (dt=${diffBeats.toFixed(2)} beats)`]);
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
    }, [viewportWidth, showValidTiming, lessonMeta]);

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
            // Calculate speed dynamically based on BPM and pixels per beat
            const baseSpeed = calculateScrollSpeed(lessonMeta.tempo, RENDERING.PIXELS_PER_BEAT);
            const currentSpeed = baseSpeed / tempoFactor;
            
            // Switch to Delta Integration:
            const deltaScroll = deltaTime * currentSpeed;
            const newScrollOffset = scrollOffsetRef.current + deltaScroll;
            
            scrollOffsetRef.current = newScrollOffset;
            setScrollOffset(newScrollOffset);

            animationFrameId.current = requestAnimationFrame(animate);
        };

        animationFrameId.current = requestAnimationFrame(animate);

        return () => {
            cancelAnimationFrame(animationFrameId.current);
        };
    }, [paused, tempoFactor, lessonMeta]); // include lessonMeta for tempo changes

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
        
        // Calculate initial scroll position based on current settings
        const baseSpeed = calculateScrollSpeed(lessonMeta.tempo, RENDERING.PIXELS_PER_BEAT);
        const currentSpeed = baseSpeed / tempoFactor;
        const startOffset = -LEAD_IN_SECONDS * currentSpeed;
        
        scrollOffsetRef.current = startOffset;
        setScrollOffset(startOffset);
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
        <div className="min-h-screen bg-brand-bg font-sans pb-10">
            {/* Navbar */}
            <nav className="bg-brand-primary text-white p-4 shadow-md sticky top-0 z-50">
                <div className="max-w-4xl mx-auto flex items-center justify-between">
                    <h1 className="text-2xl font-bold font-comic tracking-wide flex items-center gap-2">
                        🎵 Music Tutor
                    </h1>
                    <div className="text-sm bg-violet-700 px-3 py-1 rounded-full">
                        {midiSupported ? '🎹 MIDI Ready' : '🔌 Connect MIDI'}
                    </div>
                </div>
            </nav>

            <div className="max-w-4xl mx-auto p-4 md:p-6 space-y-6">
                
                {/* Mode Selection Tabs */}
                <div className="bg-white p-2 rounded-2xl shadow-sm inline-flex gap-2">
                    <button 
                        onClick={() => setMode('practice')}
                        className={`px-6 py-2 rounded-xl transition-all font-bold ${
                            mode === 'practice' 
                                ? 'bg-brand-secondary text-white shadow-md' 
                                : 'text-gray-500 hover:bg-gray-100'
                        }`}
                    >
                        Random Practice
                    </button>
                    <button 
                        onClick={() => setMode('lesson')}
                        className={`px-6 py-2 rounded-xl transition-all font-bold ${
                            mode === 'lesson' 
                                ? 'bg-brand-secondary text-white shadow-md' 
                                : 'text-gray-500 hover:bg-gray-100'
                        }`}
                    >
                        Lesson Mode
                    </button>
                </div>

                {/* Score Canvas Container */}
                <div className="bg-white rounded-3xl shadow-xl overflow-hidden border-4 border-white ring-1 ring-gray-100">
                    <div 
                        ref={containerRef} 
                        style={{ 
                            width: viewportWidth, 
                            maxWidth: '100%', 
                            height: viewportHeight, 
                            overflow: 'hidden', 
                            position: 'relative',
                            resize: 'horizontal', 
                            minWidth: '300px'
                        }}
                        className="bg-white"
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

                        {/* Pulse Overlay */}
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
                </div>

                {/* Controls Area */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    
                    {/* Left Column: Playback Controls */}
                    <div className="bg-white p-6 rounded-2xl shadow-lg space-y-4 border border-gray-100">
                        <h3 className="text-lg font-bold text-gray-700">Playback Controls</h3>
                        
                        <div className="flex gap-2">
                            <button 
                                onClick={togglePause} 
                                className={`flex-1 py-3 font-bold rounded-xl transition-colors shadow-sm ${
                                    paused 
                                        ? 'bg-green-500 hover:bg-green-600 text-white' 
                                        : 'bg-yellow-500 hover:bg-yellow-600 text-white'
                                }`}
                            >
                                {paused ? '▶ Resume' : '⏸ Pause'}
                            </button>
                            <button 
                                onClick={restart} 
                                className="px-6 py-3 font-bold bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-xl transition-colors shadow-sm"
                            >
                                ↺ Restart
                            </button>
                        </div>

                        <div className="space-y-3 pt-2">
                            <label className="flex flex-col gap-1">
                                <span className="text-sm font-semibold text-gray-500 flex justify-between">
                                    <span>Tempo Scale</span>
                                    <span className="text-brand-primary">{tempoFactor.toFixed(1)}x</span>
                                </span>
                                <input
                                    type="range"
                                    min="0.5"
                                    max="3.0"
                                    step="0.1"
                                    value={tempoFactor}
                                    onChange={(e) => setTempoFactor(Number(e.target.value))}
                                    className="w-full accent-brand-primary h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                                />
                            </label>

                            <label className="flex flex-col gap-1">
                                <span className="text-sm font-semibold text-gray-500">Volume</span>
                                <input
                                    type="range"
                                    min="0"
                                    max="1"
                                    step="0.05"
                                    defaultValue="0.3"
                                    onChange={(e) => audioSynth.setVolume(Number(e.target.value))}
                                    className="w-full accent-brand-secondary h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                                />
                            </label>
                        </div>
                    </div>

                    {/* Right Column: Mode Settings */}
                    <div className="bg-white p-6 rounded-2xl shadow-lg space-y-4 border border-gray-100">
                        <h3 className="text-lg font-bold text-gray-700">
                            {mode === 'practice' ? 'Practice Settings' : 'Lesson Info'}
                        </h3>

                        {mode === 'practice' ? (
                            <div className="space-y-4">
                                <div className="flex gap-2">
                                    <label className="flex-1">
                                        <span className="text-xs font-bold text-gray-400 uppercase">Min Note</span>
                                        <input 
                                            value={minNote} 
                                            onChange={(e) => setMinNote(e.target.value)}
                                            className="w-full mt-1 p-2 bg-gray-50 border border-gray-200 rounded-lg text-center font-bold focus:ring-2 focus:ring-brand-primary outline-none" 
                                        />
                                    </label>
                                    <label className="flex-1">
                                        <span className="text-xs font-bold text-gray-400 uppercase">Max Note</span>
                                        <input 
                                            value={maxNote} 
                                            onChange={(e) => setMaxNote(e.target.value)}
                                            className="w-full mt-1 p-2 bg-gray-50 border border-gray-200 rounded-lg text-center font-bold focus:ring-2 focus:ring-brand-primary outline-none" 
                                        />
                                    </label>
                                </div>

                                <div className="flex flex-col gap-2">
                                    <label className="flex items-center gap-2 p-2 rounded-lg hover:bg-gray-50 cursor-pointer">
                                        <input 
                                            type="checkbox" 
                                            checked={includeSharps} 
                                            onChange={(e) => setIncludeSharps(e.target.checked)}
                                            className="w-5 h-5 accent-brand-primary rounded"
                                        />
                                        <span className="font-medium text-gray-700">Include Sharps (Black Keys)</span>
                                    </label>
                                    
                                    <label className="flex items-center gap-2 p-2 rounded-lg hover:bg-gray-50 cursor-pointer">
                                        <input 
                                            type="checkbox" 
                                            checked={showValidTiming} 
                                            onChange={(e) => setShowValidTiming(e.target.checked)}
                                            className="w-5 h-5 accent-brand-primary rounded"
                                        />
                                        <span className="font-medium text-gray-700">Show Valid Timing Window</span>
                                    </label>
                                </div>

                                <button 
                                    onClick={() => loadTimeline()}
                                    className="w-full py-3 font-bold bg-brand-primary hover:bg-violet-700 text-white rounded-xl transition-colors shadow-md"
                                >
                                    ✨ Generate New Exercise
                                </button>
                            </div>
                        ) : (
                            <div className="space-y-4 text-gray-600">
                                <p>Playing: <strong>{exampleJSONLesson.title}</strong></p>
                                <p className="text-sm">Follow the score and play along. The lesson starts with single notes and progresses to chords.</p>
                                <label className="flex items-center gap-2 p-2 rounded-lg hover:bg-gray-50 cursor-pointer border border-gray-100">
                                    <input 
                                        type="checkbox" 
                                        checked={showValidTiming} 
                                        onChange={(e) => setShowValidTiming(e.target.checked)}
                                        className="w-5 h-5 accent-brand-primary rounded"
                                    />
                                    <span className="font-medium text-gray-700">Show Valid Timing Window</span>
                                </label>
                            </div>
                        )}
                    </div>
                </div>

                {/* Debug / Info Section (Collapsible or reduced) */}
                <div className="bg-gray-50 p-4 rounded-xl border border-gray-200">
                    <h4 className="font-bold text-gray-500 text-sm uppercase mb-2">Debug Log</h4>
                    <LogDisplay log={log} />
                </div>
            </div>
        </div>
    );
}
