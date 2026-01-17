import { useState, useRef, useEffect } from 'react';
import { calculateScrollSpeed } from '../core/layoutUtils';
import { RENDERING } from '../core/constants';

export function usePlayback(lessonMeta, tempoFactor, leadInSeconds) {
    const [scrollOffset, setScrollOffset] = useState(0); 
    const [paused, setPaused] = useState(true);
    const pausedRef = useRef(true);
    
    const animationFrameId = useRef(null);
    const lastFrameTimeRef = useRef(0);
    const totalActiveTimeRef = useRef(-leadInSeconds);
    const scrollOffsetRef = useRef(0);

    // Sync ref with state
    useEffect(() => {
        pausedRef.current = paused;
    }, [paused]);

    // Animation Loop
    useEffect(() => {
        if (paused) {
            cancelAnimationFrame(animationFrameId.current);
            lastFrameTimeRef.current = 0;
            return;
        }

        const animate = (timestamp) => {
            if (!lastFrameTimeRef.current) lastFrameTimeRef.current = timestamp;
            const deltaTime = (timestamp - lastFrameTimeRef.current) / 1000;
            totalActiveTimeRef.current += deltaTime;
            lastFrameTimeRef.current = timestamp;

            const baseSpeed = calculateScrollSpeed(lessonMeta.tempo, RENDERING.PIXELS_PER_BEAT);
            const currentSpeed = baseSpeed / tempoFactor;
            const deltaScroll = deltaTime * currentSpeed;
            const newScrollOffset = scrollOffsetRef.current + deltaScroll;
            
            scrollOffsetRef.current = newScrollOffset;
            setScrollOffset(newScrollOffset);
            animationFrameId.current = requestAnimationFrame(animate);
        };

        animationFrameId.current = requestAnimationFrame(animate);
        return () => cancelAnimationFrame(animationFrameId.current);
    }, [paused, tempoFactor, lessonMeta]);

    const togglePause = (shouldPause) => {
        setPaused(prev => {
            const newState = shouldPause !== undefined ? shouldPause : !prev;
            return newState;
        });
    };

    const resetPlayback = (newScrollOffset, newTotalTime = -leadInSeconds) => {
        scrollOffsetRef.current = newScrollOffset;
        setScrollOffset(newScrollOffset);
        totalActiveTimeRef.current = newTotalTime;
        lastFrameTimeRef.current = 0;
        setPaused(true);
    };

    return {
        scrollOffset,
        scrollOffsetRef,
        paused,
        pausedRef,
        totalActiveTimeRef,
        togglePause,
        resetPlayback,
        setPaused
    };
}
