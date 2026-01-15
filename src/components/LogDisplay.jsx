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
        <div 
            ref={logContainerRef} 
            className="h-full overflow-y-auto bg-white p-3 font-mono text-[10px] text-gray-600 shadow-inner"
        >
            {log.length === 0 && <div className="text-gray-400 italic">No events yet...</div>}
            {log.map((l, i) => (
                <div key={i} className="border-b border-gray-50 last:border-0 py-0.5">
                    {l}
                </div>
            ))}
        </div>
    );
}
