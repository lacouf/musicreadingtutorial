// src/components/ScrollingCanvas.jsx
import React, { useEffect, useRef } from 'react';
import { RENDERING } from '../core/constants';

export default function ScrollingCanvas({ stavesCanvas, notesCanvas, viewportWidth, viewportHeight, scrollOffset, playheadX, playheadFlash, renderTrigger, clipX = 0 }) {
    const canvasRef = useRef(null);

    useEffect(() => {
        const vis = canvasRef.current;
        if (!vis) return;
        vis.width = viewportWidth;
        vis.height = viewportHeight;

        const ctx = vis.getContext('2d');
        ctx.clearRect(0, 0, vis.width, vis.height);

        // Draw the static staves (background: clef, time sig, lines)
        if (stavesCanvas) {
            ctx.drawImage(stavesCanvas, 0, 0);
        }

        // Draw the scrolling notes, clipped to start after the clef/time signature
        if (notesCanvas) {
            let sx = Math.floor(scrollOffset);
            let dx = 0;
            
            // Handle lead-in (negative scroll)
            if (sx < 0) {
                dx = -sx;
                sx = 0;
            }

            ctx.save();
            ctx.beginPath();
            // Clip region: from clipX to the right end
            ctx.rect(clipX, 0, vis.width - clipX, vis.height);
            ctx.clip();

            ctx.drawImage(notesCanvas, sx, 0, vis.width - dx, vis.height, dx, 0, vis.width - dx, vis.height);
            
            ctx.restore();
        }

        // Draw playhead
        ctx.fillStyle = playheadFlash || RENDERING.PLAYHEAD_COLOR;
        ctx.fillRect(playheadX - (RENDERING.PLAYHEAD_LINE_WIDTH / 2), 0, RENDERING.PLAYHEAD_LINE_WIDTH, vis.height);

    }, [stavesCanvas, notesCanvas, viewportWidth, viewportHeight, scrollOffset, playheadX, playheadFlash, renderTrigger, clipX]);

    return <canvas ref={canvasRef} style={{ display: 'block' }} />;
}
