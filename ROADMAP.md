# Music Master - Roadmap & Future Improvements

This document contains the development roadmap and architectural planning for Music Master. The content represents discussions with ChatGPT and Claude about enhancing the application with proper measure representation, beat-based timing, and accurate note notation.

**Status as of January 2026**: Phase A is complete, Phase B is partially complete, Phase C is in progress.

---

## High-Level Goal

~~Transform Music Master from a time-based scrolling system to a **beat-based, measure-aware** musical notation system.~~ **✅ COMPLETED**

The application has successfully transitioned to a beat-based, measure-aware system. The following capabilities are now operational:
- ✅ Accurate representation of note durations (whole, half, quarter, eighth, sixteenth notes)
- ✅ Proper measure boundaries and barlines
- ✅ Beat-quantized validation for better learning feedback
- ✅ Support for dotted notes
- ⚠️ Partial support for beaming (automatic beaming implemented)
- ❌ Tuplets and complex rhythms (not yet implemented)

---

## Phase A: Data Model & Duration Mapping - ✅ **COMPLETED**

### Implementation Summary

**Git History:**
- Phase 1 (commit 2cf3abd): Extend timeline model with measure, beat, and midi info
- Phase 2 (commit 8f50de0): Implement duration-based notation
- Phase 4 (commit 32e7c70): Implement beat-based validation
- Phase 5 (commit 7b7b9be): Implement beat-based rendering and scrolling

### ✅ Completed Features

#### Data Model
Timeline entries now include all required fields:
```javascript
{
  measure: 1,              // 1-indexed measure number
  beat: 1,                 // 1-indexed beat within measure
  beatFraction: 0,         // 0-1 for subdivisions
  durationBeats: 1.0,      // Float (supports dotted notes)
  timeSec: 0.0,            // Cached/computed from measure/beat + tempo
  pitch: 'C4',
  midi: 60,
  vfKey: 'c/4'
}
```

**Files implemented:**
- `src/parser/TimeLineParser.js` - Outputs measure/beat/durationBeats fields
- `src/core/durationConverter.js` - Converts durationBeats → VexFlow format
- `src/core/layoutUtils.js` - Beat-based positioning utilities
- `src/components/ScoreRenderer.jsx` - Uses duration converter

#### Duration Mapping
Fully functional mapping of beat durations to VexFlow durations:
- Whole notes (`"w"`), half notes (`"h"`), quarter notes (`"q"`)
- Eighth notes (`"8"`), sixteenth notes (`"16"`)
- Dotted note support (1.5 beats → quarter note with dot)

**Implemented in:** `src/core/durationConverter.js`

#### Beat-Based Validation
Replaces time-based tolerance with beat-based tolerance:
```javascript
toleranceSec = beatTolerance * 60 / BPM
```

**Features:**
- Current playhead beat time computation
- Candidate note matching within beat window (configurable via slider in dev tools)
- Feedback in beats: "You're late by 0.3 beats"
- Note duration validation (optional toggle in settings)

**Implemented in:**
- `src/hooks/useMidiSystem.js` - MIDI handler with beat quantization
- `src/App.jsx` - Beat tolerance state management (lines 56, 452-456)

#### Parser Updates
MusicXML parser extracts:
- Measure numbers from `<measure>` elements
- Beat positions from `<note>` elements
- Time signatures from `<attributes><time>` elements
- Duration in beats (relative to divisions)
- Computed `timeSec` from measure/beat using tempo

**Implemented in:** `src/parser/TimeLineParser.js:166-249`

---

## Phase B: Measures, Layout & Barlines - ⚠️ **PARTIALLY COMPLETED**

### ✅ Completed Features

#### Measure Grouping & Barlines
- ✅ Timeline events grouped by measure index
- ✅ Vertical barlines rendered at measure boundaries
- ✅ Notes positioned relative to measure beat positions

**Implemented in:** `src/components/ScoreRenderer.jsx:71-78`

#### Beat → Pixel Mapping
Uses `pixelsPerBeat` (100px/beat) instead of `pixelsPerSecond`:
```javascript
pixelsPerBeat = RENDERING.PIXELS_PER_BEAT  // 100px constant
pixelsPerSecond = pixelsPerBeat * BPM / 60
```

**Implemented in:**
- `src/core/constants.js:7` - PIXELS_PER_BEAT constant
- `src/core/layoutUtils.js` - calculateNoteX(), calculateScrollSpeed()
- `src/App.jsx:113` - Animation loop uses calculateScrollSpeed()

