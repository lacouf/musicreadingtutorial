// src/components/LogDisplay.jsx
import React, { useEffect, useRef } from 'react';

export default function LogDisplay({ log }) {
    const logContainerRef = useRef(null);

    useEffect(() => {
        if (logContainerRef.current) {
            logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
        }
    }, [log]);

    return (
        <div style={{ marginTop: 10 }}>
            <h4>Log</h4>
            <div ref={logContainerRef} style={{ maxHeight: 200, overflow: 'auto', background: '#fafafa', padding: 8 }}>
                {log.map((l, i) => <div key={i}><code>{l}</code></div>)}
            </div>
        </div>
    );
}
