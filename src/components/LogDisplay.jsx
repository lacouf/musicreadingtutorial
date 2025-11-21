// src/components/LogDisplay.jsx
import React from 'react';

export default function LogDisplay({ log }) {
    return (
        <div style={{ marginTop: 10 }}>
            <h4>Log</h4>
            <div style={{ maxHeight: 200, overflow: 'auto', background: '#fafafa', padding: 8 }}>
                {log.map((l, i) => <div key={i}><code>{l}</code></div>)}
            </div>
        </div>
    );
}
