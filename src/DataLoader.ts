/**
 * Interface for loading paginated data from a data source.
 * Implement this interface to provide data to table or list components
 * that support pagination and sorting.
 *
 * Used by components like `r-table` to fetch data on demand as users
 * navigate through pages or change sort order.
 *
 * @example
 * // Implement for an API-backed data source
 * class UserDataLoader implements DataLoader {
 *     async load(options) {
 *         const params = new URLSearchParams({
 *             page: options.page.toString(),
 *             pageSize: options.pageSize.toString(),
 *             sort: JSON.stringify(options.sort)
 *         });
 *
 *         const response = await fetch(`/api/users?${params}`);
 *         return response.json();
 *     }
 * }
 *
 * @example
 * // Use with a table component
 * const loader: DataLoader = new UserDataLoader();
 * const result = await loader.load({ page: 1, pageSize: 25, sort: [] });
 * table.render(result.rows);
 */
export interface DataLoader {
    /**
     * Loads a page of data with optional sorting.
     *
     * @param options - The loading options
     * @param options.page - The 1-based page number to load
     * @param options.pageSize - Number of rows per page
     * @param options.sort - Array of sort specifications
     * @returns Promise resolving to rows and total count for pagination
     */
    load(options: {
        page: number;
        pageSize: number;
        sort: { column: string; direction: 'asc' | 'desc' }[];
    }): Promise<{ rows: Record<string, any>[]; totalCount: number }>;
}
