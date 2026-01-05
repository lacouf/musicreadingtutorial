// src/components/ScrollingCanvas.jsx
import React, { useEffect, useRef } from 'react';
import { RENDERING } from '../core/constants';

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
        ctx.fillStyle = playheadFlash || RENDERING.PLAYHEAD_COLOR;
        ctx.fillRect(playheadX - (RENDERING.PLAYHEAD_LINE_WIDTH / 2), 0, RENDERING.PLAYHEAD_LINE_WIDTH, vis.height);

    }, [stavesCanvas, notesCanvas, viewportWidth, viewportHeight, scrollOffset, playheadX, playheadFlash, renderTrigger]);

    return <canvas ref={canvasRef} style={{ display: 'block' }} />;
}
