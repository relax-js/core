/**
 * @module fieldPath
 * The field name notation shared by `setFormData()` and `readData()`, so what one writes
 * the other reads back into the same shape.
 *
 * A name addresses a place in the data object: `product.name` is a property of a nested
 * object, `variants[0].size` an element of an array, `hobbies[]` a whole array collected
 * from every field of that name.
 */

/**
 * Splits a field name into its path segments. Bracketed segments keep their brackets so a
 * consumer can tell `[0]` from a property called `0`.
 *
 * @example
 * splitFieldPath('supplier.contact.email'); // ['supplier', 'contact', 'email']
 * splitFieldPath('variants[0].size');       // ['variants', '[0]', 'size']
 */
export function splitFieldPath(path: string): string[] {
    const segments: string[] = [];
    let current = '';
    let inBrackets = false;

    for (const char of path) {
        if (char === '[' && !inBrackets) {
            if (current) {
                segments.push(current);
                current = '';
            }
            inBrackets = true;
            current += char;
        } else if (char === ']' && inBrackets) {
            current += char;
            segments.push(current);
            current = '';
            inBrackets = false;
        } else if (char === '.' && !inBrackets) {
            if (current) {
                segments.push(current);
                current = '';
            }
        } else {
            current += char;
        }
    }

    if (current) {
        segments.push(current);
    }

    return segments;
}

/**
 * Reads the value a field path addresses in `data`, or `undefined` when any step is missing.
 */
export function getByFieldPath(data: object, path: string): unknown {
    return splitFieldPath(path).reduce<any>((result, segment) => {
        if (!result || typeof result !== 'object') return undefined;
        return result[segmentKey(segment)];
    }, data);
}

/**
 * Writes `value` where the field path points, creating the objects and arrays on the way.
 * A numeric bracket segment such as `[0]` creates an array, anything else an object.
 */
export function setByFieldPath(data: Record<string, unknown>, path: string, value: unknown): void {
    const segments = splitFieldPath(path);
    let current: any = data;

    segments.forEach((segment, index) => {
        const key = segmentKey(segment);
        if (index === segments.length - 1) {
            current[key] = value;
            return;
        }
        current[key] ??= isIndex(segments[index + 1]) ? [] : {};
        current = current[key];
    });
}

function segmentKey(segment: string): string {
    return segment.startsWith('[') && segment.endsWith(']') ? segment.slice(1, -1) : segment;
}

function isIndex(segment: string): boolean {
    return /^\[\d+\]$/.test(segment);
}
