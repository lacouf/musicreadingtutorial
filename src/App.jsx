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
import { calculateScrollSpeed } from './core/layoutUtils';

const DEFAULT_TEMPO = TIMING.DEFAULT_TEMPO;
const LEAD_IN_SECONDS = TIMING.LEAD_IN_SECONDS;

export default function App() {
    const containerRef = useRef(null);
    const stavesRef = useRef(null);
    const notesRef = useRef(null);
    const [midiSupported, setMidiSupported] = useState(false);
    const timelineRef = useRef([]);
    const [log, setLog] = useState([]);
    
    // UI State
    const [showDevTools, setShowDevTools] = useState(false);
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    
    // Playback State
    const defaultSpeed = calculateScrollSpeed(80, RENDERING.PIXELS_PER_BEAT);
    const initialScroll = (-LEAD_IN_SECONDS * defaultSpeed) / DEFAULT_TEMPO;
    
    const [scrollOffset, setScrollOffset] = useState(initialScroll);
    const [renderTrigger, setRenderTrigger] = useState(0); 
    const [playheadFlash, setPlayheadFlash] = useState(null);
    const [paused, setPaused] = useState(true);
    const pausedRef = useRef(true); 

    const [pulseActive, setPulseActive] = useState(false);
    const [pulseColor, setPulseColor] = useState('red');

    const animationFrameId = useRef(null);
    const lastFrameTimeRef = useRef(0);
    const totalActiveTimeRef = useRef(-LEAD_IN_SECONDS); 
    const scrollOffsetRef = useRef(initialScroll);

    const validatedNotesRef = useRef(new Map());
    const recentMidiEventsRef = useRef(new Map());

    const playheadX = RENDERING.PLAYHEAD_X;
    const [viewportWidth, setViewportWidth] = useState(RENDERING.VIEWPORT_WIDTH);
    const viewportHeight = RENDERING.VIEWPORT_HEIGHT;

    const [tempoFactor, setTempoFactor] = useState(DEFAULT_TEMPO);
    const [minNote, setMinNote] = useState('C4');
    const [maxNote, setMaxNote] = useState('G4');
    const [includeSharps, setIncludeSharps] = useState(false);
    const [showValidTiming, setShowValidTiming] = useState(false);
    const [beatTolerance, setBeatTolerance] = useState(0.1);
    const [validateNoteLength, setValidateNoteLength] = useState(false);
    const [enabledDurations, setEnabledDurations] = useState({
        whole: false,
        half: false,
        quarter: true,
        eighth: false,
        sixteenth: false
    });

    const [mode, setMode] = useState('practice'); 
    const [lessonMeta, setLessonMeta] = useState({ tempo: 80, beatsPerMeasure: 4 });

    const activeMatchesRef = useRef(new Map()); // midi -> { index, startBeat, durationBeats }

    const renderCurrentTimeline = () => {
        if (!stavesRef.current || !notesRef.current || !timelineRef.current) return;
        const minMidi = parsePitchToMidi(minNote) ?? MIDI.MIN_MIDI;
        const maxMidi = parsePitchToMidi(maxNote) ?? MIDI.MAX_MIDI;

        renderScoreToCanvases(stavesRef.current, notesRef.current, timelineRef.current, { 
            viewportWidth, viewportHeight, 
            pixelsPerBeat: RENDERING.PIXELS_PER_BEAT,
            playheadX, minMidi, maxMidi, showValidTiming,
            tempo: lessonMeta.tempo,
            beatsPerMeasure: lessonMeta.beatsPerMeasure,
            beatTolerance: beatTolerance
        })
            .then(() => setRenderTrigger(t => t + 1))
            .catch(e => setLog(l => [...l, 'Render error: ' + e.message]));
    };

    const loadTimeline = () => {
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
            rawTimeline = parseTimeline(useJson ? 'json' : 'musicxml', lessonData, newMeta.tempo);
        } else {
            newMeta = { tempo: 80, beatsPerMeasure: 4 };
            
            const possibleDurations = [];
            if (enabledDurations.whole) possibleDurations.push(4.0);
            if (enabledDurations.half) possibleDurations.push(2.0);
            if (enabledDurations.quarter) possibleDurations.push(1.0);
            if (enabledDurations.eighth) possibleDurations.push(0.5);
            if (enabledDurations.sixteenth) possibleDurations.push(0.25);
            
            if (possibleDurations.length === 0) possibleDurations.push(1.0);

            rawTimeline = generateRandomTimeline(minNote, maxNote, 20, newMeta.tempo, includeSharps, possibleDurations);
        }

        setLessonMeta(newMeta);

        const normalizedTimeline = rawTimeline.map(ev => {
            const pitchSource = ev.midi ?? ev.pitch ?? ev.key ?? ev.note ?? ev.name ?? ev.vfKey ?? (Array.isArray(ev.keys) ? ev.keys[0] : '') ;
            let midi = (typeof pitchSource === 'number' && Number.isFinite(pitchSource)) ? Math.trunc(pitchSource) : parsePitchToMidi(String(pitchSource || ''));
            if (midi == null && ev.vfKey) midi = parsePitchToMidi(String(ev.vfKey));
            const vfKey = midi ? midiToVexKey(midi) : (ev.vfKey || (Array.isArray(ev.keys) ? ev.keys[0] : null));
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

        function cleanupValidatedNotes(currentTime) {
            const expiryTime = 2000; 
            for (const [index, timestamp] of validatedNotesRef.current.entries()) {
                if (currentTime - timestamp > expiryTime) validatedNotesRef.current.delete(index);
            }
        }

        const cleanupMidi = initializeMidi({
            onNoteOn: (pitch, note) => {
                const now = performance.now();
                const lastEventTime = recentMidiEventsRef.current.get(note);
                if (lastEventTime && (now - lastEventTime) < 50) return;
                recentMidiEventsRef.current.set(note, now);
                audioSynth.playNote(note);
                setLog(l => [...l, `noteOn ${pitch} (${note})`]);
                if (pausedRef.current) return;

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
                    
                    // Tolerance for release: 0.2 beats or 20% of note length, whichever is larger
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
    }, [lessonMeta]); 

    useEffect(() => {
        const handleResize = (entries) => {
            for (let entry of entries) setViewportWidth(entry.contentRect.width);
        };
        const observer = new ResizeObserver(handleResize);
        if (containerRef.current) observer.observe(containerRef.current);
        return () => observer.disconnect();
    }, []);

    useEffect(() => { loadTimeline(); }, [mode, minNote, maxNote, includeSharps]);
    useEffect(() => { renderCurrentTimeline(); }, [viewportWidth, showValidTiming, lessonMeta, beatTolerance]);

    useEffect(() => {
        if (paused) {
            cancelAnimationFrame(animationFrameId.current);
            lastFrameTimeRef.current = 0;
            return;
        }

        const animate = (timestamp) => {
            if (!lastFrameTimeRef.current) lastFrameTimeRef.current = timestamp;
            const deltaTime = (timestamp - lastFrameTimeRef.current) / 1000;
            totalActiveTimeRef.current += deltaTime;
            lastFrameTimeRef.current = timestamp;

            const baseSpeed = calculateScrollSpeed(lessonMeta.tempo, RENDERING.PIXELS_PER_BEAT);
            const currentSpeed = baseSpeed / tempoFactor;
            const deltaScroll = deltaTime * currentSpeed;
            const newScrollOffset = scrollOffsetRef.current + deltaScroll;
            
            scrollOffsetRef.current = newScrollOffset;
            setScrollOffset(newScrollOffset);
            animationFrameId.current = requestAnimationFrame(animate);
        };

        animationFrameId.current = requestAnimationFrame(animate);
        return () => cancelAnimationFrame(animationFrameId.current);
    }, [paused, tempoFactor, lessonMeta]); 

    function flashPlayhead(color) {
        setPlayheadFlash(color);
        setPulseColor(color || 'red');
        setPulseActive(true);
        window.setTimeout(() => {
            setPlayheadFlash(null);
            setPulseActive(false);
        }, 220);
    }

    const togglePause = () => {
        setPaused(prev => {
            const newPaused = !prev;
            pausedRef.current = newPaused; 
            if (newPaused) {
                validatedNotesRef.current.clear();
                recentMidiEventsRef.current.clear();
            }
            return newPaused;
        });
    };

    const restart = () => {
        totalActiveTimeRef.current = -LEAD_IN_SECONDS;
        const baseSpeed = calculateScrollSpeed(lessonMeta.tempo, RENDERING.PIXELS_PER_BEAT);
        const currentSpeed = baseSpeed / tempoFactor;
        const startOffset = -LEAD_IN_SECONDS * currentSpeed;
        scrollOffsetRef.current = startOffset;
        setScrollOffset(startOffset);
        lastFrameTimeRef.current = 0;
        validatedNotesRef.current.clear();
        recentMidiEventsRef.current.clear();
        setPaused(true);
        pausedRef.current = true;
        setLog(l => [...l, '🔄 Restarted']);
    };

    const overlayWidth = 120;
    const circleSize = 18;

    return (
        <div className="flex h-screen w-full bg-brand-bg font-sans select-none text-gray-800 overflow-hidden">
            
            {/* COLORFUL SIDEBAR - Now with Fixed Positioning for robustness */}
            <aside className="fixed left-0 top-0 w-16 h-full bg-gradient-to-b from-brand-primary via-brand-accent to-brand-primary flex flex-col items-center py-6 shadow-2xl z-[100] border-r border-white/10">
                <button 
                    onClick={() => setIsMenuOpen(!isMenuOpen)}
                    className="w-10 h-10 flex items-center justify-center bg-white/20 hover:bg-white/30 rounded-xl transition-all active:scale-95 shadow-inner"
                    title="Menu"
                >
                    <div className="flex flex-col gap-1">
                        <span className={`w-5 h-0.5 bg-white transition-all ${isMenuOpen ? 'rotate-45 translate-y-1.5' : ''}`}></span>
                        <span className={`w-5 h-0.5 bg-white transition-all ${isMenuOpen ? 'opacity-0' : ''}`}></span>
                        <span className={`w-5 h-0.5 bg-white transition-all ${isMenuOpen ? '-rotate-45 -translate-y-1.5' : ''}`}></span>
                    </div>
                </button>
                
                <div className="mt-auto flex flex-col gap-4 mb-6">
                    <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center text-white text-xl shadow-lg border border-white/5">♫</div>
                    <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center text-white text-xl shadow-lg border border-white/5">♥</div>
                </div>
            </aside>

            {/* MAIN CONTENT Area - Padded to make room for fixed sidebar */}
            <main className="ml-16 flex-1 h-full overflow-y-auto relative flex flex-col">
                
                {/* Configuration Menu Overlay */}
                {isMenuOpen && (
                    <div className="fixed inset-0 z-[110] flex">
                        <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={() => setIsMenuOpen(false)}></div>
                        <div className="relative w-80 bg-white h-full shadow-2xl border-l border-gray-100 flex flex-col p-8 transform transition-transform duration-300">
                            <div className="flex justify-between items-center mb-10">
                                <h2 className="text-2xl font-black text-brand-primary">Settings</h2>
                                <button onClick={() => setIsMenuOpen(false)} className="text-gray-300 hover:text-gray-500">✕</button>
                            </div>
                            
                            <div className="space-y-8">
                                <div className="p-6 bg-brand-bg rounded-3xl space-y-6">
                                    <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest">General</h3>
                                    
                                    <label className="flex items-center justify-between cursor-pointer">
                                        <span className={`font-bold ${showDevTools ? 'text-brand-primary' : 'text-gray-500'}`}>
                                            Dev Mode
                                        </span>
                                        <div 
                                            onClick={() => setShowDevTools(!showDevTools)}
                                            className={`w-14 h-7 rounded-full p-1 transition-colors relative ${showDevTools ? 'bg-brand-primary' : 'bg-gray-300'}`}
                                        >
                                            <div className={`w-5 h-5 bg-white rounded-full transition-transform shadow-md ${showDevTools ? 'translate-x-7' : 'translate-x-0'}`}></div>
                                        </div>
                                    </label>
                                </div>
                                
                                <div className="mt-auto pt-10 border-t border-gray-100 text-[10px] text-gray-300 font-bold tracking-widest uppercase">
                                    Music Master v1.0
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Top Navbar */}
                <header className="bg-white/90 backdrop-blur-md px-8 py-4 sticky top-0 z-40 border-b border-gray-100 flex items-center justify-between shadow-sm">
                    <div className="flex items-center gap-4">
                        <span className="text-3xl">🎹</span>
                        <h1 className="text-2xl font-black tracking-tight text-gray-800">
                            Piano <span className="text-brand-primary font-comic">Master</span>
                        </h1>
                    </div>
                    
                    <div className="flex items-center gap-4">
                        <div className={`flex items-center gap-2 px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest shadow-sm border ${
                            midiSupported ? 'bg-green-50 border-green-100 text-green-600' : 'bg-amber-50 border-amber-100 text-amber-600'
                        }`}>
                            <span className={`w-2 h-2 rounded-full ${midiSupported ? 'bg-green-500 animate-pulse' : 'bg-amber-500'}`}></span>
                            {midiSupported ? 'MIDI Connected' : 'No MIDI Found'}
                        </div>
                    </div>
                </header>

                {/* Main Dashboard */}
                <div className="flex-1 p-6 md:p-10 max-w-6xl mx-auto w-full space-y-10">
                    
                    {/* Mode Tabs */}
                    <div className="bg-white/50 p-1.5 rounded-3xl inline-flex gap-1.5 border border-white shadow-sm ring-1 ring-gray-200/50">
                        {['practice', 'lesson'].map((m) => (
                            <button 
                                key={m}
                                onClick={() => setMode(m)}
                                className={`px-10 py-3 rounded-2xl transition-all font-black text-xs uppercase tracking-widest ${
                                    mode === m 
                                        ? 'bg-brand-primary text-white shadow-xl shadow-violet-200 scale-[1.02]' 
                                        : 'text-gray-400 hover:text-gray-600 hover:bg-white'
                                }`}
                            >
                                {m}
                            </button>
                        ))}
                    </div>

                    {/* Score section */}
                    <section className="bg-white rounded-[3rem] shadow-2xl overflow-hidden border-[8px] border-white ring-1 ring-gray-200/50 transform transition-transform hover:scale-[1.002]">
                        <div 
                            ref={containerRef} 
                            style={{ width: viewportWidth, maxWidth: '100%', height: viewportHeight, overflow: 'hidden', position: 'relative' }}
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
                    </section>

                    {/* Hitbox Quick-Adjustment (Only in Dev Mode) */}
                    {showDevTools && (
                        <div className="flex items-center justify-center gap-8 py-2 px-6 bg-white/40 backdrop-blur-sm rounded-full border border-white/50 w-max mx-auto shadow-sm animate-in fade-in zoom-in duration-300">
                            <label className="flex items-center gap-3 cursor-pointer group">
                                <input 
                                    type="checkbox" 
                                    checked={showValidTiming} 
                                    onChange={(e) => setShowValidTiming(e.target.checked)} 
                                    className="w-4 h-4 accent-green-500 rounded border-gray-300" 
                                />
                                <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest group-hover:text-green-600 transition-colors">Draw Hitboxes</span>
                            </label>
                            
                            {showValidTiming && (
                                <div className="flex items-center gap-3 pl-4 border-l border-gray-200">
                                    <span className="text-[10px] font-black text-gray-400 uppercase">Width</span>
                                    <input 
                                        type="range" min="0.01" max="0.40" step="0.01" 
                                        value={beatTolerance} 
                                        onChange={(e) => setBeatTolerance(Number(e.target.value))}
                                        className="w-32 h-1.5 accent-green-500 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                                    />
                                    <span className="text-[10px] font-black text-green-600 w-10 text-right">{beatTolerance.toFixed(2)}b</span>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Controls & Settings Grid */}
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                        
                        {/* Control Panel */}
                        <div className="lg:col-span-2 bg-white p-10 rounded-[2.5rem] shadow-xl border border-gray-50 flex flex-col gap-8">
                            <div className="flex items-center justify-between">
                                <h3 className="text-xl font-black text-gray-800 flex items-center gap-3 italic">
                                    <span className="w-2.5 h-8 bg-brand-primary rounded-full"></span>
                                    Dashboard
                                </h3>
                                <button onClick={restart} className="text-[10px] font-black text-brand-primary bg-brand-bg px-4 py-2 rounded-xl hover:bg-violet-100 transition-colors tracking-tighter">
                                    RESTART SESSION
                                </button>
                            </div>
                            
                            <button 
                                onClick={togglePause} 
                                className={`w-full py-6 font-black rounded-[2rem] transition-all active:scale-[0.97] shadow-xl text-lg ${
                                    paused 
                                        ? 'bg-green-500 hover:bg-green-600 text-white shadow-green-100' 
                                        : 'bg-brand-secondary hover:bg-amber-500 text-white shadow-amber-100'
                                }`}
                            >
                                {paused ? '▶ START PLAYING' : '⏸ PAUSE SCROLL'}
                            </button>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                                <div className="space-y-4">
                                    <div className="flex justify-between text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">
                                        <span>Tempo</span>
                                        <span className="text-brand-primary">{tempoFactor.toFixed(1)}x</span>
                                    </div>
                                    <input
                                        type="range" min="0.5" max="3.0" step="0.1" value={tempoFactor}
                                        onChange={(e) => setTempoFactor(Number(e.target.value))}
                                        className="w-full accent-brand-primary h-2.5 bg-gray-100 rounded-full appearance-none cursor-pointer"
                                    />
                                </div>

                                <div className="space-y-4">
                                    <div className="flex justify-between text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">
                                        <span>Volume</span>
                                    </div>
                                    <input
                                        type="range" min="0" max="1" step="0.05" defaultValue="0.3"
                                        onChange={(e) => audioSynth.setVolume(Number(e.target.value))}
                                        className="w-full accent-brand-accent h-2.5 bg-gray-100 rounded-full appearance-none cursor-pointer"
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Settings Side Panel */}
                        <div className="bg-white p-10 rounded-[2.5rem] shadow-xl border border-gray-50 flex flex-col">
                            <h3 className="text-xl font-black text-gray-800 mb-8 flex items-center gap-3 italic">
                                <span className="w-2.5 h-8 bg-brand-secondary rounded-full"></span>
                                Settings
                            </h3>

                            {mode === 'practice' ? (
                                <div className="space-y-6 flex-1 flex flex-col">
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="bg-brand-bg/50 p-4 rounded-3xl border border-white shadow-inner">
                                            <span className="text-[10px] font-black text-gray-400 uppercase block text-center mb-1">Min</span>
                                            <input value={minNote} onChange={(e) => setMinNote(e.target.value)} className="w-full bg-transparent text-center font-black text-xl text-brand-primary outline-none" />
                                        </div>
                                        <div className="bg-brand-bg/50 p-4 rounded-3xl border border-white shadow-inner">
                                            <span className="text-[10px] font-black text-gray-400 uppercase block text-center mb-1">Max</span>
                                            <input value={maxNote} onChange={(e) => setMaxNote(e.target.value)} className="w-full bg-transparent text-center font-black text-xl text-brand-primary outline-none" />
                                        </div>
                                    </div>

                                    <div className="space-y-3">
                                        <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest block ml-1 text-center">Note Types</span>
                                        <div className="grid grid-cols-2 gap-2">
                                            {[
                                                { id: 'whole', label: 'Whole (1/1)' },
                                                { id: 'half', label: 'Half (1/2)' },
                                                { id: 'quarter', label: 'Quarter (1/4)' },
                                                { id: 'eighth', label: 'Eighth (1/8)' },
                                                { id: 'sixteenth', label: '16th (1/16)' }
                                            ].map(({ id, label }) => (
                                                <label key={id} className={`flex items-center gap-2 p-2 rounded-xl transition-all border cursor-pointer ${
                                                    id === 'quarter' ? 'bg-violet-50 border-violet-100 opacity-80 cursor-default' : 'bg-gray-50 border-transparent hover:bg-gray-100 hover:border-white'
                                                }`}>
                                                    <input 
                                                        type="checkbox" 
                                                        checked={id === 'quarter' ? true : enabledDurations[id]} 
                                                        disabled={id === 'quarter'}
                                                        onChange={(e) => setEnabledDurations(prev => ({ ...prev, [id]: e.target.checked }))} 
                                                        className="w-4 h-4 accent-brand-primary rounded shadow-sm" 
                                                    />
                                                    <span className="text-[9px] font-black text-gray-500 uppercase tracking-tighter">{label}</span>
                                                </label>
                                            ))}
                                        </div>
                                    </div>

                                    <div className="space-y-3">
                                        <label className="flex items-center gap-4 p-4 bg-gray-50 rounded-3xl hover:bg-gray-100 transition-colors cursor-pointer border-2 border-transparent hover:border-white">
                                            <input type="checkbox" checked={includeSharps} onChange={(e) => setIncludeSharps(e.target.checked)} className="w-6 h-6 accent-brand-secondary rounded-lg" />
                                            <span className="font-black text-gray-600 text-xs uppercase tracking-widest">Sharps</span>
                                        </label>

                                        <label className="flex items-center gap-4 p-4 bg-gray-50 rounded-3xl hover:bg-gray-100 transition-colors cursor-pointer border-2 border-transparent hover:border-white">
                                            <input type="checkbox" checked={validateNoteLength} onChange={(e) => setValidateNoteLength(e.target.checked)} className="w-6 h-6 accent-brand-accent rounded-lg" />
                                            <span className="font-black text-gray-600 text-xs uppercase tracking-widest">Validate Hold</span>
                                        </label>
                                    </div>

                                    <button 
                                        onClick={() => loadTimeline()}
                                        className="mt-auto w-full py-5 font-black bg-brand-secondary hover:bg-amber-600 text-white rounded-3xl transition-all shadow-xl shadow-amber-100 active:scale-95 text-xs uppercase tracking-[0.2em]"
                                    >
                                        Generate
                                    </button>
                                </div>
                            ) : (
                                <div className="flex-1 flex flex-col items-center justify-center text-center space-y-6">
                                    <div className="w-24 h-24 bg-brand-bg rounded-full flex items-center justify-center text-5xl shadow-inner border border-white">📜</div>
                                    <div className="space-y-2">
                                        <div className="text-[10px] font-black text-gray-400 uppercase tracking-[0.3em]">Playing</div>
                                        <div className="font-black text-brand-primary text-xl leading-tight">{exampleJSONLesson.title}</div>
                                    </div>
                                    <p className="text-xs text-gray-400 font-medium px-4 leading-relaxed leading-relaxed italic opacity-80">"Every master was once a beginner. Keep practice!"</p>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Developer Console (Bounded & Conditional) */}
                    {showDevTools && (
                        <div className="pt-16 border-t-4 border-dotted border-gray-200 animate-in fade-in slide-in-from-bottom-8 duration-700">
                            <div className="flex items-center justify-between mb-8">
                                <h3 className="text-sm font-black text-green-500 uppercase tracking-[0.5em] flex items-center gap-4">
                                    <span className="w-3 h-3 bg-green-500 rounded-full animate-ping"></span>
                                    Dev Terminal
                                </h3>
                                <button onClick={() => setLog([])} className="text-[10px] font-black text-red-400 hover:text-red-600 bg-red-50 px-3 py-1 rounded-lg transition-colors">CLEAR LOG</button>
                            </div>
                            
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 h-[32rem]">
                                <div className="bg-white rounded-[2rem] overflow-hidden border border-gray-100 shadow-xl flex flex-col">
                                    <div className="bg-gray-50 px-6 py-3 border-b border-gray-100 text-[10px] font-black text-gray-400 uppercase tracking-widest">Live Event Stream</div>
                                    <div className="flex-1 overflow-hidden">
                                        <LogDisplay log={log} />
                                    </div>
                                </div>

                                <div className="bg-white rounded-[2rem] overflow-hidden border border-gray-100 shadow-xl flex flex-col">
                                    <div className="bg-gray-50 px-6 py-3 border-b border-gray-100 text-[10px] font-black text-gray-400 uppercase tracking-widest">Data Inspector</div>
                                    <div className="flex-1 overflow-y-auto p-2 text-center flex items-center justify-center">
                                        <LessonDisplay jsonLesson={exampleJSONLesson} musicXmlLesson={exampleMusicXML} />
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
                
                <footer className="py-12 text-center">
                    <span className="text-[10px] font-black text-gray-300 tracking-[0.4em] uppercase">
                        Mastery requires repetition
                    </span>
                </footer>
            </main>
        </div>
    );
}