#### VexFlow Formatter Integration
- ✅ Automatic beaming for consecutive eighth/sixteenth notes
- ✅ Notes grouped by measure for proper beam rendering
- ✅ Uses VexFlow's `Beam.generateBeams()` for automatic beaming

**Implemented in:** `src/components/ScoreRenderer.jsx:177-206`

### ❌ Missing Features (TODO)

#### Measure Numbers Display
**Status:** Data exists but not visually displayed
- Measure numbers are tracked in the data model
- Need to add visual display above staff

**Files to modify:**
- `src/components/ScoreRenderer.jsx` - Add measure number rendering

#### Time Signature Selector
**Status:** Hardcoded to 4/4
- Current: `addTimeSignature("4/4")` hardcoded in ScoreRenderer.jsx:32,34
- Need: UI selector for 3/4, 6/8, etc.
- Lesson metadata already supports `timeSignature: { numerator: 4, denominator: 4 }`

**Files to modify:**
- `src/components/SettingsPanel.jsx` - Add time signature dropdown
- `src/components/ScoreRenderer.jsx` - Use dynamic time signature

#### Current Measure/Beat Display
**Status:** Not implemented
- Need overlay showing current measure and beat during playback
- Calculation logic exists in validation code

**Files to modify:**
- `src/components/Header.jsx` or new overlay component
- `src/App.jsx` - Add current measure/beat state

#### BPM Control
**Status:** Only tempo factor slider exists
- Current: Tempo factor slider (0.5x-3.0x multiplier)
- Need: Separate BPM control (e.g., 60, 80, 120 BPM)
- Lessons already have `tempo` field in metadata

**Files to modify:**
- `src/components/ControlPanel.jsx` - Add BPM slider
- `src/hooks/useTimeline.js` - Support BPM adjustment

#### Beat Tolerance Visibility
**Status:** Only in dev tools (hidden by default)
- Beat tolerance slider exists but only visible when showDevTools is true
- Should be promoted to main settings panel

**Files to modify:**
- `src/components/SettingsPanel.jsx` - Add beat tolerance slider
- `src/App.jsx` - Move beat tolerance controls from dev tools section

---

## Phase C: Advanced Features - ⚠️ **IN PROGRESS**

### ✅ Completed Features

#### Beaming
- ✅ Automatic beaming for consecutive eighth/sixteenth notes
- ✅ Groups notes within the same measure
- ✅ Uses VexFlow `Beam.generateBeams()` with error handling

**Implemented in:** `src/components/ScoreRenderer.jsx:177-206`

**Current behavior:**
- Beaming is automatic per measure
- Separate beam generation for treble and bass staves
- Error handling for beaming failures

**Known limitations:**
- Does not follow standard beaming rules (beam within beats, not across beat boundaries)
- No manual beam control

### ❌ Not Yet Implemented

#### Tuplets
**Status:** Not implemented
- Need to detect tuplet patterns from `durationBeats`
- Need to use VexFlow `Tuplet` objects with bracket notation
- Need to adjust duration converter to handle tuplet divisions

**Files to create/modify:**
- `src/core/durationConverter.js` - Add tuplet detection
- `src/components/ScoreRenderer.jsx` - Render tuplet brackets
- `src/parser/TimeLineParser.js` - Parse tuplet information from MusicXML

#### Multi-Voice Rendering
**Status:** Not implemented
- Need to parse voice information from MusicXML `<voice>` elements
- Need to render voices with separate stem directions
- Need to handle voice-specific rests

**Files to modify:**
- `src/parser/TimeLineParser.js` - Extract voice data
- `src/components/ScoreRenderer.jsx` - Multi-voice rendering logic

#### Rests
**Status:** Parsed but not rendered
- Parser detects rests: `const isRest = note.querySelector('rest')`
- Rests are currently skipped: `if (!isRest) { ... }`

**Files to modify:**
- `src/components/ScoreRenderer.jsx` - Add rest rendering with VexFlow rest durations
- `src/parser/TimeLineParser.js` - Output rest entries with `isRest: true` flag

**Implementation notes:**
- Use VexFlow rest durations: `"wr"`, `"hr"`, `"qr"`, `"8r"`, `"16r"`
- Position rests correctly on staff (specific line for each rest type)

#### Tempo & Time Signature Changes
**Status:** Not implemented
- Single tempo and time signature per lesson
- No support for mid-piece changes

