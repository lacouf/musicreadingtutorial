// src/components/LessonDisplay.jsx
import React from 'react';

export default function LessonDisplay({ jsonLesson, musicXmlLesson }) {
    return (
        <div className="space-y-3">
            <details className="group bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
                <summary className="flex items-center justify-between p-3 cursor-pointer hover:bg-gray-50 transition-colors list-none">
                    <span className="text-sm font-bold text-gray-600 flex items-center gap-2">
                        📄 Lesson Source (JSON)
                    </span>
                    <span className="text-gray-400 group-open:rotate-180 transition-transform">▼</span>
                </summary>
                <div className="p-3 bg-gray-50 border-t border-gray-100">
                    <pre className="text-[10px] leading-tight font-mono text-gray-500 max-h-48 overflow-auto scrollbar-thin">
                        {JSON.stringify(jsonLesson, null, 2)}
                    </pre>
                </div>
            </details>

            <details className="group bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
                <summary className="flex items-center justify-between p-3 cursor-pointer hover:bg-gray-50 transition-colors list-none">
                    <span className="text-sm font-bold text-gray-600 flex items-center gap-2">
                        🎼 Lesson Source (MusicXML)
                    </span>
                    <span className="text-gray-400 group-open:rotate-180 transition-transform">▼</span>
                </summary>
                <div className="p-3 bg-gray-50 border-t border-gray-100">
                    <pre className="text-[10px] leading-tight font-mono text-gray-500 max-h-48 overflow-auto scrollbar-thin">
                        {musicXmlLesson}
                    </pre>
                </div>
            </details>
        </div>
    );
}