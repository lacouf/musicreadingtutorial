import { render, screen, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
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
            render(
                <MemoryRouter>
                    <App />
                </MemoryRouter>
            );
        });
        expect(screen.getByText(/Piano/i)).toBeInTheDocument();
        // Use a more specific selector or check for the heading
        expect(screen.getByRole('heading', { name: /Piano Master/i })).toBeInTheDocument();
    });

    it('has STRICT_WINDOW_SECONDS defined', () => {
        // This test specifically checks for the regression we just fixed
        expect(TIMING.STRICT_WINDOW_SECONDS).toBeDefined();
        expect(TIMING.STRICT_WINDOW_SECONDS).toBeGreaterThan(0);
    });

    it('initializes with correct default values', async () => {
        await act(async () => {
            render(
                <MemoryRouter>
                    <App />
                </MemoryRouter>
            );
        });
        expect(screen.getByText(/lesson/i)).toBeInTheDocument();
        expect(screen.getByDisplayValue('C4')).toBeInTheDocument();
        expect(screen.getByDisplayValue('G4')).toBeInTheDocument();
    });
});