**Implementation approach:**
- Create `tempoMap[]` and `timeSigMap[]` arrays
- Each timeline event references which tempo/time signature applies
- Recalculate `timeSec` by integrating across tempo changes

**Files to create/modify:**
- `src/core/timeMapper.js` - New utility for tempo map handling
- `src/parser/TimeLineParser.js` - Parse tempo/time sig changes
- `src/components/ScoreRenderer.jsx` - Render tempo/time sig markings

#### MusicXML Edge Cases
**Status:** Basic MusicXML support only
- Current support: pitch, duration, accidentals, chords
- Missing: grace notes, ornaments, repeats, voltas, lyrics, dynamics, articulations

**Priority:** Low (basic functionality works)

#### Performance Optimization
**Status:** Not needed yet
- Current implementation handles ~50 measures without issues
- Virtual rendering only needed for 100+ measure scores

**Implementation approach (when needed):**
- Virtual rendering (only render visible measures)
- Canvas pooling for better memory usage
- Web Worker for parser (off main thread)

---

## MusicXML Parser Architecture & Limitations

### Current Architecture

The app uses a **convert-at-parse-time** architecture:

1. **Input Formats:** Both JSON and MusicXML lessons exist
2. **Parse-Time Conversion:** MusicXML is converted to internal timeline format via `simpleMusicXMLtoTimeline()`
3. **Unified Internal Format:** All downstream code (rendering, validation, playback) works with the same timeline array
4. **One-Time Parse:** Conversion happens once at lesson load, not during rendering

**Implementation:** `src/parser/TimeLineParser.js:166-249` (MusicXML parser), `251-306` (format dispatcher)

### Internal Timeline Format

Both JSON and MusicXML produce identical timeline entries:
```javascript
{
  measure: 1,              // From XML: <measure number="1">
  beat: 1,                 // Calculated from duration and divisions
  beatFraction: 0,         // Subdivision within beat
  durationBeats: 1.0,      // From XML: <duration> / divisions
  timeSec: 0.0,            // Computed: (measure-1)*bpm + beat*60/BPM
  start: 0.0,              // Backward compatibility (same as timeSec)
  dur: 0.75,               // Backward compatibility (durationBeats * secPerBeat)
  pitch: 'C4',             // From XML: <pitch><step>C</step><octave>4</octave>
  midi: 60                 // Calculated from pitch
}
```

### Information Preserved from MusicXML

✅ **Currently Extracted:**
- Measure numbers (`<measure number>`)
- Pitch information (`<pitch>` - step, alter, octave)
- Note durations (`<duration>` and `<divisions>`)
- Chord detection (`<chord>` element)
- Time signature (first occurrence only)
- Accidentals (sharps/flats)

### Information Lost from MusicXML

❌ **Parsed but Discarded:**
- **Rests** - Detected (`const isRest = note.querySelector('rest')`) but not added to timeline (line 219: `if (!isRest)`)

❌ **Not Extracted at All:**
- **Voices** - `<voice>` element ignored (needed for multi-voice rendering)
- **Beaming directives** - `<beam>` elements ignored (auto-beaming used instead)
- **Stem direction** - `<stem>` not preserved
- **Articulations** - `<articulations>` (staccato, accent, etc.)
- **Dynamics** - `<dynamics>` (p, f, mf, etc.)
- **Lyrics** - `<lyric>` elements
- **Slurs/Ties** - `<slur>`, `<tied>` elements
- **Tempo changes** - Only initial tempo read
- **Time signature changes** - Only first time signature read
- **Key signature changes** - Not tracked
- **Repeats/Voltas** - `<repeat>`, `<ending>` elements
- **Ornaments** - Trills, mordents, etc.
- **Grace notes** - `<grace>` element

### Risk Assessment by Feature

| Feature | Current Status | Future Risk | Priority | Phase |
|---------|---------------|-------------|----------|-------|
| **Rests** | Parsed but discarded | **HIGH** - Basic notation | High | Phase C |
| **Repeats/Voltas** | Not extracted | **HIGH** - Common in music | Medium | Not planned |
| **Tempo changes** | Not supported | **MEDIUM** - Limits repertoire | Medium | Phase C |
| **Time sig changes** | Not supported | **MEDIUM** - Limits repertoire | Medium | Phase C |
| **Multi-voice** | Not extracted | **MEDIUM** - Advanced scores | Low | Phase C |
| **Beaming control** | Lost (uses auto) | **LOW** - Auto works OK | Low | Phase C |
| **Slurs/Ties** | Not extracted | **LOW** - Visual only | Low | Not planned |
| **Articulations** | Not extracted | **LOW** - Visual only | Low | Not planned |
| **Dynamics** | Not extracted | **LOW** - Visual only | Low | Not planned |
| **Ornaments** | Not extracted | **LOW** - Advanced | Low | Not planned |
| **Lyrics** | Not extracted | **LOW** - Not needed | Low | Not planned |

