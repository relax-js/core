# Pager

Renders pagination buttons (Previous, page numbers, Next) inside a container element and dispatches a `PageSelectedEvent` when the user clicks a page.

## Usage

```ts
import { Pager, PageSelectedEvent } from '@anthropic-ai/relax.js/core';

const container = document.querySelector('.pager');
const pager = new Pager(container, totalCount, pageSize);

container.addEventListener('pageselected', (e: PageSelectedEvent) => {
    console.log('Selected page:', e.page);
});
```

## Constructor

```ts
new Pager(container: HTMLElement, totalCount: number, pageSize: number)
```

| Parameter    | Description                          |
|-------------|--------------------------------------|
| `container` | The element to render buttons into   |
| `totalCount`| Total number of items across all pages |
| `pageSize`  | Number of items per page             |

## Methods

### `update(totalCount: number)`

Updates the total count and re-renders the buttons. If the current page exceeds the new page count, it resets to the last page.

### `getCurrentPage(): number`

Returns the current 1-based page number.

## PageSelectedEvent

Dispatched on the container element when the user selects a page. Bubbles and is composed.

| Property | Type     | Description               |
|----------|----------|---------------------------|
| `page`   | `number` | The selected page number  |

### Listening for page changes

```ts
container.addEventListener('pageselected', (e: PageSelectedEvent) => {
    const rows = await loader.load({
        page: e.page,
        pageSize: 25,
        sort: [],
    });
    // render rows...
});
```
