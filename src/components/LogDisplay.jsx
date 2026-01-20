// src/components/LogDisplay.jsx
import React, { useEffect, useRef, useState } from 'react';

export default function LogDisplay({ log }) {
    const logContainerRef = useRef(null);
    const [copied, setCopied] = useState(false);

    useEffect(() => {
        if (logContainerRef.current) {
            logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
        }
    }, [log]);

    const copyAllLogs = () => {
        const logText = log.join('\n');
        navigator.clipboard.writeText(logText).then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        });
    };

    return (
        <div className="h-full flex flex-col">
            {/* Copy Button */}
            {log.length > 0 && (
                <div className="flex justify-end p-2 border-b border-gray-100">
                    <button
                        onClick={copyAllLogs}
                        className="text-[10px] font-bold text-blue-500 hover:text-blue-700 bg-blue-50 hover:bg-blue-100 px-3 py-1 rounded transition-colors"
                    >
                        {copied ? '✓ Copied!' : 'Copy All'}
                    </button>
                </div>
            )}

            {/* Log Content */}
            <div
                ref={logContainerRef}
                className="flex-1 overflow-y-auto bg-white p-3 font-mono text-[10px] text-gray-600 shadow-inner select-text"
                style={{ userSelect: 'text' }}
            >
                {log.length === 0 && <div className="text-gray-400 italic select-none">No events yet...</div>}
                {log.map((l, i) => (
                    <div key={i} className="border-b border-gray-50 last:border-0 py-0.5 select-text">
                        {l}
                    </div>
                ))}
            </div>
        </div>
    );
}
