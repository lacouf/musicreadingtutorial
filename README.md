# Music Master

**Interactive piano practice application** - Learn to read sheet music while playing along with scrolling notation.

Music Master combines the engaging gameplay of rhythm games like Guitar Hero with proper musical notation. Notes scroll horizontally across a grand staff toward a playhead, and you play them on your MIDI keyboard at the right time. Perfect for learning sight-reading and building muscle memory!

---

## Features

- **Scrolling Sheet Music** - Grand staff notation (treble + bass clefs) rendered with VexFlow 5.0
- **MIDI Keyboard Integration** - Real-time input from USB MIDI keyboards via Web MIDI API
- **Note Validation** - Beat-based timing validation with visual feedback (green = correct, red = incorrect)
- **Audio Synthesis** - Built-in piano synthesizer using Web Audio API
- **Practice Mode** - Generate random exercises with customizable note ranges and durations
- **Built-in Lessons** - Pre-composed lessons including "Polyphonic Chords" and "Rhythm & Beaming"
- **Playback Controls** - Pause/resume (spacebar), tempo adjustment (0.5x-3.0x), restart
- **Detailed Logging** - Developer tools for tracking note events and validation results
- **Responsive UI** - Modern interface built with React and Tailwind CSS

---

## Requirements

- **Node.js** (v18 or higher recommended)
- **Modern web browser** with Web MIDI API and Web Audio API support (Chrome, Edge, Opera)
- **USB MIDI keyboard** (recommended but not required - useful for actual practice)

---

## Installation

```bash
npm install
```

---

## Usage

### Development Mode
```bash
npm run dev
```
Opens at `http://localhost:5173` (default Vite port)

### Production Build
```bash
npm run build
npm run preview
```

### Testing & Linting
```bash
npm test          # Run unit tests with Vitest
npm run lint      # Lint code with ESLint
```

---

## How to Use

1. **Connect MIDI Keyboard** (optional)
   - Plug in your USB MIDI keyboard
   - Check the header for "MIDI: Connected" status

2. **Choose Mode**
   - **Lesson Mode**: Select from pre-built lessons in the sidebar
   - **Practice Mode**: Configure custom exercises (note range, durations, etc.)

3. **Adjust Settings**
   - **Tempo Slider**: Speed up (3.0x) or slow down (0.5x) the scrolling speed
   - **Note Range**: Set min/max MIDI notes for practice exercises
   - **Duration Filters**: Toggle which note types to include (whole, half, quarter, etc.)
   - **Beat Tolerance**: Adjust timing strictness (0.01-0.40 beats)

4. **Play Along**
   - Press Play or tap Spacebar to start scrolling
   - Play notes on your MIDI keyboard when they reach the red playhead
   - Watch for green flashes (correct) or red flashes (incorrect/late)

5. **Review Performance**
   - Check the log display for detailed validation results
   - See which notes were played correctly/incorrectly and timing accuracy

---

## Tech Stack

- **React 19** - UI framework
- **Vite** - Fast build tool and dev server
- **VexFlow 5.0** - Music notation engraving library
- **Tailwind CSS** - Utility-first styling
- **Web MIDI API** - USB MIDI keyboard input
- **Web Audio API** - Real-time audio synthesis
- **Vitest** - Unit testing framework

---

## Project Structure

```
src/
├── App.jsx                      # Main application component
├── components/                  # UI components (Header, Sidebar, Controls, etc.)
├── hooks/                       # Custom hooks (usePlayback, useTimeline, useMidiSystem)
├── core/                        # Core utilities (validation, duration mapping, layout)
├── parser/                      # Music format parsers (JSON, MusicXML)
├── midi/                        # MIDI input handling
└── audio/                       # Audio synthesis
```

---

## Development

### Adding New Lessons

Create a new JSON file in `src/parser/` with this structure:

```javascript
{
  "title": "Your Lesson Name",
  "tempo": 120,
  "timeSignature": { "numerator": 4, "denominator": 4 },
  "notes": [
    {
      "measure": 1,
      "beat": 1,
      "beatFraction": 0,
      "durationBeats": 1.0,
      "timeSec": 0.0,
      "pitch": "C4",
      "midi": 60,
      "vfKey": "c/4"
    },
    // ... more notes
  ]
}
```

Import and add it to the lesson selector in `hooks/useTimeline.js`.

### Running Tests

```bash
npm test                         # Run all tests
npm test -- core/validation      # Run specific test file
npm test -- --coverage           # Generate coverage report
```

### Code Organization

- **Custom hooks** manage state and side effects (playback, MIDI, timeline)
- **Components** are presentational and receive props from hooks
- **Core utilities** contain pure functions (no React dependencies)
- **Tests** are colocated with source files in `__tests__/` directories

---

## Roadmap

This project has successfully implemented beat-based, measure-aware musical notation (Phase A complete). See [ROADMAP.md](ROADMAP.md) for detailed status and future plans:

- **Phase A (Data Model & Duration Mapping)**: ✅ **COMPLETED** - Beat-based positioning, duration converter, beat-based validation, MusicXML parser
- **Phase B (Measures, Layout & Barlines)**: ⚠️ **PARTIALLY COMPLETED** - Barlines ✅, beaming ✅, measure numbers ❌, time signature selector ❌, current measure/beat display ❌
- **Phase C (Advanced Features)**: ⚠️ **IN PROGRESS** - Automatic beaming ✅, rests/tuplets/multi-voice ❌, tempo changes ❌

**Current Status**: Core functionality complete. UI enhancements and advanced notation features remain.

---

## Browser Compatibility

| Feature | Chrome | Edge | Firefox | Safari |
|---------|--------|------|---------|--------|
| Web MIDI API | ✅ Yes | ✅ Yes | ❌ No | ❌ No |
| Web Audio API | ✅ Yes | ✅ Yes | ✅ Yes | ✅ Yes |
| Canvas/VexFlow | ✅ Yes | ✅ Yes | ✅ Yes | ✅ Yes |

**Note:** MIDI keyboard support requires Chrome, Edge, or Opera. Firefox and Safari do not support Web MIDI API.

---

## Contributing

Contributions welcome! Please follow the existing code style and add tests for new features.

---

## License

This project is for educational purposes.

---

## Acknowledgments

- **VexFlow** - Excellent music notation rendering library
- **Web MIDI API** - Enables browser-based MIDI keyboard integration
- **React & Vite** - Modern development experience
