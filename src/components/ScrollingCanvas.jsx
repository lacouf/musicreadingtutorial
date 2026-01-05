// src/components/ScrollingCanvas.jsx
import React, { useEffect, useRef } from 'react';

export default function ScrollingCanvas({ stavesCanvas, notesCanvas, viewportWidth, viewportHeight, scrollOffset, playheadX, playheadFlash, renderTrigger }) {
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
            let sx = Math.floor(scrollOffset);
            let dx = 0;
            
            // Handle lead-in (negative scroll)
            if (sx < 0) {
                dx = -sx;
                sx = 0;
            }

            ctx.drawImage(notesCanvas, sx, 0, vis.width - dx, vis.height, dx, 0, vis.width - dx, vis.height);
        }

        // Draw playhead
        ctx.fillStyle = playheadFlash || 'rgba(255,0,0,0.9)';
        ctx.fillRect(playheadX - 1, 0, 2, vis.height);

    }, [stavesCanvas, notesCanvas, viewportWidth, viewportHeight, scrollOffset, playheadX, playheadFlash, renderTrigger]);

    return <canvas ref={canvasRef} style={{ display: 'block' }} />;
}
