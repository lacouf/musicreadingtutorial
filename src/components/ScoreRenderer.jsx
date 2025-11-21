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

export async function renderScoreToCanvas(offscreenCanvas, timeline, opts = {}) {
    const width = offscreenCanvas.width;
    const height = offscreenCanvas.height;

    // --- Create direct VexFlow renderer (safe for offscreen canvases) ---
    const renderer = new Renderer(offscreenCanvas, Renderer.Backends.CANVAS);
    const ctx = renderer.getContext();

    // Clear previous drawing
    ctx.clearRect(0, 0, width, height);

    // --- Basic layout ---
    const marginLeft = 20;
    const staveWidth = width - marginLeft - 20;

    const trebleY = 20;
    const bassY = 120;

    // --- Draw staves manually ---
    const trebleStave = new Stave(marginLeft, trebleY, staveWidth);
    trebleStave.addClef("treble").addTimeSignature("4/4");
    trebleStave.setContext(ctx).draw();

    const bassStave = new Stave(marginLeft, bassY, staveWidth);
    bassStave.addClef("bass").addTimeSignature("4/4");
    bassStave.setContext(ctx).draw();

    // --- Split notes by register ---
    const trebleNotes = [];
    const bassNotes = [];

    for (const item of timeline) {
        const midi = pitchToMidi(item.pitch);
        if (midi >= 60) trebleNotes.push(item);
        else bassNotes.push(item);
    }

    // --- Convert note objects to VexFlow StaveNotes ---
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

    // --- Create voices ---
    const trebleVoice = new Voice({ num_beats: 4, beat_value: 4 });
    trebleVoice.addTickables(trebleVexNotes);

    const bassVoice = new Voice({ num_beats: 4, beat_value: 4 });
    bassVoice.addTickables(bassVexNotes);

    // --- Format voices on their respective staves ---
    Formatter.FormatAndDraw(ctx, trebleStave, trebleVexNotes);
    Formatter.FormatAndDraw(ctx, bassStave, bassVexNotes);

    // --- (Optional) Connect staves with a brace/line ---
    ctx.beginPath();
    ctx.strokeStyle = "#000";
    ctx.lineWidth = 2;
    ctx.moveTo(marginLeft - 10, trebleY);
    ctx.lineTo(marginLeft - 10, bassY + 60);
    ctx.stroke();
}
