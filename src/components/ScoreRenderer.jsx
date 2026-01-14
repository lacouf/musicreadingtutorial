// javascript
// File: src/components/ScoreRenderer.jsx
import { Renderer, Stave, StaveNote, TickContext, Dot } from 'vexflow';
import { parsePitchToMidi, STRICT_WINDOW_SECONDS } from '../core/musicUtils';
import { RENDERING, MIDI, COLORS, TIMING } from '../core/constants';
import { beatsToVexDuration } from '../core/durationConverter';

export async function renderScoreToCanvases(stavesCanvas, notesCanvas, timeline = [], opts = {}) {
    const { 
        viewportWidth = RENDERING.VIEWPORT_WIDTH, 
        viewportHeight = RENDERING.VIEWPORT_HEIGHT, 
        pixelsPerSecond = RENDERING.PIXELS_PER_SECOND, 
        playheadX = RENDERING.PLAYHEAD_X, 
        minMidi = MIDI.MIN_MIDI, 
        maxMidi = MIDI.MAX_MIDI, 
        showValidTiming = false 
    } = opts;

    // --- Static staves on the staves canvas (unchanging) ---
    stavesCanvas.width = viewportWidth;
    stavesCanvas.height = viewportHeight;
    const stavesRenderer = new Renderer(stavesCanvas, Renderer.Backends.CANVAS);
    const stavesCtx = stavesRenderer.getContext();
    stavesCtx.clearRect(0, 0, stavesCanvas.width, stavesCanvas.height);

    const marginLeft = RENDERING.MARGIN_LEFT;
    const staveWidth = stavesCanvas.width - marginLeft;
    const trebleY = RENDERING.TREBLE_Y;
    const bassY = RENDERING.BASS_Y;

    const trebleStave = new Stave(marginLeft, trebleY, staveWidth);
    trebleStave.addClef("treble").addTimeSignature("4/4");
    trebleStave.setContext(stavesCtx).draw();

    const bassStave = new Stave(marginLeft, bassY, staveWidth);
    bassStave.addClef("bass").addTimeSignature("4/4");
    bassStave.setContext(stavesCtx).draw();

    stavesCtx.beginPath();
    stavesCtx.strokeStyle = COLORS.BLACK;
    stavesCtx.lineWidth = RENDERING.STAVE_LINE_WIDTH;
    stavesCtx.moveTo(marginLeft - RENDERING.STAVE_CONNECTOR_OFFSET, trebleY);
    stavesCtx.lineTo(marginLeft - RENDERING.STAVE_CONNECTOR_OFFSET, bassY + RENDERING.STAVE_CONNECTOR_BASS_EXTRA);
    stavesCtx.stroke();

    // --- Determine Tempo and Time Signature for measure calculation ---
    // Note: In Phase 1 we ensured every note has timeSec.
    // We assume single tempo/timeSig for now as per plan.
    const tempo = opts.tempo || 60; 
    const beatsPerMeasure = opts.beatsPerMeasure || 4;
    const secPerBeat = TIMING.SECONDS_IN_MINUTE / tempo;
    const secPerMeasure = beatsPerMeasure * secPerBeat;

    // --- Filter timeline to the requested midi range ---
    const filteredTimeline = timeline.filter(ev => {
        const midi = (Number.isInteger(ev.midi) ? ev.midi : parsePitchToMidi(ev.pitch || ev.key || ''));
        if (midi == null) return false; // drop events without a resolvable midi
        return midi >= (Number.isFinite(minMidi) ? minMidi : MIDI.MIN_MIDI) && midi <= (Number.isFinite(maxMidi) ? maxMidi : MIDI.MAX_MIDI);
    });

    // --- Notes canvas: size to timeline duration and draw notes at absolute X positions ---
    const lastTime = filteredTimeline.length ? Math.max(...filteredTimeline.map(t => (t.start || 0) + (t.dur || 0))) : 0;
    notesCanvas.width = Math.max(RENDERING.MIN_NOTES_CANVAS_WIDTH, Math.ceil(lastTime * pixelsPerSecond) + marginLeft + RENDERING.NOTES_CANVAS_RIGHT_PADDING);
    notesCanvas.height = viewportHeight;

    const notesRenderer = new Renderer(notesCanvas, Renderer.Backends.CANVAS);
    const notesCtx = notesRenderer.getContext();
    notesCtx.clearRect(0, 0, notesCanvas.width, notesCanvas.height);

    const notesStaveWidth = notesCanvas.width - marginLeft - RENDERING.STAVE_WIDTH_REDUCTION;
    const notesTrebleStave = new Stave(marginLeft, trebleY, notesStaveWidth);
    const notesBassStave = new Stave(marginLeft, bassY, notesStaveWidth);
    notesTrebleStave.setContext(notesCtx).draw();
    notesBassStave.setContext(notesCtx).draw();

    // compute initial lead so start===0 appears at playheadX
    // Note: VexFlow StaveNotes appear to render with an intrinsic offset relative to the TickContext X.
    const vexFlowIntrinsicOffset = RENDERING.VEXFLOW_INTRINSIC_OFFSET;
    const initialLeadPixels = Math.max(0, playheadX - marginLeft);

    // --- Draw Barlines ---
    const totalDurationSeconds = lastTime;
    const numMeasures = Math.ceil(totalDurationSeconds / secPerMeasure) + 1;
    
    notesCtx.strokeStyle = COLORS.BLACK;
    notesCtx.lineWidth = 1;
    notesCtx.fillStyle = COLORS.BLACK;
    notesCtx.font = "italic 12px serif";

    for (let i = 0; i < numMeasures; i++) {
        const barTime = i * secPerMeasure;
        const barX = marginLeft + barTime * pixelsPerSecond + initialLeadPixels - RENDERING.BARLINE_OFFSET_X;
        
        // Draw vertical barline across both staves
        notesCtx.beginPath();
        notesCtx.moveTo(barX, trebleY);
        notesCtx.lineTo(barX, bassY + 80); // 80 is roughly the height of a stave
        notesCtx.stroke();

        // Draw measure number
        notesCtx.fillText(`${i + 1}`, barX + 5, trebleY - 5);
    }

    // split timeline into treble/bass using midi (prefer ev.midi when present)
    const trebleItems = [];
    const bassItems = [];
    for (const ev of filteredTimeline) {
        const midi = Number.isInteger(ev.midi) ? ev.midi : parsePitchToMidi(ev.pitch || ev.key || '');
        if (midi >= MIDI.C4_MIDI) trebleItems.push(ev);
        else bassItems.push(ev);
    }

    function makeVexNoteFrom(ev) {
        const raw = (ev.pitch || ev.key || '').toString().trim();
        // Accept formats like: "C4", "C/4", "c4", "c/4", "C#4", "c#/4"
        const m = raw.match(/^([A-Ga-g]#?)\/?(-?\d+)$/);
        const step = m ? m[1].toLowerCase() : 'c';
        const oct = m ? m[2] : '4';
        
        // Use explicit durationBeats if available, otherwise estimate from duration in seconds (assuming 60bpm for legacy)
        // If durationBeats is missing, we might assume 1 beat = 1 second for fallback, or just default to 1
        const beats = ev.durationBeats || (ev.dur ? ev.dur / (60/60) : 1);
        
        const { duration, dots } = beatsToVexDuration(beats);
        
        const note = new StaveNote({ keys: [`${step}/${oct}`], duration: duration });
        if (dots > 0) {
            note.addModifier(new Dot(), 0);
        }
        return note;
    }

    // draw notes by forcing TickContext X from timeline start times + initial lead
    const windowSeconds = TIMING.STRICT_BEAT_TOLERANCE * secPerBeat;
    const windowPixels = windowSeconds * pixelsPerSecond;

    for (const ev of trebleItems) {
        const note = makeVexNoteFrom(ev);
        // logicX: Where the note SHOULD be visually to match the playhead at time t
        const logicX = marginLeft + (ev.start || 0) * pixelsPerSecond + initialLeadPixels;
        
        // vexX: Where we tell VexFlow to draw to achieve logicX (compensating for intrinsic offset)
        const vexX = logicX - vexFlowIntrinsicOffset;

        // Debug: Draw validation window bars centered on Logic X
        if (showValidTiming) {
            notesCtx.fillStyle = COLORS.VALIDATION_GREEN;
            notesCtx.fillRect(logicX - windowPixels, trebleY, windowPixels * 2, RENDERING.VALIDATION_WINDOW_HEIGHT);
            notesCtx.fillStyle = COLORS.GREEN;
            notesCtx.fillRect(logicX - windowPixels, trebleY, RENDERING.VALIDATION_WINDOW_LINE_WIDTH, RENDERING.VALIDATION_WINDOW_HEIGHT);
            notesCtx.fillRect(logicX + windowPixels, trebleY, RENDERING.VALIDATION_WINDOW_LINE_WIDTH, RENDERING.VALIDATION_WINDOW_HEIGHT);
        }

        const tc = new TickContext();
        tc.setX(vexX);
        tc.setPadding(0);
        tc.addTickable(note);
        tc.preFormat();
        note.setTickContext(tc);

        note.setStave(notesTrebleStave);
        note.setContext(notesCtx);
        note.draw(notesCtx, notesTrebleStave);
    }

    for (const ev of bassItems) {
        const note = makeVexNoteFrom(ev);
        // logicX: Where the note SHOULD be visually to match the playhead at time t
        const logicX = marginLeft + (ev.start || 0) * pixelsPerSecond + initialLeadPixels;
        
        // vexX: Where we tell VexFlow to draw to achieve logicX (compensating for intrinsic offset)
        const vexX = logicX - vexFlowIntrinsicOffset;

        // Debug: Draw validation window bars centered on Logic X
        if (showValidTiming) {
            notesCtx.fillStyle = COLORS.VALIDATION_GREEN;
            notesCtx.fillRect(logicX - windowPixels, bassY, windowPixels * 2, RENDERING.VALIDATION_WINDOW_HEIGHT);
            notesCtx.fillStyle = COLORS.GREEN;
            notesCtx.fillRect(logicX - windowPixels, bassY, RENDERING.VALIDATION_WINDOW_LINE_WIDTH, RENDERING.VALIDATION_WINDOW_HEIGHT);
            notesCtx.fillRect(logicX + windowPixels, bassY, RENDERING.VALIDATION_WINDOW_LINE_WIDTH, RENDERING.VALIDATION_WINDOW_HEIGHT);
        }

        const tc = new TickContext();
        tc.setX(vexX);
        tc.setPadding(0);
        tc.addTickable(note);
        tc.preFormat();
        note.setTickContext(tc);

        note.setStave(notesBassStave);
        note.setContext(notesCtx);
        note.draw(notesCtx, notesBassStave);
    }

    return Promise.resolve();
}