
import { describe, it, expect } from 'vitest';
import { AVAILABLE_LESSONS } from '../TimeLineParser';

describe('AVAILABLE_LESSONS Integrity', () => {
    it('should have unique IDs for all lessons', () => {
        const ids = AVAILABLE_LESSONS.map(l => l.id);
        const uniqueIds = new Set(ids);
        expect(ids.length).toBe(uniqueIds.size);
    });

    it('should have a name for all lessons', () => {
        AVAILABLE_LESSONS.forEach(lesson => {
            expect(lesson.name).toBeDefined();
            expect(typeof lesson.name).toBe('string');
        });
    });

    it('should have exactly one source of truth (data, xml, or file)', () => {
        /**
         * REGRESSION PREVENTION: 
         * A lesson should not have both 'data' (JSON) and 'xml' properties
         * unless specifically intended, as the loader prioritizes one over the other.
         * In this project, having both usually means an incomplete placeholder is 
         * overriding full data.
         */
        AVAILABLE_LESSONS.forEach(lesson => {
            const sources = [];
            if (lesson.data) sources.push('data');
            if (lesson.xml) sources.push('xml');
            if (lesson.file) sources.push('file');

            expect(sources.length, `Lesson "${lesson.id}" should have exactly one data source, but found: ${sources.join(', ')}`).toBe(1);
        });
    });

    it('should have valid JSON data if using the data property', () => {
        AVAILABLE_LESSONS.filter(l => l.data).forEach(lesson => {
            expect(lesson.data.notes).toBeDefined();
            expect(Array.isArray(lesson.data.notes)).toBe(true);
            expect(lesson.data.notes.length).toBeGreaterThan(0);
        });
    });
});
