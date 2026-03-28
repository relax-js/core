# DataLoader

An interface for loading paginated, sortable data from any data source. Components like tables use this to fetch data on demand as users navigate pages or change sort order.

## Interface

```ts
interface DataLoader {
    load(options: {
        page: number;
        pageSize: number;
        sort: { column: string; direction: 'asc' | 'desc' }[];
    }): Promise<{ rows: Record<string, any>[]; totalCount: number }>;
}
```

### `load(options)`

| Option     | Type                                          | Description                     |
|-----------|-----------------------------------------------|---------------------------------|
| `page`     | `number`                                     | 1-based page number to load     |
| `pageSize` | `number`                                     | Number of rows per page         |
| `sort`     | `{ column: string; direction: 'asc' \| 'desc' }[]` | Sort specifications       |

**Returns** `Promise<{ rows: Record<string, any>[]; totalCount: number }>`

- `rows` - The data for the requested page
- `totalCount` - Total number of rows across all pages (used for pagination)

## Example

```ts
import { DataLoader } from '@anthropic-ai/relax.js/core';

class UserDataLoader implements DataLoader {
    async load(options) {
        const params = new URLSearchParams({
            page: options.page.toString(),
            pageSize: options.pageSize.toString(),
            sort: JSON.stringify(options.sort),
        });

        const response = await fetch(`/api/users?${params}`);
        return response.json();
    }
}
```

## Using with Pager

```ts
import { DataLoader, Pager, PageSelectedEvent } from '@anthropic-ai/relax.js/core';

const loader: DataLoader = new UserDataLoader();
const result = await loader.load({ page: 1, pageSize: 25, sort: [] });

const pager = new Pager(container, result.totalCount, 25);

container.addEventListener('pageselected', async (e: PageSelectedEvent) => {
    const data = await loader.load({ page: e.page, pageSize: 25, sort: [] });
    pager.update(data.totalCount);
    // render data.rows...
});
```
