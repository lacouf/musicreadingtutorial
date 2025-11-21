import { Renderer, Stave, StaveNote, Voice, Formatter } from 'vexflow';

function pitchToMidi(pitch) {
    // e.g., C4 -> 60
    const match = pitch.match(/^([A-G]#?)(-?\d+)$/);
    if (!match) return null;
    const step = match[1];
    const octave = parseInt(match[2], 10);
    const map = { C: 0, 'C#': 1, D: 2, 'D#': 3, E: 4, F: 5, 'F#': 6, G: 7, 'G#': 8, A: 9, 'A#': 10, B: 11 };
    return (octave + 1) * 12 + map[step];
}

export async function renderScoreToCanvases(stavesCanvas, notesCanvas, timeline, opts = {}) {
    const { viewportWidth, viewportHeight } = opts;

    // --- Render static staves ---
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

    // --- Render scrolling notes ---
    const notesWidth = Math.max(2400, (timeline[timeline.length - 1]?.start + 5) * 120);
    notesCanvas.width = notesWidth;
    notesCanvas.height = viewportHeight;
    const notesRenderer = new Renderer(notesCanvas, Renderer.Backends.CANVAS);
    const notesCtx = notesRenderer.getContext();
    notesCtx.clearRect(0, 0, notesCanvas.width, notesCanvas.height);

    const notesStaveWidth = notesCanvas.width - marginLeft - 20;
    const notesTrebleStave = new Stave(marginLeft, trebleY, notesStaveWidth);
    const notesBassStave = new Stave(marginLeft, bassY, notesStaveWidth);

    const trebleNotes = [];
    const bassNotes = [];

    for (const item of timeline) {
        const midi = pitchToMidi(item.pitch);
        if (midi >= 60) trebleNotes.push(item);
        else bassNotes.push(item);
    }

    function makeVexNotes(items) {
        return items.map(n => {
            const m = n.pitch.match(/^([A-G]#?)(-?\d+)$/);
            const step = m ? m[1].toLowerCase() : 'c';
            const oct = m ? m[2] : '4';
            const dur = n.dur >= 1.5 ? "h" : "q"; // naive duration

            return new StaveNote({
                keys: [`${step}/${oct}`],
                duration: dur
            });
        });
    }

    const trebleVexNotes = makeVexNotes(trebleNotes);
    const bassVexNotes = makeVexNotes(bassNotes);

    const trebleVoice = new Voice({ num_beats: 4, beat_value: 4 });
    trebleVoice.addTickables(trebleVexNotes);

    const bassVoice = new Voice({ num_beats: 4, beat_value: 4 });
    bassVoice.addTickables(bassVexNotes);

    Formatter.FormatAndDraw(notesCtx, notesTrebleStave, trebleVexNotes);
    Formatter.FormatAndDraw(notesCtx, notesBassStave, bassVexNotes);
}
