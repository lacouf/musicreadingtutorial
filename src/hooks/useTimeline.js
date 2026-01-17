import { useState, useRef, useEffect, useCallback } from 'react';
import { parseTimeline, AVAILABLE_LESSONS } from '../parser/TimeLineParser';
import { generateRandomTimeline } from '../core/NoteGenerator';
import { parsePitchToMidi, midiToVexKey } from '../core/musicUtils';
import { TIMING, MIDI } from '../core/constants';

const DEFAULT_TEMPO = 80;

export function useTimeline(mode, selectedLessonId, settings, onTimelineLoaded) {
    const timelineRef = useRef([]);
    const [lessonMeta, setLessonMeta] = useState({ tempo: DEFAULT_TEMPO, beatsPerMeasure: 4 });
    const [timelineVersion, setTimelineVersion] = useState(0);
    
    // We use a ref for the callback to avoid dependency loops if the user passes an unstable function
    const onLoadedRef = useRef(onTimelineLoaded);
    useEffect(() => { onLoadedRef.current = onTimelineLoaded; }, [onTimelineLoaded]);

    const loadTimeline = useCallback(() => {
        let rawTimeline;
        let newMeta = { tempo: DEFAULT_TEMPO, beatsPerMeasure: 4 };

        if (mode === 'lesson') {
            const useJson = true; 
            const lesson = AVAILABLE_LESSONS.find(l => l.id === selectedLessonId) || AVAILABLE_LESSONS[0];
            const lessonData = useJson ? lesson.data : lesson.xml;
            
            newMeta = { 
                tempo: lessonData.tempo || DEFAULT_TEMPO, 
                beatsPerMeasure: lessonData.timeSignature?.numerator || 4 
            };
            
            rawTimeline = parseTimeline(useJson ? 'json' : 'musicxml', lessonData, newMeta.tempo);
        } else {
            newMeta = { tempo: DEFAULT_TEMPO, beatsPerMeasure: 4 };
            
            const { enabledDurations, minNote, maxNote, includeSharps } = settings;
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
        setTimelineVersion(v => v + 1);
        
        if (onLoadedRef.current) {
            onLoadedRef.current(newMeta, mode);
        }
    }, [mode, selectedLessonId, settings]);

    return {
        timelineRef,
        lessonMeta,
        timelineVersion,
        loadTimeline
    };
}
