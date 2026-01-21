import React from 'react';
import PropTypes from 'prop-types';

/**
 * ScoringPanel component displays the current hits, wrong notes, misses, and accuracy.
 *
 * @param {Object} props
 * @param {number} props.hits - The number of correct hits
 * @param {number} props.wrongNotes - The number of wrong notes played
 * @param {number} props.misses - The number of notes that scrolled past without attempt
 * @returns {JSX.Element} The rendered scoring panel.
 */
const ScoringPanel = ({ hits = 0, wrongNotes = 0, misses = 0, activeNotes = [] }) => {
  const totalMisses = wrongNotes + misses;
  const total = hits + totalMisses;
  const accuracy = total > 0 ? Math.round((hits / total) * 100) : 0;

  const displayNotes = activeNotes.slice(0, 3).map(n => n.pitch).join(', ');

  return (
    <div className="h-full flex flex-col items-center justify-center bg-gray-50/50 rounded-[2rem] border-2 border-dashed border-gray-100 m-2 p-6">
      <span className="text-xs font-black text-gray-400 uppercase tracking-widest mb-4">Performance</span>

      <div className="flex items-center gap-6 mb-4">
        <div className="flex flex-col items-center">
          <span className="text-4xl font-black text-green-500">{hits}</span>
          <span className="text-[10px] font-black text-gray-400 uppercase tracking-tighter">Hits</span>
        </div>

        <div className="flex flex-col items-center">
          <span className="text-4xl font-black text-orange-500">{wrongNotes}</span>
          <span className="text-[10px] font-black text-gray-400 uppercase tracking-tighter">Wrong</span>
        </div>

        <div className="flex flex-col items-center">
          <span className="text-4xl font-black text-red-500">{misses}</span>
          <span className="text-[10px] font-black text-gray-400 uppercase tracking-tighter">Missed</span>
        </div>
      </div>

      <div className="flex flex-col items-center pt-4 border-t border-gray-100 w-full mb-4">
        <span className="text-2xl font-black text-brand-primary">{accuracy}%</span>
        <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Accuracy</span>
      </div>

      <div className="flex flex-col items-center pt-4 border-t border-gray-100 w-full">
        <span className="text-xl font-black text-indigo-500 min-h-[1.75rem]">{displayNotes || '--'}</span>
        <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Active Keys</span>
      </div>
    </div>
  );
};

ScoringPanel.propTypes = {
  hits: PropTypes.number,
  wrongNotes: PropTypes.number,
  misses: PropTypes.number,
  activeNotes: PropTypes.arrayOf(PropTypes.shape({
    pitch: PropTypes.string,
    note: PropTypes.number
  }))
};

export default ScoringPanel;
