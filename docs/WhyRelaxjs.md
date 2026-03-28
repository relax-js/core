# Why Relaxjs?

A deeper look at the differences between modern frameworks and the Relaxjs approach.

## Architecture Over Tooling

Reactive frameworks often market themselves as solutions to complex problems like cascading updates or high-frequency data. Relaxjs takes the stance that these are architectural challenges, not tooling deficiencies.

By choosing Relaxjs, you reject the idea that a library should magically fix "bad" data flow. Instead, you accept the responsibility of designing a clean architecture. Relaxjs offers less "safety net" for poor architecture in exchange for total control and performance.

If you believe that complexity should be managed by better design patterns, not by heavier JavaScript bundles, then Relaxjs is the right tool.

### The "Spreadsheet" Problem

**The framework pitch:** "If Cell C depends on B, and B depends on A, you need a reactive engine to automatically recalculate everything when A changes, or you'll lose sync."

**The reality:** Explicit communication is safer than implicit magic. Use standard Events or Signals. If Component A changes, it dispatches an event. Component B listens, updates, and dispatches its own event. You don't need a hidden dependency graph; you need a clear event taxonomy. By keeping updates explicit, you eliminate the "spaghetti code" of invisible side effects that plague large reactive apps.

See [Typed Events for Decoupling](#1-typed-events-for-decoupling) for implementation details.

### The "Thrashing" Problem

**The framework pitch:** "If your backend sends 50 updates per second (like a stock ticker), you need a Virtual DOM to batch them and prevent the UI from freezing."

**The reality:** Fix the leak, don't buy a bigger bucket. Sending 50 DOM updates per second is inefficient regardless of the framework.

Solve the root cause: throttle or debounce the data at the source (the socket or the API handler) to match the human perception limit (~60fps). If you feed the DOM efficient data, direct updates are faster than any Virtual DOM could ever be.

```typescript
class StockTicker extends HTMLElement {
    private socket: WebSocket;
    private pending: Map<string, number> = new Map();
    private frameId: number | null = null;

    connectedCallback() {
        this.socket = new WebSocket('/stocks');
        this.socket.onmessage = (e) => {
            const { symbol, price } = JSON.parse(e.data);
            this.pending.set(symbol, price);  // Coalesce updates
            this.scheduleRender();
        };
    }

    private scheduleRender() {
        if (this.frameId) return;
        this.frameId = requestAnimationFrame(() => {
            this.frameId = null;
            for (const [symbol, price] of this.pending) {
                this.updatePrice(symbol, price);
            }
            this.pending.clear();
        });
    }
}
```

### The "Prop Drilling" Problem

**The framework pitch:** "Passing data down through 10 layers of components is tedious. You need 'Context' or 'Global Stores' to teleport data to the bottom."

**The reality:** Deep nesting is a symptom of rigid composition. Instead of nesting logic inside logic, use Slots to compose your UI at the top level. Flatten the hierarchy. If `App` owns the data and `Avatar` needs it, put `Avatar` inside a slot of `Header`. This removes the need for intermediate components to act as "data mules."

See [Composition over Injection](#3-composition-over-injection) for implementation details.

---

## Virtual DOM Diffing vs Direct DOM Manipulation

**Framework approach:** React, Vue, and others maintain a virtual representation of the DOM in memory. When state changes, they diff the virtual tree against the previous version and batch updates to the real DOM.

**Relaxjs approach:** You manipulate the DOM directly. When you call `element.textContent = 'new value'`, that's exactly what happens. There is no intermediate representation, no diffing algorithm, no batched updates.

**Won't this cause flickering?** No. Browsers already batch DOM updates within the same JavaScript task. Multiple DOM changes in synchronous code are rendered together in a single paint. The browser's [rendering pipeline](https://developer.mozilla.org/en-US/docs/Web/Performance/How_browsers_work#render) handles this automatically, and it's what virtual DOM implementations rely on underneath anyway.

**Why this matters:**
- Debugging is straightforward. Set a breakpoint and see exactly what changes
- No "stale closure" bugs from captured state in render functions
- Performance is predictable: one DOM operation = one DOM operation
- No framework-specific DevTools required to understand what's happening

```typescript
// What you write is what happens
// Browser batches these into a single repaint
this.nameSpan.textContent = user.name;
this.emailSpan.textContent = user.email;
this.avatar.src = user.avatarUrl;
```

## Reactive State Management vs Explicit Updates

**Framework approach:** Frameworks track dependencies automatically. Change a reactive variable and the framework figures out what needs to re-render. This requires proxies, signals, or compiler transforms to intercept property access.

**Relaxjs approach:** You decide when and what to update. There's no magic tracking. If you want the UI to change, you change it.

**Isn't that tedious?** Not with Relaxjs utilities. Functions like `setFormData()` populate entire forms from objects. `readData()` extracts typed data back. You get explicit control without the boilerplate.

**Why this matters:**
- No accidental re-renders from touching a tracked property
- No debugging sessions trying to understand "why did this re-render?"
- Memory usage is predictable, with no subscription graphs or dependency tracking overhead
- Works naturally with any data structure, including classes with methods

```typescript
// Explicit updates made easy with Relaxjs utilities
async function loadUser(id: string) {
    const user = await fetch(`/api/users/${id}`).then(r => r.json());
    setFormData(this.form, user);  // One call updates the entire form
}

async function saveUser() {
    const user = readData(this.form);  // Typed object, ready for the backend
    await fetch('/api/users', { method: 'POST', body: JSON.stringify(user) });
}
```

## Custom Template Syntax vs Standard HTML

**Framework approach:** JSX, Angular templates, Vue SFCs. Each framework has its own syntax that requires compilation. Editors need plugins for proper syntax highlighting and error checking.

**Relaxjs approach:** Standard HTML. Your templates are either HTML strings, `<template>` elements, or DOM APIs. No compilation step required for templates.

**Why this matters:**
- Any HTML you know works, with no learning curve for template syntax
- No build step required for template processing
- Server-rendered HTML works without hydration complexity
- Copy HTML from anywhere and it just works

```html
<!-- Standard HTML, no special syntax -->
<form>
    <input name="email" type="email" required>
    <button type="submit">Save</button>
</form>
```

## Framework Lifecycle vs Native Web Component Lifecycle

**Framework approach:** Each framework defines its own lifecycle: `useEffect`, `onMounted`, `ngOnInit`, `componentDidMount`. These have framework-specific timing guarantees and cleanup patterns.

**Relaxjs approach:** Web Components have a [standard lifecycle](https://developer.mozilla.org/en-US/docs/Web/API/Web_components/Using_custom_elements#custom_element_lifecycle_callbacks) defined by the browser: `connectedCallback`, `disconnectedCallback`, `attributeChangedCallback`. These are part of the web platform.

**Why this matters:**
- Lifecycle behavior is documented on [MDN](https://developer.mozilla.org/en-US/docs/Web/API/Web_components), not framework docs
- Skills transfer to any Web Component project
- No framework version upgrades changing lifecycle timing
- Browser DevTools understand the lifecycle natively

```typescript
class MyComponent extends HTMLElement {
    connectedCallback() {
        // Called when added to DOM (standard browser behavior)
    }

    disconnectedCallback() {
        // Called when removed (clean up here)
    }
}
```

## Magic Re-renders vs Explicit Control

**Framework approach:** Change state and the framework decides what to re-render. This often involves reconciliation algorithms, shouldComponentUpdate checks, or fine-grained reactivity tracking.

**Relaxjs approach:** Nothing re-renders unless you explicitly update it. The DOM stays exactly as you left it until you change it.

**Why this matters:**
- No wasted renders because you only update what needs updating
- No memoization dance (`useMemo`, `useCallback`, `React.memo`)
- Third-party libraries can't trigger unexpected re-renders
- Animations and transitions work naturally without fighting the framework

```typescript
// Only updates what changed
if (user.name !== previousName) {
    this.nameElement.textContent = user.name;
}
```

## Custom Rendering Pipeline vs Native Async/Await

**Framework approach:** Frameworks manage their own rendering schedules. React has concurrent mode and Suspense. Vue has the async component and `nextTick`. These interact in complex ways with async operations.

**Relaxjs approach:** JavaScript's native `async/await` works exactly as expected. Fetch data, await the result, update the DOM. No framework scheduler to consider.

**A note on async lifecycle methods:** Web Component lifecycle callbacks like `connectedCallback` are synchronous. Marking them `async` works, but the browser doesn't await the returned Promise. The element connects immediately, and your async code continues afterward. This is actually ideal for loading patterns:

```typescript
connectedCallback() {
    this.showLoading();  // Runs synchronously when element connects
    this.loadData();     // Kicks off async work
}

private async loadData() {
    try {
        const data = await fetch('/api/data').then(r => r.json());
        this.render(data);
    } catch (error) {
        this.showError(error);
    }
}
```

**Why this matters:**
- `async/await` behaves identically to any other JavaScript code
- No special handling for loading states; just use a boolean
- No Suspense boundaries or fallback components required
- Error handling with standard `try/catch`

## "But What About Complex State?"

Reactive frameworks justify their complexity with scenarios like:

- Shopping cart displayed in header, sidebar, and checkout
- Form fields with cascading dependencies
- Real-time updates across many components
- Deeply nested components needing shared data

These aren't technology limitations. They're architectural problems. Follow three principles and they vanish:

### 1. Typed Events for Decoupling

**Framework solution:** Redux, Pinia, RxJS services. These are global stores that track subscriptions and trigger re-renders automatically.

**Web Component solution:** Event classes. Create a class extending `Event` with typed properties. Components dispatch events; interested components listen. Full intellisense, JSDoc support, and searchability.

```typescript
/** Dispatched when the shopping cart changes. */
class CartUpdatedEvent extends Event {
    static readonly type = 'cart-updated';

    constructor(
        public readonly items: CartItem[],
        public readonly total: number
    ) {
        super(CartUpdatedEvent.type, { bubbles: true });
    }
}

// Register in global event map for addEventListener type inference
declare global {
    interface HTMLElementEventMap {
        [CartUpdatedEvent.type]: CartUpdatedEvent;
    }
}

// Service dispatches typed event
class CartService {
    add(item: CartItem) {
        this.items.push(item);
        document.dispatchEvent(new CartUpdatedEvent(this.items, this.calculateTotal()));
    }
}

// Components listen with full type safety
class HeaderCart extends HTMLElement {
    connectedCallback() {
        document.addEventListener(CartUpdatedEvent.type, this.onCartUpdated);
    }

    disconnectedCallback() {
        document.removeEventListener(CartUpdatedEvent.type, this.onCartUpdated);
    }

    private onCartUpdated = (e: CartUpdatedEvent) => {
        // e.items and e.total are typed, so intellisense works
        this.badge.textContent = e.items.length.toString();
    };
}
```

Components stay decoupled. Events are documented with JSDoc and fully typed. Search for `CartUpdatedEvent` to find all producers and consumers.

### 2. Sensible Data Flow

**Framework solution:** Computed properties, signals, `useMemo`. These create automatic dependency graphs that recalculate derived values.

**Web Component solution:** Question why this complexity exists on the client. Send computed totals from the server instead of computing everywhere. If you need client-side derivation, calculate it explicitly when the source changes.

```typescript
setItems(items: OrderItem[]) {
    this.items = items;

    // Calculate derived values right here
    const subtotal = items.reduce((sum, i) => sum + i.price * i.qty, 0);
    const tax = subtotal * 0.1;
    const total = subtotal + tax;

    this.updateDisplay(subtotal, tax, total);
}
```

Complex reactive graphs usually signal too much logic scattered across components. Simplify by centralizing: compute derived values in one service and dispatch events with the results. Components just display pre-computed data.

### 3. Composition over Injection

**Framework solution:** Context, provide/inject, hierarchical injectors. These are mechanisms to skip prop drilling through intermediate components.

**Web Component solution:** Slots. Compose the UI so the data owner places components directly, without intermediaries.

```html
<!-- Instead of drilling data: Layout → Sidebar → UserPanel → Avatar -->

<!-- Compose directly: page owns user, places avatar in layout slot -->
<app-layout>
    <user-avatar slot="header"></user-avatar>
    <nav-menu slot="sidebar"></nav-menu>
    <page-content slot="body"></page-content>
</app-layout>
```

The layout doesn't know about users, it provides slots. The page knows about users and places the avatar directly. No drilling, no context providers.

### The Comparison

| Problem | Framework approach | Web Component approach |
|---------|-------------------|------------------------|
| Shared state | Redux, Pinia, stores | Typed DOM events |
| Derived values | Computed properties, signals | Calculate when source changes |
| Prop drilling | Context, provide/inject | Slots for composition |
| Form dependencies | Reactive forms, watchers | Explicit event handlers |

### The Bottom Line

The limitation isn't in Web Components. It's in whether developers architect solutions or reach for abstractions that hide complexity.

With these principles, your codebase is faster and easier to debug. Every update has a clear cause. Every event has a clear source. If you've spent hours debugging why something re-rendered (or didn't), Relaxjs offers a simpler path.

## Summary

| Aspect | Framework | Relaxjs |
|--------|-----------|---------|
| Learning curve | Framework-specific concepts | Web platform APIs |
| Debugging | Framework DevTools required | Browser DevTools sufficient |
| Bundle size | Framework runtime included | Just your code |
| Upgrades | Migration guides, breaking changes | Stable browser APIs |
| Skills | Framework-specific | Transferable to any project |
