// src/components/ScrollingCanvas.jsx
import React, { useEffect, useRef } from 'react';

export default function ScrollingCanvas({ stavesCanvas, notesCanvas, viewportWidth, viewportHeight, scrollOffset, playheadX, playheadFlash }) {
    const canvasRef = useRef(null);

    useEffect(() => {
        const vis = canvasRef.current;
        if (!vis) return;
        vis.width = viewportWidth;
        vis.height = viewportHeight;

        const ctx = vis.getContext('2d');
        ctx.clearRect(0, 0, vis.width, vis.height);

        // Draw the static staves
        if (stavesCanvas) {
            ctx.drawImage(stavesCanvas, 0, 0);
        }

        // Draw the scrolling notes
        if (notesCanvas) {
            const sx = Math.floor(scrollOffset);
            ctx.drawImage(notesCanvas, sx, 0, vis.width, vis.height, 0, 0, vis.width, vis.height);
        }

        // Draw playhead
        ctx.fillStyle = playheadFlash || 'rgba(255,0,0,0.9)';
        ctx.fillRect(playheadX - 1, 0, 2, vis.height);

    }, [stavesCanvas, notesCanvas, viewportWidth, viewportHeight, scrollOffset, playheadX, playheadFlash]);

    return <canvas ref={canvasRef} style={{ display: 'block' }} />;
}
