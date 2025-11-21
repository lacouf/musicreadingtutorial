// src/components/ScrollingCanvas.jsx
import React, { useEffect, useRef } from 'react';

export default function ScrollingCanvas({ offscreenCanvas, viewportWidth, viewportHeight, playheadX, pixelsPerSecond }) {
    const canvasRef = useRef(null);
    const rafRef = useRef(null);
    const scrollOffsetRef = useRef(0);
    const startTimeRef = useRef(null);

    useEffect(() => {
        const vis = canvasRef.current;
        if (!vis) return;
        vis.width = viewportWidth;
        vis.height = viewportHeight;

        startTimeRef.current = performance.now();
        scrollOffsetRef.current = 0;

        function loop(ts) {
            if (!startTimeRef.current) startTimeRef.current = ts;
            const elapsed = (ts - startTimeRef.current) / 1000;
            scrollOffsetRef.current = elapsed * pixelsPerSecond;
            drawFrame();
            rafRef.current = requestAnimationFrame(loop);
        }

        function drawFrame() {
            if (!vis || !offscreenCanvas) return;
            const ctx = vis.getContext('2d');
            ctx.clearRect(0, 0, vis.width, vis.height);

            // Draw the scrolling portion of the offscreen canvas
            const sx = Math.floor(scrollOffsetRef.current);
            ctx.drawImage(offscreenCanvas, sx, 0, vis.width, vis.height, 0, 0, vis.width, vis.height);

            // Draw playhead
            ctx.fillStyle = 'rgba(255,0,0,0.9)';
            ctx.fillRect(playheadX - 1, 0, 2, vis.height);
        }

        rafRef.current = requestAnimationFrame(loop);

        return () => {
            cancelAnimationFrame(rafRef.current);
        };
    }, [offscreenCanvas, viewportWidth, viewportHeight, pixelsPerSecond, playheadX]);

    return <canvas ref={canvasRef} style={{ display: 'block' }} />;
}