### Architectural Implications

#### ✅ Advantages of Current Approach

1. **Simplicity** - Downstream code is format-agnostic
2. **Performance** - One-time parse cost, fast runtime
3. **Testability** - Easy to test with synthetic data
4. **Flexibility** - Easy to add new input formats (MIDI files, ABC notation)
5. **Memory efficiency** - Single timeline array

#### ⚠️ Limitations

1. **Information Loss** - Advanced notation features discarded
2. **Reconstruction Impossible** - Can't regenerate original MusicXML
3. **Limited Notation** - Can't display full expressive markings
4. **Repeated Content** - No support for repeats (must expand manually)

#### 🔴 Near-Term Issues

**Rests are invisible** (TimeLineParser.js:219)
```javascript
if (!isRest) {  // Rests never make it to the timeline!
    timeline.push({ /* ... */ });
}
```

**Impact:** Cannot render rests, cannot validate rest durations

**Fix:** Change parser to include rests:
```javascript
timeline.push({
    isRest: isRest ? true : false,
    measure: measureNumber,
    beat: Math.floor(startBeatInMeasure) + 1,
    beatFraction: startBeatInMeasure % 1,
    durationBeats: durationBeats,
    // ... rest of fields
});
```

### Recommendations

#### Option 1: **Extend Timeline Format** (Recommended)
Keep current architecture but add missing fields:

**Priority 1 (Phase B/C):**
- Add `isRest: boolean` field
- Add `voice: number` field (default 1)

**Priority 2 (Phase C):**
- Add optional `beamGroup: number` for manual beam control
- Add optional `stemDirection: 'up' | 'down' | 'auto'`

**Priority 3 (Future):**
- Add optional `articulations: string[]`
- Add optional `dynamics: string`

**Pros:** Maintains simplicity, addresses high-priority gaps
**Cons:** Still limited for full notation display

#### Option 2: **Hybrid Approach** (For Advanced Features)
Store both timeline and original MusicXML:

```javascript
{
  timeline: [ /* current format */ ],
  sourceMusicXML: xmlString,  // Original for reference
  metadata: {
    beamGroups: [ /* beam info */ ],
    dynamics: [ /* dynamic markings */ ]
  }
}
```

**Pros:** No information loss, can render full notation
**Cons:** More memory, increased complexity

#### Option 3: **Native MusicXML Throughout** (NOT Recommended)
Work with MusicXML DOM throughout the app

**Pros:** Complete feature support
**Cons:** Major rewrite, performance issues, much higher complexity

### Decision for Current Scope

**Verdict:** Current architecture is **appropriate for rhythm-game style learning**

The app focuses on:
- ✅ Pitch accuracy
- ✅ Rhythm/timing
- ✅ Note duration
- ✅ Measure awareness

Not trying to be:
- ❌ Full sheet music viewer
- ❌ Notation editor
- ❌ Performance analysis tool

**Action Items:**
1. **Immediate (Phase B):** Add rest support to timeline format (high value, easy fix)
2. **Near-term (Phase C):** Extract voice information for multi-voice rendering
3. **Future:** Consider hybrid approach only if advanced notation display becomes a requirement

### Current Parser Limitation

Note: The parser is set to prefer JSON format (src/hooks/useTimeline.js:23):
```javascript
const useJson = true;  // Hardcoded
```

Even though lessons have both `.data` (JSON) and `.xml` (MusicXML), the JSON version is currently used. The MusicXML parser exists and works but isn't actively used in lesson selection.

---

## Implementation Recommendations

### Source of Truth for Timing
✅ **Already implemented correctly:**
- Measure/beat is the musical truth (canonical)
- timeSec is cached and computed from measure/beat + tempo
- Recalculation happens when tempo changes

### Testing Strategy

#### Existing Tests
- ✅ `src/core/__tests__/durationConverter.test.js` - Duration mapping tests
- ✅ `src/core/__tests__/layoutUtils.test.js` - Position calculation tests
- ✅ `src/parser/__tests__/TimeLineParser.test.js` - Parser tests
- ✅ `src/core/__tests__/regression.test.js` - Validation tests

