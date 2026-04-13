/**
 * A node in the @see LinkedList.
 */
export class Node<T> {
    /**
     * Next node unless last one.
     */
    public next: Node<T> | null = null;
    /**
     * Previous node unless first one.
     */
    public prev: Node<T> | null = null;

    /**
     * Constructor.
     * @param value Value contained in the node.
     */
    constructor(public value: T, private removeCallback: () => void) {}

    /**
     * Remove this node.
     * Will notify the list of the update to ensure correct element count.
     */
    remove() {
        if (this.prev) this.prev.next = this.next;
        if (this.next) this.next.prev = this.prev;
        this.removeCallback();
    }
}

/**
 * A trivial linked list implementation.
 */
export class LinkedList<T> {
    private _first: Node<T> | null = null;
    private _last: Node<T> | null = null;
    private _length = 0;

    /**
     * Add a value to the beginning of the list.
     * @param value Value that should be contained in the node.
     */
    addFirst(value: T) {
        const newNode = this.createNode(value);
        if (!this._first) {
            this._first = newNode;
            this._last = this._first;
        } else {
            newNode.next = this._first;
            this._first.prev = newNode;
            this._first = newNode;
        }

        this._length++;
    }

    /**
     * Add a value to the end of the list.
     * @param value Value that should be contained in a node.
     */
    addLast(value: T) {
        const newNode = this.createNode(value);
        if (!this._last) {
            this._first = newNode;
            this._last = newNode;
        } else {
            newNode.prev = this._last;
            this._last.next = newNode;
            this._last = newNode;
        }

        this._length++;
    }

    private createNode(value: T): Node<T> {
        let node: Node<T>;
        node = new Node(value, () => {
            if (this._first === node) this._first = node.next;
            if (this._last === node) this._last = node.prev;
            this._length--;
        });
        return node;
    }

    /**
     * Remove a node from the beginning of the list.
     * @returns Value contained in the first node.
     */
    removeFirst(): T {
        if (!this._first) {
            throw new Error('The list is empty.');
        }

        const value = this._first.value;
        this._first = this._first.next;
        if (!this._first) this._last = null;
        this._length--;
        return value;
    }

    /**
     * Remove a node from the end of the list.
     * @returns Value contained in the last node.
     */
    removeLast(): T {
        if (!this._last) {
            throw new Error('The list is empty.');
        }

        const value = this._last.value;
        this._last = this._last.prev;
        if (!this._last) this._first = null;
        this._length--;
        return value;
    }

    /**
     * Number of nodes in the list.
     *
     * The count works as long as you do not manually remove nodes (by assigning next/prev to the neighbors).
     */
    get length(): number {
        return this._length;
    }

    /**
     * First node, or `null` if the list is empty.
     */
    get first(): Node<T> | null {
        return this._first;
    }

    /**
     * Contained value of the first node, or `undefined` if the list is empty.
     */
    get firstValue(): T | undefined {
        return this._first?.value;
    }

    /**
     * Last node, or `null` if the list is empty.
     */
    get last(): Node<T> | null {
        return this._last;
    }

    /**
     * Contained value of the last node, or `undefined` if the list is empty.
     */
    get lastValue(): T | undefined {
        return this._last?.value;
    }
}
