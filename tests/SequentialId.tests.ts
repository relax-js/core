import { describe, it, expect, beforeEach } from 'vitest';
import { generateSequentialId } from '../src/SequentialId';

describe('SequentialId', () => {
    describe('generateSequentialId', () => {
        it('should_return_a_base36_string', () => {
            const id = generateSequentialId(0);
            expect(id).toMatch(/^[0-9a-z]+$/);
        });

        it('should_generate_unique_ids_for_same_baseId', () => {
            const id1 = generateSequentialId(1);
            const id2 = generateSequentialId(1);
            expect(id1).not.toBe(id2);
        });

        it('should_generate_different_ids_for_different_baseIds', () => {
            const id1 = generateSequentialId(0);
            const id2 = generateSequentialId(1);
            expect(id1).not.toBe(id2);
        });

        it('should_throw_when_baseId_is_negative', () => {
            expect(() => generateSequentialId(-1)).toThrow('baseId must be between 0 and');
        });

        it('should_throw_when_baseId_exceeds_max', () => {
            expect(() => generateSequentialId(1_048_576)).toThrow('baseId must be between 0 and');
        });

        it('should_accept_max_valid_baseId', () => {
            const id = generateSequentialId(1_048_575);
            expect(id).toMatch(/^[0-9a-z]+$/);
        });
    });
});
