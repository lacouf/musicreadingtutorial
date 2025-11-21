// src/components/LessonDisplay.jsx
import React from 'react';

export default function LessonDisplay({ jsonLesson, musicXmlLesson }) {
    return (
        <div style={{ marginTop: 10 }}>
            <details>
                <summary>Example lesson (JSON)</summary>
                <pre style={{ maxHeight: 200, overflow: 'auto' }}>{JSON.stringify(jsonLesson, null, 2)}</pre>
            </details>
            <details>
                <summary>Example lesson (MusicXML)</summary>
                <pre style={{ maxHeight: 200, overflow: 'auto' }}>{musicXmlLesson}</pre>
            </details>
        </div>
    );
}