#### Test Coverage Gaps
- ❌ No tests for beaming logic
- ❌ No visual regression tests for notation rendering
- ❌ No tests for multi-voice rendering (not implemented)
- ❌ No tests for tuplet handling (not implemented)

### Files Created (Phase A)

✅ All Phase A utilities created:
```
src/core/durationConverter.js    // durationBeats → VexFlow duration
src/core/layoutUtils.js           // measure/beat → pixel conversions
src/core/constants.js             // BEATS, TIMING, RENDERING constants
```

---

## Architectural Considerations

### Measure Width Calculation
**Current implementation:** Fixed-width measures
- All measures same width (beatsPerMeasure * pixelsPerBeat)
- Simple and works well for scrolling
- No cramping or spacing issues

**Future consideration:** Variable-width measures
- Proportional spacing based on note content
- More visually accurate for static scores
- Requires recalculating positions (more complex)

**Decision:** Keep fixed-width; proportional spacing is low priority

### Scrolling Behavior with Measures
**Current implementation:** Smooth scrolling
- Barlines scroll continuously like notes
- Simple and consistent with rhythm game feel

**Alternative:** Measure snapping
- Measures snap into view
- More traditional for static scores
- Not suitable for rhythm game UX

**Decision:** Keep smooth scrolling

### Validation Tolerance Parameters
**Current implementation:**
- Beat tolerance slider: 0.01-0.40 beats (in dev tools)
- Formula: `toleranceSec = beatTolerance * 60 / BPM`
- Default: 0.1 beats

**Recommendations:**
- Promote beat tolerance to main settings
- Add presets: Beginner (±0.5 beats), Intermediate (±0.25 beats), Advanced (±0.1 beats)
- Make preset names user-friendly (Easy/Medium/Hard)

---

## Priority Summary

### High Priority (Phase B completion)
1. **Move beat tolerance to main settings** - Already implemented but hidden in dev tools
2. **Add measure numbers display** - Data exists, just needs rendering
3. **Add current measure/beat overlay** - Improves user feedback

### Medium Priority (Phase B + Phase C)
4. **Time signature selector** - Enables more lesson variety
5. **BPM control** - Better than tempo factor for musicians
6. **Render rests** - Already parsed, just need rendering
7. **Improve beaming rules** - Beat-aware beaming

### Low Priority (Phase C)
8. **Tuplets** - Advanced rhythmic notation
9. **Multi-voice rendering** - Complex scores
10. **Tempo/time signature changes** - Advanced MusicXML features
11. **Performance optimization** - Only needed for very long pieces

---

## Benefits Summary

✅ **Musical accuracy** - Notes represented with correct durations and measure context
✅ **Better pedagogy** - Beat-based feedback more meaningful than time-based
✅ **Extensibility** - Foundation for tuplets, multi-voice, tempo changes
✅ **Visual clarity** - Proper notation with white/black noteheads, beaming, barlines
⚠️ **Professional quality** - Approaching expectations of music education software (some UI polish needed)

---

## Questions & Decisions Needed

1. ~~**Measure width strategy**~~ ✅ Resolved: Fixed-width works well
2. ~~**MusicXML parser scope**~~ ✅ Resolved: Basic support complete, advanced features deferred
3. **Default settings** - What time signature, BPM, beat tolerance for new lessons?
4. **Backward compatibility** - Support old JSON format or migrate all lessons? (Currently supports both)
5. **Performance targets** - What's the maximum lesson length we need to support? (Currently ~50 measures tested)
6. **UI/UX decisions** - Should beat tolerance be a slider or preset buttons (Easy/Medium/Hard)?

---

## Recent Refactoring (January 2026)

The codebase recently underwent modularization:
- Refactor Phase 1 (commit 426add3): Extract usePlayback custom hook
- Refactor Phase 2 (commit 0957eb8): Extract useTimeline custom hook
- Refactor Phase 3 (commit e66ddd0): Extract useMidiSystem custom hook

This improves code organization and makes testing easier.

---

## References & Prior Discussion

This roadmap synthesizes recommendations from:
- ChatGPT analysis of duration mapping and measure representation
- Claude's architectural review of timing models and VexFlow integration
- Current codebase structure and recent refactoring work
- Git commit history tracking Phase 1-6 implementation

The phased approach has proven successful - Phase A is complete and functional. Phase B needs completion of UI features, and Phase C contains advanced notation features for future enhancement.
