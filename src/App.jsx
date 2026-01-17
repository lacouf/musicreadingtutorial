// javascript
// File: `src/App.jsx`
import React, { useEffect, useRef, useState } from 'react';
import ScrollingCanvas from './components/ScrollingCanvas';
import { renderScoreToCanvases } from './components/ScoreRenderer';
import { initializeMidi } from './midi/MidiInput';
import { exampleJSONLesson, exampleMusicXML, parseTimeline, AVAILABLE_LESSONS } from './parser/TimeLineParser';
import LogDisplay from './components/LogDisplay';
import LessonDisplay from './components/LessonDisplay';
import SettingsPanel from './components/SettingsPanel';
import ControlPanel from './components/ControlPanel';
import Header from './components/Header';
import Sidebar from './components/Sidebar';
import { usePlayback } from './hooks/usePlayback';
import { useTimeline } from './hooks/useTimeline';
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

    // Initialize off-screen canvases once
    if (!stavesRef.current && typeof document !== 'undefined') {
        stavesRef.current = document.createElement('canvas');
    }
    if (!notesRef.current && typeof document !== 'undefined') {
        notesRef.current = document.createElement('canvas');
    }

    const [midiSupported, setMidiSupported] = useState(false);
    const [log, setLog] = useState([]);
    
    // UI State
    const [showDevTools, setShowDevTools] = useState(false);
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    
    const [renderTrigger, setRenderTrigger] = useState(0); 
    const [playheadFlash, setPlayheadFlash] = useState(null);

    const [pulseActive, setPulseActive] = useState(false);
    const [pulseColor, setPulseColor] = useState('red');

    const validatedNotesRef = useRef(new Map());
    const recentMidiEventsRef = useRef(new Map());

    const playheadX = RENDERING.PLAYHEAD_X;
    const [viewportWidth, setViewportWidth] = useState(RENDERING.VIEWPORT_WIDTH);
    const viewportHeight = RENDERING.VIEWPORT_HEIGHT;
    const [clipX, setClipX] = useState(0);

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
    const [selectedLessonId, setSelectedLessonId] = useState(AVAILABLE_LESSONS[0].id);

    const activeMatchesRef = useRef(new Map()); // midi -> { index, startBeat, durationBeats }

    // Custom Hook: Timeline Manager
    const { 
        timelineRef, 
        lessonMeta, 
        timelineVersion, 
        loadTimeline 
    } = useTimeline(
        mode, 
        selectedLessonId, 
        { minNote, maxNote, includeSharps, enabledDurations }
    );

    // Custom Hook: Playback Engine
    const { 
        scrollOffset, 
        scrollOffsetRef, 
        paused, 
        pausedRef, 
        togglePause: engineTogglePause, 
        resetPlayback,
        setPaused
    } = usePlayback(lessonMeta, tempoFactor, LEAD_IN_SECONDS);

    // Effect: Reset playback when timeline changes
    useEffect(() => {
        const baseSpeed = calculateScrollSpeed(lessonMeta.tempo, RENDERING.PIXELS_PER_BEAT);
        const startScroll = (-LEAD_IN_SECONDS * baseSpeed) / tempoFactor;
        resetPlayback(startScroll, -LEAD_IN_SECONDS);
        setLog(l => [...l, `Loaded ${mode} timeline`]);
    }, [timelineVersion]);


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
            .then((result) => {
                setRenderTrigger(t => t + 1);
                if (result && result.notesStartX) {
                    setClipX(result.notesStartX);
                }
            })
            .catch(e => setLog(l => [...l, 'Render error: ' + e.message]));
    };

    // loadTimeline is now provided by useTimeline hook and reset logic is in useEffect[timelineVersion]

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
            cleanupMidi();
            window.removeEventListener('keydown', handleKeyDown);
        };
    }, [lessonMeta]); 

    useEffect(() => {
        const handleResize = (entries) => {
            for (let entry of entries) {
                const width = entry.contentRect.width;
                if (width > 0) setViewportWidth(width);
            }
        };
        const observer = new ResizeObserver(handleResize);
        if (containerRef.current) observer.observe(containerRef.current);
        return () => observer.disconnect();
    }, []);

    useEffect(() => { loadTimeline(); }, [mode, selectedLessonId, minNote, maxNote, includeSharps]);
    useEffect(() => { renderCurrentTimeline(); }, [viewportWidth, showValidTiming, lessonMeta, beatTolerance]);

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
        // Toggle pause via engine, but also clear validation state if pausing
        // The engine returns the NEW state? No, togglePause returns void.
        // We can check 'paused' state, but it won't update immediately in this closure.
        // So we can assume !paused is the new state if we are toggling.
        // Actually, safer to just clear.
        if (!paused) {
            validatedNotesRef.current.clear();
            recentMidiEventsRef.current.clear();
        }
        engineTogglePause();
    };

    const restart = () => {
        const baseSpeed = calculateScrollSpeed(lessonMeta.tempo, RENDERING.PIXELS_PER_BEAT);
        const currentSpeed = baseSpeed / tempoFactor;
        const startOffset = -LEAD_IN_SECONDS * currentSpeed;
        
        resetPlayback(startOffset, -LEAD_IN_SECONDS);
        
        validatedNotesRef.current.clear();
        recentMidiEventsRef.current.clear();
        setLog(l => [...l, '🔄 Restarted']);
    };

    const overlayWidth = 120;
    const circleSize = 18;

    return (
        <div className="flex h-screen w-full bg-brand-bg font-sans select-none text-gray-800 overflow-hidden">
            
            {/* COLORFUL SIDEBAR */}
            <Sidebar isMenuOpen={isMenuOpen} setIsMenuOpen={setIsMenuOpen} />

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
                <Header midiSupported={midiSupported} />

                {/* Main Dashboard */}
                <div className="flex-1 p-6 md:p-10 max-w-6xl mx-auto w-full space-y-10">
                    
                    {/* Mode Tabs */}
                    <div className="flex items-center gap-4">
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

                        {mode === 'lesson' && (
                            <div className="bg-white/50 p-1.5 rounded-3xl inline-flex gap-1.5 border border-white shadow-sm ring-1 ring-gray-200/50">
                                <select 
                                    value={selectedLessonId}
                                    onChange={(e) => setSelectedLessonId(e.target.value)}
                                    className="px-6 py-2.5 rounded-2xl bg-white text-gray-700 font-bold text-xs uppercase tracking-wide border-none outline-none cursor-pointer hover:bg-gray-50 transition-colors"
                                >
                                    {AVAILABLE_LESSONS.map(lesson => (
                                        <option key={lesson.id} value={lesson.id}>
                                            {lesson.name}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        )}
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
                                clipX={clipX}
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
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                        
                        {/* Control Panel */}
                        <ControlPanel
                            paused={paused}
                            togglePause={togglePause}
                            restart={restart}
                            tempoFactor={tempoFactor}
                            setTempoFactor={setTempoFactor}
                        />

                        {/* Settings Side Panel */}
                        <SettingsPanel
                            mode={mode}
                            minNote={minNote}
                            setMinNote={setMinNote}
                            maxNote={maxNote}
                            setMaxNote={setMaxNote}
                            enabledDurations={enabledDurations}
                            setEnabledDurations={setEnabledDurations}
                            includeSharps={includeSharps}
                            setIncludeSharps={setIncludeSharps}
                            validateNoteLength={validateNoteLength}
                            setValidateNoteLength={setValidateNoteLength}
                            onGenerate={() => loadTimeline()}
                        />
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
