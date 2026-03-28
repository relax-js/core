# RouteTarget

A web component that renders route components in response to navigation events.

## Overview

`<r-route-target>` listens for `NavigateRouteEvent` events dispatched by the router and renders the appropriate component. Multiple targets can exist on a page, each identified by a unique `name` attribute.

## Usage

### Default Target

```html
<r-route-target></r-route-target>
```

Routes without a `target` property render in the default (unnamed) target.

### Named Targets

```html
<div class="layout">
    <aside>
        <r-route-target name="sidebar"></r-route-target>
    </aside>
    <main>
        <r-route-target></r-route-target>
    </main>
    <aside>
        <r-route-target name="rightPanel"></r-route-target>
    </aside>
</div>
```

### Route Configuration

Routes specify their target with the `target` property:

```typescript
const routes: Route[] = [
    { name: "home", path: "/", componentTagName: "home-page" },
    { name: "user", path: "/users/:userName", target: "rightPanel", componentTagName: "user-profile" },
    { name: "menu", path: "/menu", target: "sidebar", componentTagName: "nav-menu" }
];

defineRoutes(routes);
```

### Programmatic Navigation

```typescript
navigate("user", { params: { userName: "john" }, target: "rightPanel" });
```

## Route Component Registration

Components must be registered as custom elements before routing:

```typescript
// Using componentTagName
const routes: Route[] = [
    { path: "/dashboard", componentTagName: "dashboard-page" }
];

// Using component reference
const routes: Route[] = [
    { path: "/dashboard", component: DashboardPage }
];
```

### Dialog Targets

Add the `dialog` attribute to render routes inside a native `<dialog>` element. This gives you focus trapping, a backdrop, and Escape-to-close for free.

```html
<r-route-target name="modal" dialog></r-route-target>
```

```typescript
const routes: Route[] = [
    { name: "preview", path: "/preview/:id", target: "modal", componentTagName: "item-preview" }
];
```

Style the backdrop with CSS:

```css
r-route-target dialog::backdrop {
    background: rgba(0, 0, 0, 0.5);
}
```

Close the dialog programmatically:

```typescript
const target = document.querySelector<RouteTarget>('r-route-target[name="modal"]');
target.close();
```

## View Transitions

Route transitions are automatically animated using the View Transitions API when the browser supports it. The default effect is a crossfade. Customize with CSS:

```css
::view-transition-old(root) {
    animation: slide-out 0.2s ease-out;
}

::view-transition-new(root) {
    animation: slide-in 0.2s ease-in;
}
```

Dialog targets do not use view transitions (the dialog open/close provides its own visual feedback).

## Attributes

| Attribute | Type | Description |
|-----------|------|-------------|
| `name` | `string` | Identifies this target for named routing. Unnamed targets receive routes without a `target` property. |
| `dialog` | `boolean` | When present, renders content inside a native `<dialog>` element with modal behavior. |

## Behavior

1. Listens for `NavigateRouteEvent` on the document
2. Ignores events targeting other named targets
3. Creates the route's component element
4. Replaces current children with the new component (with view transition animation)
5. For dialog targets: opens the dialog as a modal when content arrives

## Errors

| Error | Cause |
|-------|-------|
| `RouteError: CustomElement has not been registered` | Route's `componentTagName` not defined via `customElements.define()` |
| `RouteError: Failed to find component` | Route's `component` class not registered |
