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
    const [lessonContent, setLessonContent] = useState(null);
    
    // We use a ref for the callback to avoid dependency loops if the user passes an unstable function
    const onLoadedRef = useRef(onTimelineLoaded);
    useEffect(() => { onLoadedRef.current = onTimelineLoaded; }, [onTimelineLoaded]);

    const loadTimeline = useCallback(async () => {
        let rawTimeline;
        let newMeta = { tempo: DEFAULT_TEMPO, beatsPerMeasure: 4 };

        if (mode === 'lesson') {
            const lesson = AVAILABLE_LESSONS.find(l => l.id === selectedLessonId) || AVAILABLE_LESSONS[0];
            let lessonData = lesson.data;
            let format = 'json';

            if (lesson.file) {
                try {
                    const response = await fetch(lesson.file);
                    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
                    
                    lessonData = await response.text();
                    
                    // Debug: check if we got HTML instead of XML
                    if (lessonData.trim().startsWith('<!DOCTYPE html') || lessonData.trim().startsWith('<html')) {
                        console.error('FETCH ERROR: Received HTML instead of XML. This usually means a 404 occurred and the server returned index.html.');
                        return;
                    }

                    format = 'musicxml';
                } catch (error) {
                    console.error('Failed to load lesson file:', error);
                    return;
                }
            } else if (lesson.xml) {
                lessonData = lesson.xml;
                format = 'musicxml';
            }

            setLessonContent(lessonData);
            const useJson = format === 'json';
            
            const parsed = parseTimeline(format, lessonData, DEFAULT_TEMPO);
            rawTimeline = parsed.timeline;
            
            newMeta = { 
                tempo: useJson ? (lessonData.tempo || DEFAULT_TEMPO) : DEFAULT_TEMPO, 
                beatsPerMeasure: parsed.metadata.beatsPerMeasure,
                beatType: parsed.metadata.beatType
            };
        } else {
            setLessonContent(null);
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

        if (!rawTimeline) {
            console.error('No timeline data available!');
            return;
        }

        const normalizedTimeline = rawTimeline.map(ev => {
            const originalPitch = ev.pitch || ev.key || null;
            const pitchSource = ev.midi ?? originalPitch ?? ev.note ?? ev.name ?? ev.vfKey ?? (Array.isArray(ev.keys) ? ev.keys[0] : '') ;
            
            let midi = (typeof pitchSource === 'number' && Number.isFinite(pitchSource)) ? Math.trunc(pitchSource) : parsePitchToMidi(String(pitchSource || ''));
            
            // If we have an original pitch string from the parser (like 'Bb4'), keep it!
            // Only generate a new vfKey/canonicalPitch if we don't have one.
            const vfKey = originalPitch ? originalPitch.replace(/([A-G][#b]?)(-?\d+)/, '$1/$2').toLowerCase() : (midi ? midiToVexKey(midi) : null);
            const canonicalPitch = originalPitch || (midi ? midiToPitch(midi) : null);

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
        lessonContent,
        loadTimeline
    };
}
