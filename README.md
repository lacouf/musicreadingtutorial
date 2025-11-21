This is a music learning/tutorial application built with React and VexFlow. It's essentially an interactive piano practice tool that works like a "Guitar Hero" for learning piano.

Main Features:

1. Scrolling Sheet Music
- Displays musical notation on a grand staff (treble + bass clefs) that scrolls horizontally from right to left
- Notes scroll toward a fixed red playhead at 300px from the left edge

2. MIDI Keyboard Integration
- Connects to a USB MIDI keyboard via the Web MIDI API
- Listens for note on/off events in real-time

3. Note Validation
- Checks if you play the correct note at the correct time (within a ~0.35 second window)
- Flashes the playhead different colors for visual feedback (correct/incorrect)
- Logs detailed debug information about played notes vs expected notes

4. Playback Controls
- Pause/Resume button or spacebar to pause scrolling
- Tempo slider (0.5x - 3.0x) to slow down or speed up the music scrolling speed
- Starts paused by default

5. Music Parsing
- Supports both JSON and MusicXML lesson formats (currently using JSON)
- Parses pitch information and converts between different formats (MIDI numbers, VexFlow keys)

Tech Stack:
- React 19 + Vite
- VexFlow (music notation rendering library)
- Web MIDI API
- Canvas for rendering

The app is currently in a "minimal starter" state with several suggested improvements listed in the UI (src/App.jsx:249-257).
