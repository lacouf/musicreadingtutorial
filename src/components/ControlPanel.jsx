import React from 'react';
import { audioSynth } from '../audio/AudioSynth';

export default function ControlPanel({
    paused,
    togglePause,
    restart,
    userBpm,
    setUserBpm
}) {
    return (
        <div className="bg-white p-10 rounded-[2.5rem] shadow-xl border border-gray-50 flex flex-col gap-8">
            <div className="flex items-center justify-between">
                <h3 className="text-xl font-black text-gray-800 flex items-center gap-3 italic">
                    <span className="w-2.5 h-8 bg-brand-primary rounded-full"></span>
                    Dashboard
                </h3>
                <button onClick={restart} className="text-[10px] font-black text-brand-primary bg-brand-bg px-4 py-2 rounded-xl hover:bg-violet-100 transition-colors tracking-tighter">
                    RESTART SESSION
                </button>
            </div>
            
            <button 
                onClick={togglePause} 
                className={`w-full py-6 font-black rounded-[2rem] transition-all active:scale-[0.97] shadow-xl text-lg ${
                    paused 
                        ? 'bg-green-500 hover:bg-green-600 text-white shadow-green-100' 
                        : 'bg-brand-secondary hover:bg-amber-500 text-white shadow-amber-100'
                }`}
            >
                {paused ? '▶ START PLAYING' : '⏸ PAUSE SCROLL'}
            </button>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                <div className="space-y-4">
                    <div className="flex justify-between text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">
                        <span>Tempo</span>
                        <span className="text-brand-primary">{Math.round(userBpm)} BPM</span>
                    </div>
                    <input
                        type="range" min="10" max="240" step="1" value={userBpm}
                        onChange={(e) => setUserBpm(Number(e.target.value))}
                        className="w-full accent-brand-primary h-2.5 bg-gray-100 rounded-full appearance-none cursor-pointer"
                    />
                </div>

                <div className="space-y-4">
                    <div className="flex justify-between text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">
                        <span>Volume</span>
                    </div>
                    <input
                        type="range" min="0" max="1" step="0.05" defaultValue="0.3"
                        onChange={(e) => audioSynth.setVolume(Number(e.target.value))}
                        className="w-full accent-brand-accent h-2.5 bg-gray-100 rounded-full appearance-none cursor-pointer"
                    />
                </div>
            </div>
        </div>
    );
}
