
const timeline = [
    { start: 0.0, midi: 60 }, // C4
    { start: 5.0, midi: 60 }, // C4
    { start: 10.0, midi: 60 }, // C4
];

function findEventsInWindow(timeSec, windowSec = 0.45) {
    const out = [];
    for (let i = 0; i < timeline.length; i++) {
        const ev = timeline[i];
        const t = ev.start || 0;
        const d = Math.abs(t - timeSec);
        if (d <= windowSec) out.push({ ev, d, index: i });
    }
    out.sort((a, b) => a.d - b.d);
    return out;
}

// Test case 1: Playhead at 5.0. Should match note at 5.0.
console.log("At 5.0:", findEventsInWindow(5.0));

// Test case 2: Playhead at 5.5. Should not match (d=0.5 > 0.45).
console.log("At 5.5:", findEventsInWindow(5.5));

// Test case 3: Playhead at 8.0. Should not match any (nearest is 5.0 and 10.0, d=3.0/2.0).
console.log("At 8.0:", findEventsInWindow(8.0));

// Test case 4: User plays note from "many beats before".
// Playhead at 10.0. User plays note. Matches 10.0.
// Playhead at 10.0. User plays note that was at 5.0?
// Validation is triggered by USER INPUT.
// Input happens at real time T.
// System checks score at time T (mapped to scroll).
// If I am at 10.0, and I play C4. System looks for C4 near 10.0.
// It finds C4 at 10.0.
// It does NOT find C4 at 5.0.
