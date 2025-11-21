// javascript
// File: src/components/ScoreRenderer.jsx
import { Renderer, Stave, StaveNote, TickContext } from 'vexflow';

function pitchToMidi(pitch) {
    const match = pitch.match(/^([A-G]#?)(-?\d+)$/);
    if (!match) return null;
    const step = match[1];
    const octave = parseInt(match[2], 10);
    const map = { C: 0, 'C#': 1, D: 2, 'D#': 3, E: 4, F: 5, 'F#': 6, G: 7, 'G#': 8, A: 9, 'A#': 10, B: 11 };
    return (octave + 1) * 12 + map[step];
}

export async function renderScoreToCanvases(stavesCanvas, notesCanvas, timeline = [], opts = {}) {
    const { viewportWidth = 800, viewportHeight = 220, pixelsPerSecond = 120, playheadX = 300 } = opts;

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

    // --- Notes canvas: size to timeline duration and draw notes at absolute X positions ---
    const lastTime = timeline.length ? Math.max(...timeline.map(t => (t.start || 0) + (t.dur || 0))) : 0;
    const notesWidth = Math.max(2400, Math.ceil(lastTime * pixelsPerSecond) + marginLeft + 40);
    notesCanvas.width = notesWidth;
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
    const initialLeadPixels = Math.max(0, playheadX - marginLeft);

    // split timeline into treble/bass
    const trebleItems = [];
    const bassItems = [];
    for (const ev of timeline) {
        const midi = pitchToMidi(ev.pitch || ev.key || '');
        if (midi >= 60 || midi === null) trebleItems.push(ev);
        else bassItems.push(ev);
    }

    function makeVexNoteFrom(ev) {
        const raw = (ev.pitch || ev.key || '').toString().trim();
        // Accept formats like: "C4", "C/4", "c4", "c/4", "C#4", "c#/4"
        const m = raw.match(/^([A-Ga-g]#?)[\/]?(-?\d+)$/);
        const step = m ? m[1].toLowerCase() : 'c';
        const oct = m ? m[2] : '4';
        const dur = (ev.dur || ev.duration || 0) >= 1.5 ? "h" : "q";
        return new StaveNote({ keys: [`${step}/${oct}`], duration: dur });
    }

    // draw notes by forcing TickContext X from timeline start times + initial lead
    for (const ev of trebleItems) {
        const note = makeVexNoteFrom(ev);
        const x = marginLeft + (ev.start || 0) * pixelsPerSecond + initialLeadPixels;

        const tc = new TickContext();
        tc.setX(x);
        tc.setPadding(0);
        tc.addTickable(note);
        note.setTickContext(tc);

        note.setStave(notesTrebleStave);
        note.setContext(notesCtx);
        note.draw(notesCtx, notesTrebleStave);
    }

    for (const ev of bassItems) {
        const note = makeVexNoteFrom(ev);
        const x = marginLeft + (ev.start || 0) * pixelsPerSecond + initialLeadPixels;

        const tc = new TickContext();
        tc.setX(x);
        tc.setPadding(0);
        tc.addTickable(note);
        note.setTickContext(tc);

        note.setStave(notesBassStave);
        note.setContext(notesCtx);
        note.draw(notesCtx, notesBassStave);
    }

    return Promise.resolve();
}