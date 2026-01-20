import React from 'react';

/**
 * ScoringPanel component displays the current hits, misses, and accuracy.
 * 
 * @returns {JSX.Element} The rendered scoring panel.
 */
const ScoringPanel = () => {
  // Placeholders for hits, misses and accuracy as requested (logic to be implemented later)
  const hits = 0;
  const misses = 0;
  const accuracy = 0;

  return (
    <div className="h-full flex flex-col items-center justify-center bg-gray-50/50 rounded-[2rem] border-2 border-dashed border-gray-100 m-2 p-6">
      <span className="text-xs font-black text-gray-400 uppercase tracking-widest mb-4">Performance</span>
      
      <div className="flex items-center gap-8 mb-4">
        <div className="flex flex-col items-center">
          <span className="text-4xl font-black text-green-500">{hits}</span>
          <span className="text-[10px] font-black text-gray-400 uppercase tracking-tighter">Hits</span>
        </div>
        
        <div className="flex flex-col items-center">
          <span className="text-4xl font-black text-red-500">{misses}</span>
          <span className="text-[10px] font-black text-gray-400 uppercase tracking-tighter">Misses</span>
        </div>
      </div>

      <div className="flex flex-col items-center pt-4 border-t border-gray-100 w-full">
        <span className="text-2xl font-black text-brand-primary">{accuracy}%</span>
        <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Accuracy</span>
      </div>
    </div>
  );
};

export default ScoringPanel;
