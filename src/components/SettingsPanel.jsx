import React from 'react';
import { exampleJSONLesson } from '../parser/TimeLineParser';

export default function SettingsPanel({
    mode,
    minNote,
    setMinNote,
    maxNote,
    setMaxNote,
    enabledDurations,
    setEnabledDurations,
    includeSharps,
    setIncludeSharps,
    validateNoteLength,
    setValidateNoteLength,
    onGenerate
}) {
    return (
        <div className="bg-white p-10 rounded-[2.5rem] shadow-xl border border-gray-50 flex flex-col">
            <h3 className="text-xl font-black text-gray-800 mb-8 flex items-center gap-3 italic">
                <span className="w-2.5 h-8 bg-brand-secondary rounded-full"></span>
                Settings
            </h3>

            {mode === 'practice' ? (
                <div className="space-y-6 flex-1 flex flex-col">
                    <div className="grid grid-cols-2 gap-4">
                        <div className="bg-brand-bg/50 p-4 rounded-3xl border border-white shadow-inner">
                            <span className="text-[10px] font-black text-gray-400 uppercase block text-center mb-1">Min</span>
                            <input value={minNote} onChange={(e) => setMinNote(e.target.value)} className="w-full bg-transparent text-center font-black text-xl text-brand-primary outline-none" />
                        </div>
                        <div className="bg-brand-bg/50 p-4 rounded-3xl border border-white shadow-inner">
                            <span className="text-[10px] font-black text-gray-400 uppercase block text-center mb-1">Max</span>
                            <input value={maxNote} onChange={(e) => setMaxNote(e.target.value)} className="w-full bg-transparent text-center font-black text-xl text-brand-primary outline-none" />
                        </div>
                    </div>

                    <div className="space-y-3">
                        <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest block ml-1 text-center">Note Types</span>
                        <div className="grid grid-cols-2 gap-2">
                            {[
                                { id: 'whole', label: 'Whole (1/1)' },
                                { id: 'half', label: 'Half (1/2)' },
                                { id: 'quarter', label: 'Quarter (1/4)' },
                                { id: 'eighth', label: 'Eighth (1/8)' },
                                { id: 'sixteenth', label: '16th (1/16)' }
                            ].map(({ id, label }) => (
                                <label key={id} className={`flex items-center gap-2 p-2 rounded-xl transition-all border cursor-pointer ${
                                    id === 'quarter' ? 'bg-violet-50 border-violet-100 opacity-80 cursor-default' : 'bg-gray-50 border-transparent hover:bg-gray-100 hover:border-white'
                                }`}>
                                    <input 
                                        type="checkbox" 
                                        checked={id === 'quarter' ? true : enabledDurations[id]} 
                                        disabled={id === 'quarter'}
                                        onChange={(e) => setEnabledDurations(prev => ({ ...prev, [id]: e.target.checked }))} 
                                        className="w-4 h-4 accent-brand-primary rounded shadow-sm" 
                                    />
                                    <span className="text-[9px] font-black text-gray-500 uppercase tracking-tighter">{label}</span>
                                </label>
                            ))}
                        </div>
                    </div>

                    <div className="space-y-3">
                        <label className="flex items-center gap-4 p-4 bg-gray-50 rounded-3xl hover:bg-gray-100 transition-colors cursor-pointer border-2 border-transparent hover:border-white">
                            <input type="checkbox" checked={includeSharps} onChange={(e) => setIncludeSharps(e.target.checked)} className="w-6 h-6 accent-brand-secondary rounded-lg" />
                            <span className="font-black text-gray-600 text-xs uppercase tracking-widest">Sharps</span>
                        </label>

                        <label className="flex items-center gap-4 p-4 bg-gray-50 rounded-3xl hover:bg-gray-100 transition-colors cursor-pointer border-2 border-transparent hover:border-white">
                            <input type="checkbox" checked={validateNoteLength} onChange={(e) => setValidateNoteLength(e.target.checked)} className="w-6 h-6 accent-brand-accent rounded-lg" />
                            <span className="font-black text-gray-600 text-xs uppercase tracking-widest">Validate Hold</span>
                        </label>
                    </div>

                    <button 
                        onClick={onGenerate}
                        className="mt-auto w-full py-5 font-black bg-brand-secondary hover:bg-amber-600 text-white rounded-3xl transition-all shadow-xl shadow-amber-100 active:scale-95 text-xs uppercase tracking-[0.2em]"
                    >
                        Generate
                    </button>
                </div>
            ) : (
                <div className="flex-1 flex flex-col items-center justify-center text-center space-y-6">
                    <div className="w-24 h-24 bg-brand-bg rounded-full flex items-center justify-center text-5xl shadow-inner border border-white">📜</div>
                    <div className="space-y-2">
                        <div className="text-[10px] font-black text-gray-400 uppercase tracking-[0.3em]">Playing</div>
                        <div className="font-black text-brand-primary text-xl leading-tight">{exampleJSONLesson.title}</div>
                    </div>
                    <p className="text-xs text-gray-400 font-medium px-4 leading-relaxed leading-relaxed italic opacity-80">"Every master was once a beginner. Keep practice!"</p>
                </div>
            )}
        </div>
    );
}
