import { Renderer, Stave, StaveNote, TickContext, Dot, Accidental } from 'vexflow';
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
        return midi != null && midi >= minMidi && midi <= maxMidi;
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

    function makeVexNoteFrom(ev) {
        const raw = (ev.pitch || ev.key || '').toString().trim();
        const m = raw.match(/^([A-Ga-g])([#b]?)\/?(-?\d+)$/);
        if (!m) return null;
        
        const step = m[1].toLowerCase();
        const acc = m[2];
        const oct = m[3];
        const { duration, dots } = beatsToVexDuration(ev.durationBeats || 1);
        
        const note = new StaveNote({ keys: [`${step}/${oct}`], duration });
        if (dots > 0) note.addModifier(new Dot(), 0);
        if (acc) note.addModifier(new Accidental(acc), 0);
        return note;
    }

    for (const ev of filteredTimeline) {
        const midi = Number.isInteger(ev.midi) ? ev.midi : parsePitchToMidi(ev.pitch || ev.key || '');
        const isTreble = midi >= MIDI.C4_MIDI;
        const targetStave = isTreble ? notesTrebleStave : notesBassStave;
        const staveY = isTreble ? trebleY : bassY;
        const note = makeVexNoteFrom(ev);
        if (!note) continue;

        const logicX = calculateNoteX(ev.measure || 1, ev.beat || 1, ev.beatFraction || 0, pixelsPerBeat, marginLeft, beatsPerMeasure) + initialLeadPixels;
        
        if (showValidTiming) {
            notesCtx.fillStyle = COLORS.VALIDATION_GREEN;
            notesCtx.fillRect(logicX - windowPixels, staveY, windowPixels * 2, RENDERING.VALIDATION_WINDOW_HEIGHT);
            notesCtx.fillStyle = COLORS.GREEN;
            notesCtx.fillRect(logicX - windowPixels, staveY, RENDERING.VALIDATION_WINDOW_LINE_WIDTH, RENDERING.VALIDATION_WINDOW_HEIGHT);
            notesCtx.fillRect(logicX + windowPixels, staveY, RENDERING.VALIDATION_WINDOW_LINE_WIDTH, RENDERING.VALIDATION_WINDOW_HEIGHT);
        }

        const vexX = logicX - RENDERING.VEXFLOW_INTRINSIC_OFFSET;

        const tc = new TickContext();
        tc.addTickable(note).preFormat().setX(vexX);
        note.setContext(notesCtx).setStave(targetStave);
        note.draw();
    }

    return Promise.resolve();
}
