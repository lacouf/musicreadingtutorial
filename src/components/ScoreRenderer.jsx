// javascript
// File: src/components/ScoreRenderer.jsx
import { Renderer, Stave, StaveNote, TickContext } from 'vexflow';
import { parsePitchToMidi, STRICT_WINDOW_SECONDS } from '../core/musicUtils';

export async function renderScoreToCanvases(stavesCanvas, notesCanvas, timeline = [], opts = {}) {
    const { viewportWidth = 800, viewportHeight = 220, pixelsPerSecond = 120, playheadX = 300, minMidi = 0, maxMidi = 127, showValidTiming = false } = opts;

    // --- Static staves on the staves canvas (unchanging) ---
    stavesCanvas.width = viewportWidth;
    stavesCanvas.height = viewportHeight;
    const stavesRenderer = new Renderer(stavesCanvas, Renderer.Backends.CANVAS);
    const stavesCtx = stavesRenderer.getContext();
    stavesCtx.clearRect(0, 0, stavesCanvas.width, stavesCanvas.height);

    const marginLeft = 20;
    const staveWidth = stavesCanvas.width - marginLeft;
    const trebleY = 20;
    const bassY = 120;

    const trebleStave = new Stave(marginLeft, trebleY, staveWidth);
    trebleStave.addClef("treble").addTimeSignature("4/4");
    trebleStave.setContext(stavesCtx).draw();

    const bassStave = new Stave(marginLeft, bassY, staveWidth);
    bassStave.addClef("bass").addTimeSignature("4/4");
    bassStave.setContext(stavesCtx).draw();

    stavesCtx.beginPath();
    stavesCtx.strokeStyle = "#000";
    stavesCtx.lineWidth = 2;
    stavesCtx.moveTo(marginLeft - 10, trebleY);
    stavesCtx.lineTo(marginLeft - 10, bassY + 60);
    stavesCtx.stroke();

    // --- Filter timeline to the requested midi range ---
    const filteredTimeline = timeline.filter(ev => {
        const midi = (Number.isInteger(ev.midi) ? ev.midi : parsePitchToMidi(ev.pitch || ev.key || ''));
        if (midi == null) return false; // drop events without a resolvable midi
        return midi >= (Number.isFinite(minMidi) ? minMidi : 0) && midi <= (Number.isFinite(maxMidi) ? maxMidi : 127);
    });

    // --- Notes canvas: size to timeline duration and draw notes at absolute X positions ---
    const lastTime = filteredTimeline.length ? Math.max(...filteredTimeline.map(t => (t.start || 0) + (t.dur || 0))) : 0;
    notesCanvas.width = Math.max(2400, Math.ceil(lastTime * pixelsPerSecond) + marginLeft + 40);
    notesCanvas.height = viewportHeight;

    const notesRenderer = new Renderer(notesCanvas, Renderer.Backends.CANVAS);
    const notesCtx = notesRenderer.getContext();
    notesCtx.clearRect(0, 0, notesCanvas.width, notesCanvas.height);

    const notesStaveWidth = notesCanvas.width - marginLeft - 20;
    const notesTrebleStave = new Stave(marginLeft, trebleY, notesStaveWidth);
    const notesBassStave = new Stave(marginLeft, bassY, notesStaveWidth);
    notesTrebleStave.setContext(notesCtx).draw();
    notesBassStave.setContext(notesCtx).draw();

    // compute initial lead so start===0 appears at playheadX
    // Note: VexFlow StaveNotes appear to render with an intrinsic offset relative to the TickContext X.
    // User found 55 to be the optimal offset for alignment.
    const vexFlowIntrinsicOffset = 42;
    // initialLeadPixels should simply align start=0 to playheadX (Logic/Visual target)
    const initialLeadPixels = Math.max(0, playheadX - marginLeft);

    // split timeline into treble/bass using midi (prefer ev.midi when present)
    const trebleItems = [];
    const bassItems = [];
    for (const ev of filteredTimeline) {
        const midi = Number.isInteger(ev.midi) ? ev.midi : parsePitchToMidi(ev.pitch || ev.key || '');
        if (midi >= 60) trebleItems.push(ev);
        else bassItems.push(ev);
    }

    function makeVexNoteFrom(ev) {
        const raw = (ev.pitch || ev.key || '').toString().trim();
        // Accept formats like: "C4", "C/4", "c4", "c/4", "C#4", "c#/4"
        const m = raw.match(/^([A-Ga-g]#?)\/?(-?\d+)$/);
        const step = m ? m[1].toLowerCase() : 'c';
        const oct = m ? m[2] : '4';
        const dur = (ev.dur || ev.duration || 0) >= 1.5 ? "h" : "q";
        return new StaveNote({ keys: [`${step}/${oct}`], duration: dur });
    }

    // draw notes by forcing TickContext X from timeline start times + initial lead
    const strictWindowSeconds = STRICT_WINDOW_SECONDS;
    const windowPixels = strictWindowSeconds * pixelsPerSecond;

    for (const ev of trebleItems) {
        const note = makeVexNoteFrom(ev);
        // logicX: Where the note SHOULD be visually to match the playhead at time t
        const logicX = marginLeft + (ev.start || 0) * pixelsPerSecond + initialLeadPixels;
        
        // vexX: Where we tell VexFlow to draw to achieve logicX (compensating for intrinsic offset)
        const vexX = logicX - vexFlowIntrinsicOffset;

        // Debug: Draw validation window bars centered on Logic X
        if (showValidTiming) {
            notesCtx.fillStyle = "rgba(0, 255, 0, 0.3)";
            notesCtx.fillRect(logicX - windowPixels, trebleY, windowPixels * 2, 80);
            notesCtx.fillStyle = "green";
            notesCtx.fillRect(logicX - windowPixels, trebleY, 2, 80);
            notesCtx.fillRect(logicX + windowPixels, trebleY, 2, 80);
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
            notesCtx.fillStyle = "rgba(0, 255, 0, 0.3)";
            notesCtx.fillRect(logicX - windowPixels, bassY, windowPixels * 2, 80);
            notesCtx.fillStyle = "green";
            notesCtx.fillRect(logicX - windowPixels, bassY, 2, 80);
            notesCtx.fillRect(logicX + windowPixels, bassY, 2, 80);
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