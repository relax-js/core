import { describe, it, expect, beforeEach } from 'vitest';
import { copyInputAttributes, copyAttributes } from '../../src/elements/CopyAttributes';

describe('copyInputAttributes', () => {
    beforeEach(() => {
        document.body.innerHTML = '';
    });

    it('should_copy_matching_attributes_from_source_to_target', () => {
        const source = document.createElement('div');
        source.setAttribute('placeholder', 'Enter text');
        const target = document.createElement('input');
        copyInputAttributes(source, target);
        expect(target.getAttribute('placeholder')).toBe('Enter text');
    });

    it('should_return_false_when_no_attributes_match', () => {
        const source = document.createElement('div');
        source.setAttribute('data-custom', 'value');
        const target = document.createElement('input');
        const result = copyInputAttributes(source, target);
        expect(result).toBe(false);
    });
});

describe('copyAttributes', () => {
    it('should_return_false_when_no_attributes_are_present', () => {
        const source = document.createElement('div');
        const target = document.createElement('div');
        const result = copyAttributes(source, target, ['title']);
        expect(result).toBe(false);
    });
});
