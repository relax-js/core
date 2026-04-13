import { describe, it, expect } from 'vitest';
import { LinkedList } from '../../src/collections/LinkedList';

describe('LinkedList', () => {
    it('should_start_empty', () => {
        const list = new LinkedList<number>();
        expect(list.length).toBe(0);
        expect(list.first).toBeNull();
        expect(list.last).toBeNull();
    });

    describe('addFirst', () => {
        it('should_add_single_element_as_first_and_last', () => {
            const list = new LinkedList<number>();
            list.addFirst(1);
            expect(list.firstValue).toBe(1);
            expect(list.lastValue).toBe(1);
            expect(list.length).toBe(1);
        });

        it('should_prepend_to_existing_list', () => {
            const list = new LinkedList<number>();
            list.addFirst(2);
            list.addFirst(1);
            expect(list.firstValue).toBe(1);
            expect(list.lastValue).toBe(2);
            expect(list.length).toBe(2);
        });
    });

    describe('addLast', () => {
        it('should_append_to_existing_list', () => {
            const list = new LinkedList<number>();
            list.addLast(1);
            list.addLast(2);
            expect(list.firstValue).toBe(1);
            expect(list.lastValue).toBe(2);
            expect(list.length).toBe(2);
        });

        it('should_add_single_element_as_first_and_last', () => {
            const list = new LinkedList<number>();
            list.addLast(1);
            expect(list.firstValue).toBe(1);
            expect(list.lastValue).toBe(1);
        });
    });

    describe('removeFirst', () => {
        it('should_remove_and_return_first_value', () => {
            const list = new LinkedList<string>();
            list.addLast('a');
            list.addLast('b');
            expect(list.removeFirst()).toBe('a');
            expect(list.firstValue).toBe('b');
            expect(list.length).toBe(1);
        });

        it('should_throw_when_list_is_empty', () => {
            const list = new LinkedList<number>();
            expect(() => list.removeFirst()).toThrow('The list is empty');
        });
    });

    describe('removeLast', () => {
        it('should_remove_and_return_last_value', () => {
            const list = new LinkedList<string>();
            list.addLast('a');
            list.addLast('b');
            expect(list.removeLast()).toBe('b');
            expect(list.lastValue).toBe('a');
            expect(list.length).toBe(1);
        });

        it('should_throw_when_list_is_empty', () => {
            const list = new LinkedList<number>();
            expect(() => list.removeLast()).toThrow('The list is empty');
        });
    });

    describe('Node.remove', () => {
        it('should_remove_middle_node_and_relink_neighbors', () => {
            const list = new LinkedList<number>();
            list.addLast(1);
            list.addLast(2);
            list.addLast(3);

            const middle = list.first!.next!;
            expect(middle.value).toBe(2);
            middle.remove();

            expect(list.length).toBe(2);
            expect(list.first!.next!.value).toBe(3);
        });

        it('should_update_list_first_pointer_when_removing_head', () => {
            const list = new LinkedList<number>();
            list.addLast(1);
            list.addLast(2);

            list.first!.remove();

            expect(list.length).toBe(1);
            expect(list.firstValue).toBe(2);
            expect(list.lastValue).toBe(2);
        });

        it('should_update_list_last_pointer_when_removing_tail', () => {
            const list = new LinkedList<number>();
            list.addLast(1);
            list.addLast(2);

            list.last!.remove();

            expect(list.length).toBe(1);
            expect(list.firstValue).toBe(1);
            expect(list.lastValue).toBe(1);
        });

        it('should_empty_the_list_when_removing_the_only_node', () => {
            const list = new LinkedList<number>();
            list.addLast(1);

            list.first!.remove();

            expect(list.length).toBe(0);
            expect(list.first).toBeNull();
            expect(list.last).toBeNull();
        });
    });

    describe('traversal', () => {
        it('should_traverse_forward_through_nodes', () => {
            const list = new LinkedList<number>();
            list.addLast(1);
            list.addLast(2);
            list.addLast(3);

            const values: number[] = [];
            let node = list.first;
            while (node) {
                values.push(node.value);
                node = node.next;
            }
            expect(values).toEqual([1, 2, 3]);
        });

        it('should_traverse_backward_through_nodes', () => {
            const list = new LinkedList<number>();
            list.addLast(1);
            list.addLast(2);
            list.addLast(3);

            const values: number[] = [];
            let node = list.last;
            while (node) {
                values.push(node.value);
                node = node.prev;
            }
            expect(values).toEqual([3, 2, 1]);
        });
    });
});
