import { render, screen, fireEvent, act } from '@testing-library/react';
import App from './App';
import { describe, it, expect, vi } from 'vitest';
import { TIMING } from './core/constants';

// Mock dependencies
vi.mock('./components/ScrollingCanvas', () => ({
    default: () => <div data-testid="scrolling-canvas">Canvas</div>
}));

vi.mock('./components/ScoreRenderer', () => ({
    renderScoreToCanvases: vi.fn().mockResolvedValue(undefined)
}));

vi.mock('./midi/MidiInput', () => ({
    initializeMidi: vi.fn(() => () => {})
}));

vi.mock('./audio/AudioSynth', () => ({
    audioSynth: {
        playNote: vi.fn(),
        stopNote: vi.fn(),
        setVolume: vi.fn()
    }
}));

describe('App Component', () => {
    it('renders without crashing', async () => {
        await act(async () => {
            render(<App />);
        });
        expect(screen.getByText(/Music Tutorial/i)).toBeInTheDocument();
    });

    it('has STRICT_WINDOW_SECONDS defined', () => {
        // This test specifically checks for the regression we just fixed
        expect(TIMING.STRICT_WINDOW_SECONDS).toBeDefined();
        expect(TIMING.STRICT_WINDOW_SECONDS).toBeGreaterThan(0);
    });

    it('initializes with correct default values', async () => {
        await act(async () => {
            render(<App />);
        });
        expect(screen.getByText(/Lesson Mode/i)).toBeInTheDocument();
        expect(screen.getByDisplayValue('C3')).toBeInTheDocument();
        expect(screen.getByDisplayValue('C6')).toBeInTheDocument();
    });
});
