import React from 'react';

export default function Header({ midiSupported }) {
    return (
        <header className="bg-white/90 backdrop-blur-md px-8 py-4 sticky top-0 z-40 border-b border-gray-100 flex items-center justify-between shadow-sm">
            <div className="flex items-center gap-4">
                <span className="text-3xl">🎹</span>
                <h1 className="text-2xl font-black tracking-tight text-gray-800">
                    Piano <span className="text-brand-primary font-comic">Master</span>
                </h1>
            </div>
            
            <div className="flex items-center gap-4">
                <div className={`flex items-center gap-2 px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest shadow-sm border ${
                    midiSupported ? 'bg-green-50 border-green-100 text-green-600' : 'bg-amber-50 border-amber-100 text-amber-600'
                }`}>
                    <span className={`w-2 h-2 rounded-full ${midiSupported ? 'bg-green-500 animate-pulse' : 'bg-amber-500'}`}></span>
                    {midiSupported ? 'MIDI Connected' : 'No MIDI Found'}
                </div>
            </div>
        </header>
    );
}
