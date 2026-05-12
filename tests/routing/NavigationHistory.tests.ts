import { describe, it, expect } from 'vitest';
import { NavigationHistory, type NavigationEntry } from '../../src/routing/NavigationHistory';

function entry(id: number, routeName = 'r' + id): NavigationEntry {
    return { routeName, params: {}, urlSegments: [routeName], entryId: id };
}

describe('NavigationHistory', () => {
    it('record_pushes_entry_and_advances_index', () => {
        const h = new NavigationHistory();
        expect(h.canGoBack()).toBe(false);
        expect(h.canGoForward()).toBe(false);

        h.record(entry(1));
        expect(h.current()?.entryId).toBe(1);
        expect(h.canGoBack()).toBe(false);

        h.record(entry(2));
        expect(h.current()?.entryId).toBe(2);
        expect(h.canGoBack()).toBe(true);
        expect(h.canGoForward()).toBe(false);
    });

    it('record_after_back_truncates_forward_stack', () => {
        const h = new NavigationHistory();
        h.record(entry(1));
        h.record(entry(2));
        h.record(entry(3));

        h.back();
        expect(h.current()?.entryId).toBe(2);
        expect(h.canGoForward()).toBe(true);

        h.record(entry(4));
        expect(h.current()?.entryId).toBe(4);
        expect(h.canGoForward()).toBe(false);
        expect(h.size()).toBe(3);
    });

    it('back_when_at_first_entry_returns_undefined', () => {
        const h = new NavigationHistory();
        h.record(entry(1));
        expect(h.back()).toBeUndefined();
        expect(h.current()?.entryId).toBe(1);
    });

    it('forward_when_at_last_entry_returns_undefined', () => {
        const h = new NavigationHistory();
        h.record(entry(1));
        h.record(entry(2));
        expect(h.forward()).toBeUndefined();
        expect(h.current()?.entryId).toBe(2);
    });

    it('setIndexById_jumps_to_matching_entry', () => {
        const h = new NavigationHistory();
        h.record(entry(10));
        h.record(entry(20));
        h.record(entry(30));

        const moved = h.setIndexById(10);
        expect(moved?.entryId).toBe(10);
        expect(h.current()?.entryId).toBe(10);
        expect(h.canGoForward()).toBe(true);
    });

    it('setIndexById_with_unknown_id_does_not_change_index', () => {
        const h = new NavigationHistory();
        h.record(entry(10));
        h.record(entry(20));
        const before = h.current()?.entryId;

        expect(h.setIndexById(999)).toBeUndefined();
        expect(h.current()?.entryId).toBe(before);
    });
});
