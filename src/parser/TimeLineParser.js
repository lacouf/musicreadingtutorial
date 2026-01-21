// src/parser/TimeLineParser.js
import { parsePitchToMidi } from '../core/musicUtils';
import { TIMING } from '../core/constants';

export const exampleJSONLesson = {
    title: 'Polyphonic Exercise with Chords',
    tempo: 80,
    notes: [
        // === Section 1: Single notes (warm up) ===
        { measure: 1, beat: 1, beatFraction: 0, durationBeats: 0.5, start: 0.0, dur: 0.375, pitch: 'C4', midi: 60 },
        { measure: 1, beat: 1, beatFraction: 0.5, durationBeats: 0.5, start: 0.375, dur: 0.375, pitch: 'D4', midi: 62 }, 
        { measure: 1, beat: 2, beatFraction: 0, durationBeats: 0.5, start: 0.75, dur: 0.375, pitch: 'E4', midi: 64 },

        // === Section 2: Two-note intervals (thirds) ===
        // C-E interval at Beat 3 (2.25s)
        { start: 2.25, dur: 0.75, pitch: 'C4' },
        { start: 2.25, dur: 0.75, pitch: 'E4' },

        // D-F interval at Beat 5 (3.75s)
        { start: 3.75, dur: 0.75, pitch: 'D4' },
        { start: 3.75, dur: 0.75, pitch: 'F4' },

        // === Section 3: Three-note chord (C major triad) ===
        // C-E-G chord at Beat 8 (6.0s)
        { start: 6.0, dur: 1.125, pitch: 'C4' },
        { start: 6.0, dur: 1.125, pitch: 'E4' },
        { start: 6.0, dur: 1.125, pitch: 'G4' },

        // === Section 4: Bass + Treble (polyphonic melody) ===
        // Bass note with treble melody at Beat 12 (9.0s)
        { start: 9.0, dur: 1.5, pitch: 'C3' },  // Bass holds
        { start: 9.0, dur: 0.375, pitch: 'E4' },  // Treble melody
        { start: 9.375, dur: 0.375, pitch: 'G4' },
        { start: 9.75, dur: 0.375, pitch: 'C5' },

        // === Section 5: Another triad (G major) at Beat 16 (12.0s)
        { start: 12.0, dur: 1.125, pitch: 'G3' },
        { start: 12.0, dur: 1.125, pitch: 'B3' },
        { start: 12.0, dur: 1.125, pitch: 'D4' },

        // === Section 6: Final chord (F major) at Beat 20 (15.0s)
        { start: 15.0, dur: 1.5, pitch: 'F3' },
        { start: 15.0, dur: 1.5, pitch: 'A3' },
        { start: 15.0, dur: 1.5, pitch: 'C4' }
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


export const rhythmMixLessonJSON = {
    title: 'Rhythm & Beaming Exercise',
    tempo: 80,
    timeSignature: { numerator: 4, denominator: 4 },
    notes: [
        // Measure 1: 4 Eighth notes beamed together (0.5 duration each)
        { measure: 1, beat: 1, beatFraction: 0, durationBeats: 0.5, pitch: 'C4' },
        { measure: 1, beat: 1, beatFraction: 0.5, durationBeats: 0.5, pitch: 'D4' },
        { measure: 1, beat: 2, beatFraction: 0, durationBeats: 0.5, pitch: 'E4' },
        { measure: 1, beat: 2, beatFraction: 0.5, durationBeats: 0.5, pitch: 'F4' },
        // Two Quarter notes (no beam)
        { measure: 1, beat: 3, beatFraction: 0, durationBeats: 1.0, pitch: 'G4' },
        { measure: 1, beat: 4, beatFraction: 0, durationBeats: 1.0, pitch: 'G4' },

        // Measure 2: 8 Eighth notes (Scale C4-C5)
        { measure: 2, beat: 1, beatFraction: 0, durationBeats: 0.5, pitch: 'C4' },
        { measure: 2, beat: 1, beatFraction: 0.5, durationBeats: 0.5, pitch: 'D4' },
        { measure: 2, beat: 2, beatFraction: 0, durationBeats: 0.5, pitch: 'E4' },
        { measure: 2, beat: 2, beatFraction: 0.5, durationBeats: 0.5, pitch: 'F4' },
        { measure: 2, beat: 3, beatFraction: 0, durationBeats: 0.5, pitch: 'G4' },
        { measure: 2, beat: 3, beatFraction: 0.5, durationBeats: 0.5, pitch: 'A4' },
        { measure: 2, beat: 4, beatFraction: 0, durationBeats: 0.5, pitch: 'B4' },
        { measure: 2, beat: 4, beatFraction: 0.5, durationBeats: 0.5, pitch: 'C5' },

        // Measure 3: 16th notes (0.25 duration)
        { measure: 3, beat: 1, beatFraction: 0, durationBeats: 0.25, pitch: 'C4' },
        { measure: 3, beat: 1, beatFraction: 0.25, durationBeats: 0.25, pitch: 'C4' },
        { measure: 3, beat: 1, beatFraction: 0.5, durationBeats: 0.25, pitch: 'C4' },
        { measure: 3, beat: 1, beatFraction: 0.75, durationBeats: 0.25, pitch: 'C4' },
        { measure: 3, beat: 2, beatFraction: 0, durationBeats: 1.0, pitch: 'D4' }, // Quarter
        
        // Measure 4: Mixed Rhythm
        { measure: 4, beat: 1, beatFraction: 0, durationBeats: 0.5, pitch: 'C4' },
        { measure: 4, beat: 1, beatFraction: 0.5, durationBeats: 0.25, pitch: 'D4' },
        { measure: 4, beat: 1, beatFraction: 0.75, durationBeats: 0.25, pitch: 'E4' },
        { measure: 4, beat: 2, beatFraction: 0, durationBeats: 1.0, pitch: 'F4' }
    ]
};

export const rhythmMixLessonXML = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE score-partwise PUBLIC "-//Recordare//DTD MusicXML 3.1 Partwise//EN" "http://www.musicxml.org/dtds/partwise.dtd">
<score-partwise version="3.1">
  <part-list>
    <score-part id="P1"><part-name>Music</part-name></score-part>
  </part-list>
  <part id="P1">
    <!-- Measure 1: 4 Eighths beamed -->
    <measure number="1">
      <attributes>
        <divisions>2</divisions>
        <time><beats>4</beats><beat-type>4</beat-type></time>
        <clef><sign>G</sign><line>2</line></clef>
      </attributes>
      <note><pitch><step>C</step><octave>4</octave></pitch><duration>1</duration><type>eighth</type><beam number="1">begin</beam></note>
      <note><pitch><step>D</step><octave>4</octave></pitch><duration>1</duration><type>eighth</type><beam number="1">continue</beam></note>
      <note><pitch><step>E</step><octave>4</octave></pitch><duration>1</duration><type>eighth</type><beam number="1">continue</beam></note>
      <note><pitch><step>F</step><octave>4</octave></pitch><duration>1</duration><type>eighth</type><beam number="1">end</beam></note>
      <note><pitch><step>G</step><octave>4</octave></pitch><duration>2</duration><type>quarter</type></note>
      <note><pitch><step>G</step><octave>4</octave></pitch><duration>2</duration><type>quarter</type></note>
    </measure>
  </part>
</score-partwise>`;

export const AVAILABLE_LESSONS = [
    { id: 'polyphonic', name: 'Polyphonic Chords', data: exampleJSONLesson },
    { id: 'rhythm', name: 'Rhythm & Beaming', data: rhythmMixLessonJSON },
    { id: 'nocturne', name: 'Chopin - Nocturne No. 1', file: '/Nocturne.xml' }
];

export function simpleMusicXMLtoTimeline(xmlString, tempo = 60) {
    if (!xmlString) {
        console.error('simpleMusicXMLtoTimeline: xmlString is empty');
        return { timeline: [], metadata: { beatsPerMeasure: 4, beatType: 4 } };
    }

    const parser = new DOMParser();
    const doc = parser.parseFromString(xmlString, 'application/xml');
    
    // Check for parsing errors
    const parserError = doc.getElementsByTagName('parsererror');
    if (parserError.length > 0) {
        console.error('MusicXML Parsing Error:', parserError[0].textContent);
        return { timeline: [], metadata: { beatsPerMeasure: 4, beatType: 4 } };
    }

    let divisions = 1;
    let beatsPerMeasure = 4;
    let beatType = 4;
    const timeline = [];
    
    const secPerBeat = TIMING.SECONDS_IN_MINUTE / tempo;

    // Use getElementsByTagName for better compatibility with different DOM implementations
    const parts = doc.getElementsByTagName('part');

    for (let p = 0; p < parts.length; p++) {
        const part = parts[p];
        let cumulativeBeats = 0;
        const measures = part.getElementsByTagName('measure');
        
        for (let m = 0; m < measures.length; m++) {
            const measure = measures[m];
            const measureNumber = parseInt(measure.getAttribute('number') || '1', 10);
            
            // Attributes can contain divisions and time signature
            const attributesList = measure.getElementsByTagName('attributes');
            if (attributesList.length > 0) {
                const attr = attributesList[0];
                const divisionsList = attr.getElementsByTagName('divisions');
                if (divisionsList.length > 0) divisions = parseInt(divisionsList[0].textContent, 10);
                
                const timeList = attr.getElementsByTagName('time');
                if (timeList.length > 0) {
                    const time = timeList[0];
                    const beatsList = time.getElementsByTagName('beats');
                    const beatTypeList = time.getElementsByTagName('beat-type');
                    if (beatsList.length > 0) beatsPerMeasure = parseInt(beatsList[0].textContent, 10);
                    if (beatTypeList.length > 0) beatType = parseInt(beatTypeList[0].textContent, 10);
                }
            }

            let currentMeasureCursor = 0;
            let lastNoteStart = 0;

            // Iterate through child nodes to handle backups/forwards
            const children = measure.children;
            for (let i = 0; i < children.length; i++) {
                const node = children[i];
                const nodeName = node.nodeName.toLowerCase();

                if (nodeName === 'note') {
                    const isRest = node.getElementsByTagName('rest').length > 0;
                    const isChord = node.getElementsByTagName('chord').length > 0;
                    
                    const durationEl = node.getElementsByTagName('duration');
                    const duration = durationEl.length > 0 ? parseInt(durationEl[0].textContent || '0', 10) : 0;
                    
                    const voiceEl = node.getElementsByTagName('voice');
                    const voice = voiceEl.length > 0 ? voiceEl[0].textContent : '1';
                    
                    const staffEl = node.getElementsByTagName('staff');
                    const staff = staffEl.length > 0 ? staffEl[0].textContent : '1';

                    let noteStartInDivisions;
                    if (isChord) {
                        noteStartInDivisions = lastNoteStart;
                    } else {
                        noteStartInDivisions = currentMeasureCursor;
                        lastNoteStart = currentMeasureCursor;
                        currentMeasureCursor += duration;
                    }

                    if (!isRest) {
                        const stepEl = node.getElementsByTagName('step');
                        const octaveEl = node.getElementsByTagName('octave');
                        
                        const step = stepEl.length > 0 ? stepEl[0].textContent : 'C';
                        const octave = octaveEl.length > 0 ? octaveEl[0].textContent : '4';
                        
                        const alterEl = node.getElementsByTagName('alter');
                        const alter = alterEl.length > 0 ? alterEl[0].textContent : null;
                        
                        let stepName = step;
                        if (alter) {
                            const alterVal = parseInt(alter, 10);
                            if (alterVal === 1) stepName += '#';
                            else if (alterVal === -1) stepName += 'b';
                            else if (alterVal === 2) stepName += '##';
                            else if (alterVal === -2) stepName += 'bb';
                        }
                        
                        const pitch = `${stepName}${octave}`;
                        const midi = parsePitchToMidi(pitch);

                        const startBeatInMeasure = noteStartInDivisions / divisions;
                        const absoluteBeat = cumulativeBeats + startBeatInMeasure;
                        const timeSec = absoluteBeat * secPerBeat;
                        const durationBeats = duration / divisions;

                        const timeModList = node.getElementsByTagName('time-modification');
                        let tupletInfo = null;
                        if (timeModList.length > 0) {
                            const timeMod = timeModList[0];
                            tupletInfo = {
                                actual: parseInt(timeMod.getElementsByTagName('actual-notes')[0]?.textContent || '1', 10),
                                normal: parseInt(timeMod.getElementsByTagName('normal-notes')[0]?.textContent || '1', 10)
                            };
                        }

                        timeline.push({
                            measure: measureNumber,
                            beat: Math.floor(startBeatInMeasure) + 1,
                            beatFraction: startBeatInMeasure % 1,
                            durationBeats: durationBeats,
                            timeSec: timeSec,
                            start: timeSec,
                            dur: durationBeats * secPerBeat,
                            pitch: pitch,
                            midi: midi,
                            voice: voice,
                            staff: parseInt(staff, 10),
                            tuplet: tupletInfo
                        });
                    }
                } else if (nodeName === 'backup') {
                    const durationEl = node.getElementsByTagName('duration');
                    const duration = durationEl.length > 0 ? parseInt(durationEl[0].textContent || '0', 10) : 0;
                    currentMeasureCursor -= duration;
                } else if (nodeName === 'forward') {
                    const durationEl = node.getElementsByTagName('duration');
                    const duration = durationEl.length > 0 ? parseInt(durationEl[0].textContent || '0', 10) : 0;
                    currentMeasureCursor += duration;
                }
            }

            cumulativeBeats += beatsPerMeasure;
        }
    }

    timeline.sort((a, b) => (a.start - b.start) || (a.midi - b.midi));

    return {
        timeline,
        metadata: {
            beatsPerMeasure,
            beatType
        }
    };
}

export function parseTimeline(lessonType, lessonData, tempo) {
    if (lessonType === 'json') {
        const effectiveTempo = lessonData.tempo || tempo || 60;
        const secPerBeat = TIMING.SECONDS_IN_MINUTE / effectiveTempo;
        const beatsPerMeasure = lessonData.timeSignature?.numerator || 4;
        const beatType = lessonData.timeSignature?.denominator || 4;

        const timeline = lessonData.notes.map(n => {
            const midi = n.midi ?? parsePitchToMidi(n.pitch || '');
            let measure = n.measure;
            let beat = n.beat;
            let beatFraction = n.beatFraction;
            let durationBeats = n.durationBeats;
            let timeSec = n.timeSec ?? n.start;

            if (measure === undefined || beat === undefined) {
                const startSec = n.start ?? 0;
                const totalBeats = startSec / secPerBeat;
                measure = Math.floor(totalBeats / beatsPerMeasure) + 1;
                const beatInMeasure = totalBeats % beatsPerMeasure;
                beat = Math.floor(beatInMeasure) + 1;
                beatFraction = beatInMeasure % 1;
                if (timeSec === undefined) timeSec = startSec;
            } else if (timeSec === undefined) {
                const totalBeats = (measure - 1) * beatsPerMeasure + (beat - 1) + (beatFraction || 0);
                timeSec = totalBeats * secPerBeat;
            }

            if (durationBeats === undefined) {
                const durSec = n.dur ?? 0;
                durationBeats = durSec / secPerBeat;
            }

            return {
                ...n,
                midi,
                start: timeSec ?? 0,
                timeSec: timeSec ?? 0,
                measure,
                beat,
                beatFraction,
                durationBeats
            };
        });

        return {
            timeline,
            metadata: {
                beatsPerMeasure,
                beatType
            }
        };
    } else if (lessonType === 'musicxml') {
        return simpleMusicXMLtoTimeline(lessonData, tempo);
    }
    return { timeline: [], metadata: { beatsPerMeasure: 4, beatType: 4 } };
}
