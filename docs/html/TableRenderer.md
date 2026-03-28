# TableRenderer for Web Components

`TableRenderer` is a small helper class that renders table rows inside Web Components using a `<template>` and an array of data. It supports data binding, row updates, and declarative button handlers that call methods on your Web Component.

## ✅ 1. Getting Started

### Minimal Web Component Setup

```ts
import { TableRenderer } from '@relax.js/core/html';

class UserTable extends HTMLElement {
    private renderer!: TableRenderer;

    constructor() {
        super();
        this.attachShadow({ mode: 'open' });
    }

    connectedCallback() {
        this.shadowRoot!.innerHTML = `
            <table>
                <tbody></tbody>
            </table>
            <template id="row-template">
                <tr>
                    <td data-field="name"></td>
                    <td data-field="role"></td>
                </tr>
            </template>
        `;

        const table = this.shadowRoot!.querySelector('table')!;
        const template = this.shadowRoot!.querySelector('#row-template') as HTMLTemplateElement;
        
        this.renderer = new TableRenderer(table, template, 'id', this);
        this.renderer.render([
            { id: 1, name: 'Alice', role: 'Admin' },
            { id: 2, name: 'Bob', role: 'User' }
        ]);
    }
}

customElements.define('user-table', UserTable);
```

**What this does:**
- Clones the `<template>` row for each item
- Fills in `<td data-field="name">` using data values
- Associates each row with its data via the `id` field

## 🛠 2. Updating a Row

Use `update()` to refresh a single row without re-rendering everything:

```ts
this.renderer.update({ id: 2, name: 'Bob Smith', role: 'Moderator' });
```

If a matching row exists (`idColumn` = `"id"`), it will update in-place. If not, a new row is added.

## 🎯 3. Button Event Binding

Add buttons in the template using `onclick="methodName"`.

### Updated Template

```html
<template id="row-template">
    <tr>
        <td data-field="name"></td>
        <td data-field="role"></td>
        <td>
            <button onclick="edit">Edit</button>
        </td>
    </tr>
</template>
```

### Component Method

```ts
edit(data: any, event: MouseEvent) {
    console.log('Editing user:', data);
}
```

**Behavior:**
- `edit` is automatically bound for each row
- It receives the row's `data` as the first argument
- The second argument is the `MouseEvent`

## 📦 4. Using Arguments in Handlers

You can call methods with literal arguments. The remaining arguments are always `data` and `event`.

### Template Example

```html
<button onclick="remove('soft')">Delete</button>
```

### Component Method

```ts
remove(mode: string, data: any, event: MouseEvent) {
    console.log(`Removing (${mode})`, data);
}
```

**How It Works:**
- The string `'soft'` is passed as the first argument
- `data` and `event` are appended automatically

## 🧼 5. Re-rendering Safely

The `.render()` method replaces all rows and cleans up memory:

```ts
this.renderer.render([
    { id: 3, name: 'Charlie', role: 'User' }
]);
```

- Clears old rows and their event listeners
- Rebuilds new rows from the template and data

## 6. Column Sorting with TableSorter

`TableSorter` adds click-to-sort behavior to table headers. Click a `<th>` to cycle through ascending, descending, and unsorted.

### Setup

```ts
import { TableSorter } from '@relax.js/core/html';

class UserTable extends HTMLElement {
    connectedCallback() {
        this.innerHTML = `
            <table>
                <thead>
                    <tr>
                        <th name="name">Name</th>
                        <th name="role">Role</th>
                        <th name="age">Age</th>
                    </tr>
                </thead>
                <tbody></tbody>
            </table>
        `;

        const table = this.querySelector('table')!;
        const sorter = new TableSorter(table, this);
    }
}
```

**How it works:**
- Headers must have a `name` attribute matching the data field
- Click cycles: none -> ascending (arrow up) -> descending (arrow down) -> none
- Sort indicators (arrows) are added/removed automatically

### Handling Sort Events

`TableSorter` dispatches a `SortChangeEvent` on the component:

```ts
import { SortChangeEvent, SortColumn } from '@relax.js/core/html';

this.addEventListener('sortchange', (e: SortChangeEvent) => {
    const sortColumns: SortColumn[] = e.detail;
    // sortColumns = [{ column: 'name', direction: 'asc' }]
    this.fetchSortedData(sortColumns);
});
```

### API

| Method | Description |
|--------|-------------|
| `getSortColumns()` | Returns current sort state as `SortColumn[]` |
| `clear()` | Resets all sorting and emits a `sortchange` event |

```typescript
type SortColumn = { column: string; direction: 'asc' | 'desc' };
```

## 7. Pagination with Pager

`Pager` renders page navigation buttons (Previous, page numbers, Next) and dispatches events on page change.

### Setup

```ts
import { Pager, PageSelectedEvent } from '@relax.js/core/html';

class UserTable extends HTMLElement {
    private pager!: Pager;

    connectedCallback() {
        this.innerHTML = `
            <table><!-- ... --></table>
            <div id="pager"></div>
        `;

        const pagerContainer = this.querySelector('#pager')!;
        this.pager = new Pager(pagerContainer, 100, 10); // 100 items, 10 per page

        pagerContainer.addEventListener('pageselected', (e: PageSelectedEvent) => {
            this.loadPage(e.detail);
        });
    }

    async loadPage(page: number) {
        const data = await fetchUsers(page);
        this.renderer.render(data);
    }
}
```

### Updating Total Count

When the total number of items changes (e.g. after filtering):

```ts
this.pager.update(newTotalCount);
```

### API

| Method | Description |
|--------|-------------|
| `update(totalCount)` | Updates total count and re-renders page buttons |
| `getCurrentPage()` | Returns the current page number |

### Combined Example: TableRenderer + TableSorter + Pager

```ts
import { TableRenderer, TableSorter, Pager } from '@relax.js/core/html';

class ProductList extends HTMLElement {
    private renderer!: TableRenderer;
    private sorter!: TableSorter;
    private pager!: Pager;

    connectedCallback() {
        this.innerHTML = `
            <table>
                <thead>
                    <tr>
                        <th name="name">Name</th>
                        <th name="price">Price</th>
                    </tr>
                </thead>
                <tbody></tbody>
            </table>
            <template id="row-tpl">
                <tr>
                    <td data-field="name"></td>
                    <td data-field="price"></td>
                    <td><button onclick="edit">Edit</button></td>
                </tr>
            </template>
            <div id="pager"></div>
        `;

        const table = this.querySelector('table')!;
        const template = this.querySelector('#row-tpl') as HTMLTemplateElement;

        this.renderer = new TableRenderer(table, template, 'id', this);
        this.sorter = new TableSorter(table, this);
        this.pager = new Pager(this.querySelector('#pager')!, 0, 20);

        this.addEventListener('sortchange', () => this.reload());
        this.querySelector('#pager')!.addEventListener('pageselected', () => this.reload());

        this.reload();
    }

    async reload() {
        const page = this.pager.getCurrentPage();
        const sort = this.sorter.getSortColumns();
        const { items, total } = await fetchProducts(page, sort);
        this.renderer.render(items);
        this.pager.update(total);
    }

    edit(data: any) {
        console.log('Edit product:', data);
    }
}
```