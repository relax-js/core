import { describe, it, expect } from 'vitest';
import { resolveValue } from '../src/tools';

describe('resolveValue', () => {
    it('should_resolve_top_level_property', () => {
        expect(resolveValue(['name'], { name: 'Alice' })).toBe('Alice');
    });

    it('should_resolve_nested_property', () => {
        const data = { address: { city: 'Stockholm' } };
        expect(resolveValue(['address', 'city'], data)).toBe('Stockholm');
    });

    it('should_return_undefined_for_null_in_path', () => {
        const data = { user: null };
        expect(resolveValue(['user', 'name'], data as any)).toBeUndefined();
    });

    it('should_return_undefined_for_missing_property', () => {
        expect(resolveValue(['missing'], {})).toBeUndefined();
    });

    it('should_return_undefined_for_deeply_missing_path', () => {
        expect(resolveValue(['a', 'b', 'c'], { a: { x: 1 } })).toBeUndefined();
    });

    it('should_return_undefined_for_null_value', () => {
        expect(resolveValue(['val'], { val: null })).toBeUndefined();
    });

    it('should_return_truthy_values_like_numbers', () => {
        expect(resolveValue(['val'], { val: 42 })).toBe(42);
    });

    it('should_return_boolean_true', () => {
        expect(resolveValue(['val'], { val: true })).toBe(true);
    });

    it('should_resolve_with_empty_path', () => {
        const data = { name: 'test' };
        expect(resolveValue([], data)).toBe(data);
    });
});
