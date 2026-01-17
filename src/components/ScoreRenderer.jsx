import { Renderer, Stave, StaveNote, TickContext, Dot, Accidental, Beam } from 'vexflow';
import { parsePitchToMidi, STRICT_WINDOW_SECONDS } from '../core/musicUtils';
import { RENDERING, MIDI, COLORS, TIMING } from '../core/constants';
import { beatsToVexDuration } from '../core/durationConverter';
import { calculateNoteX } from '../core/layoutUtils';

export async function renderScoreToCanvases(stavesCanvas, notesCanvas, timeline = [], opts = {}) {
    const { 
        viewportWidth = RENDERING.VIEWPORT_WIDTH, 
        viewportHeight = RENDERING.VIEWPORT_HEIGHT, 
        pixelsPerBeat = RENDERING.PIXELS_PER_BEAT,
        playheadX = RENDERING.PLAYHEAD_X, 
        minMidi = MIDI.MIN_MIDI, 
        maxMidi = MIDI.MAX_MIDI, 
        showValidTiming = false,
        beatTolerance = TIMING.STRICT_BEAT_TOLERANCE
    } = opts;

    if (!viewportWidth || viewportWidth <= 0) return Promise.resolve();

    stavesCanvas.width = viewportWidth;
    stavesCanvas.height = viewportHeight;
    const stavesRenderer = new Renderer(stavesCanvas, Renderer.Backends.CANVAS);
    const stavesCtx = stavesRenderer.getContext();
    stavesCtx.clearRect(0, 0, stavesCanvas.width, stavesCanvas.height);

    const marginLeft = RENDERING.MARGIN_LEFT;
    const staveWidth = stavesCanvas.width - marginLeft;
    const trebleY = RENDERING.TREBLE_Y;
    const bassY = RENDERING.BASS_Y;

    const trebleStave = new Stave(marginLeft, trebleY, staveWidth).addClef("treble").addTimeSignature("4/4");
    trebleStave.setContext(stavesCtx).draw();
    const bassStave = new Stave(marginLeft, bassY, staveWidth).addClef("bass").addTimeSignature("4/4");
    bassStave.setContext(stavesCtx).draw();

    const tempo = opts.tempo || 60; 
    const beatsPerMeasure = opts.beatsPerMeasure || 4;
    const secPerBeat = TIMING.SECONDS_IN_MINUTE / tempo;

    const filteredTimeline = timeline.filter(ev => {
        const midi = (Number.isInteger(ev.midi) ? ev.midi : parsePitchToMidi(ev.pitch || ev.key || ''));
        if (midi == null || midi < minMidi || midi > maxMidi) {
            return false;
        }
        return true;
    });

    const lastNote = filteredTimeline[filteredTimeline.length - 1];
    const totalBeats = lastNote 
        ? ((lastNote.measure || 1) - 1) * beatsPerMeasure + ((lastNote.beat || 1) - 1) + (lastNote.beatFraction || 0) + (lastNote.durationBeats || 0)
        : 20;

    notesCanvas.width = Math.max(2400, Math.ceil(totalBeats * pixelsPerBeat) + 500);
    notesCanvas.height = viewportHeight;
    const notesRenderer = new Renderer(notesCanvas, Renderer.Backends.CANVAS);
    const notesCtx = notesRenderer.getContext();
    notesCtx.clearRect(0, 0, notesCanvas.width, notesCanvas.height);

    const notesTrebleStave = new Stave(marginLeft, trebleY, notesCanvas.width - marginLeft);
    notesTrebleStave.setContext(notesCtx).draw();
    const notesBassStave = new Stave(marginLeft, bassY, notesCanvas.width - marginLeft);
    notesBassStave.setContext(notesCtx).draw();

    const initialLeadPixels = Math.max(0, playheadX - marginLeft);
    const windowPixels = beatTolerance * pixelsPerBeat;

    for (let i = 0; i < Math.ceil(totalBeats / beatsPerMeasure) + 1; i++) {
        const barX = marginLeft + (i * beatsPerMeasure * pixelsPerBeat) + initialLeadPixels - RENDERING.BARLINE_OFFSET_X;
        notesCtx.strokeStyle = "#000";
        notesCtx.beginPath();
        notesCtx.moveTo(barX, trebleY);
        notesCtx.lineTo(barX, bassY + 80);
        notesCtx.stroke();
    }

    // Group events by start time to form chords
    const groupedEvents = new Map();
    for (const ev of filteredTimeline) {
        const timeKey = `${ev.measure}-${ev.beat}-${ev.beatFraction}`;
        if (!groupedEvents.has(timeKey)) {
            groupedEvents.set(timeKey, []);
        }
        groupedEvents.get(timeKey).push(ev);
    }

    // Store notes grouped by measure for beaming
    // Map<measureIndex, { treble: StaveNote[], bass: StaveNote[] }>
    const notesByMeasure = new Map();

    const getMeasureGroup = (m) => {
        if (!notesByMeasure.has(m)) {
            notesByMeasure.set(m, { treble: [], bass: [] });
        }
        return notesByMeasure.get(m);
    };

    // Process each group (chord)
    for (const [key, group] of groupedEvents) {
        if (group.length === 0) continue;

        // Representative event for positioning
        const leadEv = group[0];
        const measureIndex = leadEv.measure || 1;
        
        // Split into treble and bass notes
        const trebleNotes = [];
        const bassNotes = [];

        for (const ev of group) {
            const midi = Number.isInteger(ev.midi) ? ev.midi : parsePitchToMidi(ev.pitch || ev.key || '');
            if (midi >= MIDI.C4_MIDI) trebleNotes.push(ev);
            else bassNotes.push(ev);
        }

        const logicX = calculateNoteX(leadEv.measure || 1, leadEv.beat || 1, leadEv.beatFraction || 0, pixelsPerBeat, marginLeft, beatsPerMeasure) + initialLeadPixels;
        const vexX = logicX - RENDERING.VEXFLOW_INTRINSIC_OFFSET;

        // Helper to create and collect a chord (or single note)
        const createChord = (items, stave, staveY, targetArray) => {
            if (items.length === 0) return;
            
            const { duration, dots } = beatsToVexDuration(items[0].durationBeats || 1);
            
            const keys = [];
            const modifiers = [];

            items.forEach((ev, index) => {
                const raw = (ev.pitch || ev.key || '').toString().trim();
                const m = raw.match(/^([A-Ga-g])([#b]?)\/?(-?\d+)$/);
                if (m) {
                    const step = m[1].toLowerCase();
                    const acc = m[2];
                    const oct = m[3];
                    keys.push(`${step}/${oct}`);
                    if (acc) {
                        modifiers.push({ index, type: acc });
                    }
                }
            });

            if (keys.length === 0) return;

            const note = new StaveNote({ keys, duration });
            if (dots > 0) note.addModifier(new Dot(), 0);

            modifiers.forEach(mod => {
                note.addModifier(new Accidental(mod.type), mod.index);
            });

            // Draw validation window immediately (independent of VexFlow rendering)
            if (showValidTiming) {
                notesCtx.fillStyle = COLORS.VALIDATION_GREEN;
                notesCtx.fillRect(logicX - windowPixels, staveY, windowPixels * 2, RENDERING.VALIDATION_WINDOW_HEIGHT);
                notesCtx.fillStyle = COLORS.GREEN;
                notesCtx.fillRect(logicX - windowPixels, staveY, RENDERING.VALIDATION_WINDOW_LINE_WIDTH, RENDERING.VALIDATION_WINDOW_HEIGHT);
                notesCtx.fillRect(logicX + windowPixels, staveY, RENDERING.VALIDATION_WINDOW_LINE_WIDTH, RENDERING.VALIDATION_WINDOW_HEIGHT);
            }

            // Position note
            const tc = new TickContext();
            tc.addTickable(note).preFormat().setX(vexX);
            note.setContext(notesCtx).setStave(stave);
            
            // Collect for beaming and later drawing
            targetArray.push(note);
        };

        const measureGroup = getMeasureGroup(measureIndex);
        createChord(trebleNotes, notesTrebleStave, trebleY, measureGroup.treble);
        createChord(bassNotes, notesBassStave, bassY, measureGroup.bass);
    }

    // Generate beams and draw everything
    for (const [measure, group] of notesByMeasure) {
        try {
            // Treble
            if (group.treble.length > 0) {
                let beams = [];
                try {
                    beams = Beam.generateBeams(group.treble);
                } catch (e) {
                    console.warn(`Treble beaming failed for measure ${measure}:`, e);
                }
                group.treble.forEach(note => note.draw());
                beams.forEach(beam => beam.setContext(notesCtx).draw());
            }

            // Bass
            if (group.bass.length > 0) {
                let beams = [];
                try {
                    beams = Beam.generateBeams(group.bass);
                } catch (e) {
                    console.warn(`Bass beaming failed for measure ${measure}:`, e);
                }
                group.bass.forEach(note => note.draw());
                beams.forEach(beam => beam.setContext(notesCtx).draw());
            }
        } catch (e) {
            console.error(`Error rendering measure ${measure}:`, e);
        }
    }

    return Promise.resolve();
}
