// javascript
// File: src/components/ScoreRenderer.jsx
import { Renderer, Stave, StaveNote, TickContext } from 'vexflow';
import { parsePitchToMidi, STRICT_WINDOW_SECONDS } from '../core/musicUtils';
import { RENDERING, MIDI, COLORS } from '../core/constants';

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
    // User found 55 to be the optimal offset for alignment.
    const vexFlowIntrinsicOffset = RENDERING.VEXFLOW_INTRINSIC_OFFSET;
    // initialLeadPixels should simply align start=0 to playheadX (Logic/Visual target)
    const initialLeadPixels = Math.max(0, playheadX - marginLeft);

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
        const dur = (ev.dur || ev.duration || 0) >= RENDERING.HALF_NOTE_DURATION_THRESHOLD ? "h" : "q";
        return new StaveNote({ keys: [`${step}/${oct}`], duration: dur });
    }

    // draw notes by forcing TickContext X from timeline start times + initial lead
    const windowPixels = STRICT_WINDOW_SECONDS * pixelsPerSecond;

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
        note.setTickContext(tc);

        note.setStave(notesBassStave);
        note.setContext(notesCtx);
        note.draw(notesCtx, notesBassStave);
    }

    return Promise.resolve();
}