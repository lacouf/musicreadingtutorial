import { useState, useRef, useEffect } from 'react';
import { calculateScrollSpeed } from '../core/layoutUtils';
import { RENDERING } from '../core/constants';

export function usePlayback(lessonMeta, currentBpm, leadInSeconds) {
    const [scrollOffset, setScrollOffset] = useState(0); 
    const [paused, setPaused] = useState(true);
    const pausedRef = useRef(true);
    
    const animationFrameId = useRef(null);
    const lastFrameTimeRef = useRef(null);
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
            lastFrameTimeRef.current = null;
            return;
        }

        const animate = (timestamp) => {
            if (lastFrameTimeRef.current === null) {
                // console.log('usePlayback: First frame at', timestamp);
                lastFrameTimeRef.current = timestamp;
            }
            const deltaTime = (timestamp - lastFrameTimeRef.current) / 1000;
            // console.log('usePlayback: deltaTime', deltaTime);
            totalActiveTimeRef.current += deltaTime;
            lastFrameTimeRef.current = timestamp;

            const currentSpeed = calculateScrollSpeed(currentBpm, RENDERING.PIXELS_PER_BEAT);
            const deltaScroll = deltaTime * currentSpeed;
            const newScrollOffset = scrollOffsetRef.current + deltaScroll;
            
            // console.log('usePlayback: deltaScroll', deltaScroll, 'newOffset', newScrollOffset);
            scrollOffsetRef.current = newScrollOffset;
            setScrollOffset(newScrollOffset);
            animationFrameId.current = requestAnimationFrame(animate);
        };

        animationFrameId.current = requestAnimationFrame(animate);
        return () => cancelAnimationFrame(animationFrameId.current);
    }, [paused, currentBpm, lessonMeta]);

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
        lastFrameTimeRef.current = null;
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
