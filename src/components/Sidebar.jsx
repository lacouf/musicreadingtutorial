import React from 'react';

export default function Sidebar({ isMenuOpen, setIsMenuOpen }) {
    return (
        <aside className="fixed left-0 top-0 w-16 h-full bg-gradient-to-b from-brand-primary via-brand-accent to-brand-primary flex flex-col items-center py-6 shadow-2xl z-[100] border-r border-white/10">
            <button 
                onClick={() => setIsMenuOpen(!isMenuOpen)}
                className="w-10 h-10 flex items-center justify-center bg-white/20 hover:bg-white/30 rounded-xl transition-all active:scale-95 shadow-inner"
                title="Menu"
            >
                <div className="flex flex-col gap-1">
                    <span className={`w-5 h-0.5 bg-white transition-all ${isMenuOpen ? 'rotate-45 translate-y-1.5' : ''}`}></span>
                    <span className={`w-5 h-0.5 bg-white transition-all ${isMenuOpen ? 'opacity-0' : ''}`}></span>
                    <span className={`w-5 h-0.5 bg-white transition-all ${isMenuOpen ? '-rotate-45 -translate-y-1.5' : ''}`}></span>
                </div>
            </button>
            
            <div className="mt-auto flex flex-col gap-4 mb-6">
                <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center text-white text-xl shadow-lg border border-white/5">♫</div>
                <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center text-white text-xl shadow-lg border border-white/5">♥</div>
            </div>
        </aside>
    );
}
