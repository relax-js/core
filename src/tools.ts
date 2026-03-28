/**
 * Resolves a deeply nested value from an object using a path array.
 * Safely navigates through the object tree, returning undefined if any
 * segment in the path is null or undefined.
 *
 * Used internally by template engines to access data properties,
 * but also useful for general-purpose deep property access.
 *
 * @param path - Array of property names forming the path to the value
 * @param context - The object to resolve the value from
 * @returns The resolved value, or undefined if path cannot be resolved
 *
 * @example
 * // Access nested property
 * const user = { address: { city: 'Stockholm' } };
 * const city = resolveValue(['address', 'city'], user);
 * // Returns: 'Stockholm'
 *
 * @example
 * // Safe access with missing properties
 * const data = { user: null };
 * const name = resolveValue(['user', 'name'], data);
 * // Returns: undefined (doesn't throw)
 *
 * @example
 * // Use with template expression paths
 * const path = 'user.profile.avatar'.split('.');
 * const avatar = resolveValue(path, context);
 */
export function resolveValue(
    path: string[],
    context: Record<string, any>
): any | undefined {
    let value = context;

    for (const key of path) {
        if (value === undefined || value === null) {
            return undefined;
        }

        value = value[key];
    }

    return value !== undefined && value !== null ? value : undefined;
}
  