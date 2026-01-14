// src/parser/TimeLineParser.js
import { parsePitchToMidi } from '../core/musicUtils';
import { TIMING } from '../core/constants';

export const exampleJSONLesson = {
    title: 'Polyphonic Exercise with Chords',
    tempo: 80,
    notes: [
        // === Section 1: Single notes (warm up) ===
        { measure: 1, beat: 1, beatFraction: 0, durationBeats: 0.5, start: 0.0, dur: 0.5, pitch: 'C4', midi: 60 },
        { measure: 1, beat: 1, beatFraction: 0.5, durationBeats: 0.5, start: 0.375, dur: 0.375, pitch: 'D4', midi: 62 }, // Adjusted for tempo 80
        { measure: 1, beat: 2, beatFraction: 0, durationBeats: 0.5, start: 0.75, dur: 0.375, pitch: 'E4', midi: 64 },

        // === Section 2: Two-note intervals (thirds) ===
        // C-E interval at 2.0s
        { start: 2.0, dur: 1.0, pitch: 'C4' },
        { start: 2.0, dur: 1.0, pitch: 'E4' },

        // D-F interval at 3.5s
        { start: 3.5, dur: 1.0, pitch: 'D4' },
        { start: 3.5, dur: 1.0, pitch: 'F4' },

        // === Section 3: Three-note chord (C major triad) ===
        // C-E-G chord at 5.0s
        { start: 5.0, dur: 1.5, pitch: 'C4' },
        { start: 5.0, dur: 1.5, pitch: 'E4' },
        { start: 5.0, dur: 1.5, pitch: 'G4' },

        // === Section 4: Bass + Treble (polyphonic melody) ===
        // Bass note with treble melody
        { start: 7.0, dur: 2.0, pitch: 'C3' },  // Bass holds
        { start: 7.0, dur: 0.5, pitch: 'E4' },  // Treble melody
        { start: 7.5, dur: 0.5, pitch: 'G4' },
        { start: 8.0, dur: 0.5, pitch: 'C5' },

        // === Section 5: Another triad (G major) ===
        { start: 9.5, dur: 1.5, pitch: 'G3' },
        { start: 9.5, dur: 1.5, pitch: 'B3' },
        { start: 9.5, dur: 1.5, pitch: 'D4' },

        // === Section 6: Final chord (F major) ===
        { start: 11.5, dur: 2.0, pitch: 'F3' },
        { start: 11.5, dur: 2.0, pitch: 'A3' },
        { start: 11.5, dur: 2.0, pitch: 'C4' }
    ]
};

export const exampleMusicXML = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE score-partwise PUBLIC "-//Recordare//DTD MusicXML 3.1 Partwise//EN" "http://www.musicxml.org/dtds/partwise.dtd">
<score-partwise version="3.1">
  <part-list>
    <score-part id="P1">
      <part-name>Music</part-name>
    </score-part>
  </part-list>
  <part id="P1">
    <measure number="1">
      <attributes>
        <divisions>1</divisions>
        <key>
          <fifths>0</fifths>
        </key>
        <time>
          <beats>4</beats>
          <beat-type>4</beat-type>
        </time>
        <clef>
          <sign>G</sign>
          <line>2</line>
        </clef>
      </attributes>
      <note>
        <pitch>
          <step>C</step>
          <octave>4</octave>
        </pitch>
        <duration>1</duration>
      </note>
      <note>
        <pitch>
          <step>D</step>
          <octave>4</octave>
        </pitch>
        <duration>1</duration>
      </note>
      <note>
        <pitch>
          <step>E</step>
          <octave>4</octave>
        </pitch>
        <duration>2</duration>
      </note>
    </measure>
  </part>
</score-partwise>`;

export function simpleMusicXMLtoTimeline(xmlString, tempo = 60) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(xmlString, 'application/xml');
    
    let divisions = 1;
    let beatsPerMeasure = 4;
    let beatType = 4;
    const timeline = [];
    
    const secPerBeat = TIMING.SECONDS_IN_MINUTE / tempo;

    const parts = doc.querySelectorAll('part');
    parts.forEach(part => {
        let cumulativeBeats = 0;
        const measures = part.querySelectorAll('measure');
        
        measures.forEach(measure => {
            const measureNumber = parseInt(measure.getAttribute('number') || '1', 10);
            
            const attr = measure.querySelector('attributes');
            if (attr) {
                const div = attr.querySelector('divisions');
                if (div) divisions = parseInt(div.textContent, 10);
                
                const time = attr.querySelector('time');
                if (time) {
                    beatsPerMeasure = parseInt(time.querySelector('beats')?.textContent || '4', 10);
                    beatType = parseInt(time.querySelector('beat-type')?.textContent || '4', 10);
                }
            }

            let measureBeatOffset = 0;
            const notes = measure.querySelectorAll('note');
            
            notes.forEach(note => {
                const isRest = note.querySelector('rest');
                const isChord = note.querySelector('chord');
                const duration = parseInt(note.querySelector('duration')?.textContent || '0', 10);
                const durationBeats = duration / divisions;

                if (isChord) {
                    // Chord note starts at the same time as the previous note
                    // So we don't advance measureBeatOffset, and we use the previous note's start time
                }

                // If it was a chord, we need to know the start beat of the previous note
                const startBeatInMeasure = isChord && timeline.length > 0 
                    ? timeline[timeline.length - 1].beat + timeline[timeline.length - 1].beatFraction - 1
                    : measureBeatOffset;

                const absoluteBeat = cumulativeBeats + startBeatInMeasure;
                const timeSec = absoluteBeat * secPerBeat;

                if (!isRest) {
                    const step = note.querySelector('pitch > step')?.textContent || 'C';
                    const alter = note.querySelector('pitch > alter')?.textContent || null;
                    const octave = note.querySelector('pitch > octave')?.textContent || '4';
                    const stepName = alter ? (parseInt(alter) > 0 ? `${step}#` : `${step}b`) : step;
                    const pitch = `${stepName}${octave}`;
                    const midi = parsePitchToMidi(pitch);

                    timeline.push({
                        measure: measureNumber,
                        beat: Math.floor(startBeatInMeasure) + 1,
                        beatFraction: startBeatInMeasure % 1,
                        durationBeats: durationBeats,
                        timeSec: timeSec,
                        start: timeSec, // Backward compatibility
                        dur: durationBeats * secPerBeat, // Backward compatibility
                        pitch: pitch,
                        midi: midi
                    });
                }

                if (!isChord) {
                    measureBeatOffset += durationBeats;
                }
            });
            cumulativeBeats += beatsPerMeasure;
        });
    });

    return timeline;
}

export function parseTimeline(lessonType, lessonData, tempo) {
    if (lessonType === 'json') {
        return lessonData.notes.map(n => {
            const midi = n.midi ?? parsePitchToMidi(n.pitch || '');
            return {
                ...n,
                midi: midi,
                start: n.start ?? 0, // ensure we have start for current logic
                timeSec: n.timeSec ?? n.start ?? 0
            };
        });
    } else if (lessonType === 'musicxml') {
        return simpleMusicXMLtoTimeline(lessonData, tempo);
    }
    return [];
}
