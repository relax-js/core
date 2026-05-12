import type { RouteData } from './types';

/**
 * Single recorded navigation. Each `<r-route-target>` stores a stack of these
 * so it can replay previously rendered routes when the user navigates back
 * or forward.
 *
 * `entryId` correlates the entry with `history.state.entryId`, so the popstate
 * handler can find the right entry when the user clicks the browser's
 * back/forward buttons.
 */
export interface NavigationEntry {
    routeName: string;
    params: RouteData;
    target?: string;
    urlSegments: string[];
    entryId: number;
}

/**
 * Encapsulated back/forward history for a single route target.
 * Behaves like the browser's own history stack: pushing a new entry while
 * the index sits in the middle of the stack truncates the forward entries.
 *
 * @example
 * const history = new NavigationHistory();
 * history.record({ routeName: 'home', params: {}, urlSegments: [''], entryId: 1 });
 * history.record({ routeName: 'user', params: { id: 'a' }, urlSegments: ['users', 'a'], entryId: 2 });
 * history.canGoBack();        // true
 * history.back();             // returns the 'home' entry
 * history.canGoForward();     // true
 */
export class NavigationHistory {
    private entries: NavigationEntry[] = [];
    private currentIndex = -1;

    record(entry: NavigationEntry): void {
        if (this.currentIndex < this.entries.length - 1) {
            this.entries.length = this.currentIndex + 1;
        }
        this.entries.push(entry);
        this.currentIndex = this.entries.length - 1;
    }

    canGoBack(): boolean {
        return this.currentIndex > 0;
    }

    canGoForward(): boolean {
        return this.currentIndex >= 0 && this.currentIndex < this.entries.length - 1;
    }

    back(): NavigationEntry | undefined {
        if (!this.canGoBack()) return undefined;
        this.currentIndex--;
        return this.entries[this.currentIndex];
    }

    forward(): NavigationEntry | undefined {
        if (!this.canGoForward()) return undefined;
        this.currentIndex++;
        return this.entries[this.currentIndex];
    }

    /**
     * Move the index to the entry with the given `entryId`. Used by the
     * popstate handler to keep the per-target index in sync with the
     * browser's global history position.
     */
    setIndexById(entryId: number): NavigationEntry | undefined {
        const found = this.entries.findIndex((e) => e.entryId === entryId);
        if (found < 0) return undefined;
        this.currentIndex = found;
        return this.entries[found];
    }

    current(): NavigationEntry | undefined {
        if (this.currentIndex < 0) return undefined;
        return this.entries[this.currentIndex];
    }

    /** @internal Used by tests. */
    size(): number {
        return this.entries.length;
    }
}
