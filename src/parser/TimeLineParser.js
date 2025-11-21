// src/parser/TimeLineParser.js

export const exampleJSONLesson = {
    title: 'Simple C Major Exercise',
    tempo: 80,
    notes: [
        // start (s), duration (s), pitch in scientific pitch (e.g., C4), hand
        { start: 0.0, dur: 0.5, pitch: 'C4' },
        { start: 0.5, dur: 0.5, pitch: 'D4' },
        { start: 1.0, dur: 1.0, pitch: 'E4' },
        { start: 2.0, dur: 1.0, pitch: 'G3' },
        { start: 3.0, dur: 1.0, pitch: 'C4' }
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
    // Very small parser: extracts note pitch and duration (in beats) and generates start times in seconds.
    const parser = new DOMParser();
    const doc = parser.parseFromString(xmlString, 'application/xml');
    const notes = Array.from(doc.querySelectorAll('note'))
        .filter(n => !n.querySelector('rest'))
        .map(n => {
            const step = n.querySelector('pitch > step')?.textContent || 'C';
            const alter = n.querySelector('pitch > alter')?.textContent || null;
            const octave = n.querySelector('pitch > octave')?.textContent || '4';
            const dur = parseFloat(n.querySelector('duration')?.textContent || '1');
            const stepName = alter ? `${step}#` : step;
            return { pitch: `${stepName}${octave}`, dur }; // dur is in divisions/beats (approx)
        });

    // convert to seconds assuming divisions=1 and tempo (bpm) -> seconds per beat
    const secPerBeat = 60.0 / tempo;
    let t = 0;
    const timeline = notes.map(n => {
        const item = { start: t, dur: n.dur * secPerBeat, pitch: n.pitch };
        t += n.dur * secPerBeat;
        return item;
    });
    return timeline;
}

export function parseTimeline(lessonType, lessonData, tempo) {
    if (lessonType === 'json') {
        return lessonData.notes.map(n => ({ start: n.start, dur: n.dur, pitch: n.pitch }));
    } else if (lessonType === 'musicxml') {
        return simpleMusicXMLtoTimeline(lessonData, tempo);
    }
    return [];
}
