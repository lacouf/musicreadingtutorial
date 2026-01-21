
import { describe, it, expect } from 'vitest';
import { simpleMusicXMLtoTimeline, exampleMusicXML } from '../TimeLineParser';

// JSDOM is used by vitest for DOMParser
describe('TimeLineParser - MusicXML', () => {
    it('extracts measure and beat information correctly', () => {
        const tempo = 60; // 1 beat = 1 second
        const result = simpleMusicXMLtoTimeline(exampleMusicXML, tempo);
        const timeline = result.timeline;

        expect(timeline).toHaveLength(3);
        
        // First note: C4, duration 1, measure 1, beat 1
        expect(timeline[0]).toMatchObject({
            pitch: 'C4',
            measure: 1,
            beat: 1,
            beatFraction: 0,
            durationBeats: 1,
            timeSec: 0,
            midi: 60
        });

        // Second note: D4, duration 1, measure 1, beat 2
        expect(timeline[1]).toMatchObject({
            pitch: 'D4',
            measure: 1,
            beat: 2,
            beatFraction: 0,
            durationBeats: 1,
            timeSec: 1,
            midi: 62
        });

        // Third note: E4, duration 2, measure 1, beat 3
        expect(timeline[2]).toMatchObject({
            pitch: 'E4',
            measure: 1,
            beat: 3,
            beatFraction: 0,
            durationBeats: 2,
            timeSec: 2,
            midi: 64
        });
    });

    it('handles chords correctly', () => {
        const chordXML = `<?xml version="1.0" encoding="UTF-8"?>
<score-partwise version="3.1">
  <part id="P1">
    <measure number="1">
      <attributes>
        <divisions>1</divisions>
        <time><beats>4</beats><beat-type>4</beat-type></time>
      </attributes>
      <note>
        <pitch><step>C</step><octave>4</octave></pitch>
        <duration>2</duration>
      </note>
      <note>
        <chord/>
        <pitch><step>E</step><octave>4</octave></pitch>
        <duration>2</duration>
      </note>
    </measure>
  </part>
</score-partwise>`;
        
        const result = simpleMusicXMLtoTimeline(chordXML, 60);
        const timeline = result.timeline;
        expect(timeline).toHaveLength(2);
        
        // Both should start at beat 1
        expect(timeline[0].beat).toBe(1);
        expect(timeline[0].pitch).toBe('C4');
        
        expect(timeline[1].beat).toBe(1);
        expect(timeline[1].pitch).toBe('E4');
    });
});
