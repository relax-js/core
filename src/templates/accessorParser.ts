/**
 * Represents a single step in a property access path
 * Can be either a property name or an array index access
 * @example { type: "property", key: "user" }
 * @example { type: "index", key: "0" }
 */
type PathSegment = {
  type: "property" | "index";
  key: string;
};

/**
 * Represents the result of parsing a dot-notation string into path segments
 * Used internally by the parser to break down property access chains including arrays
 * @example [{ type: "property", key: "users" }, { type: "index", key: "0" }, { type: "property", key: "name" }] for "users[0].name"
 */
type PropertyPath = PathSegment[];

/**
 * Function type that accesses nested properties safely from a record
 * Returns undefined if any property in the chain is missing or null/undefined
 * @example
 * const accessor = createAccessor("user.name");
 * const result = accessor(data); // string | undefined
 */
type PropertyAccessor<T = unknown> = (
  record: Record<string, any>
) => T | undefined;

/**
 * Parser configuration options for customizing dot-notation parsing behavior
 * Used to modify how the parser handles property paths and edge cases
 * @example { delimiter: ".", escapeChar: "\\" }
 */
interface ParserOptions {
  delimiter?: string;
  escapeChar?: string;
}

/**
 * Parses a dot-notation string with array support into path segments
 * Handles escaped delimiters, array indices, and validates input format
 * @param notation - Notation string with dots and brackets (e.g., "users[0].profile.name")
 * @param options - Parser configuration options
 * @returns Array of path segments for property and array access
 * @example
 * parsePath("user.profile.name") // [{ type: "property", key: "user" }, { type: "property", key: "profile" }, { type: "property", key: "name" }]
 * parsePath("users[0].name") // [{ type: "property", key: "users" }, { type: "index", key: "0" }, { type: "property", key: "name" }]
 * parsePath("data\\.file[1]", { escapeChar: "\\" }) // [{ type: "property", key: "data.file" }, { type: "index", key: "1" }]
 */
function parsePath(
  notation: string,
  options: ParserOptions = {}
): PropertyPath {
  const { delimiter = ".", escapeChar = "\\" } = options;

  if (!notation || typeof notation !== "string") {
    throw new Error("Notation must be a non-empty string");
  }

  const segments: PathSegment[] = [];
  let current = "";
  let i = 0;
  let inBrackets = false;
  let bracketContent = "";

  while (i < notation.length) {
    const char = notation[i];
    const currentInDelimLength = notation.substring(i, delimiter.length + i);
    const nextChar = notation[i + 1];
    const nextInDelimLength = notation.substring(i + 1, delimiter.length + i + 1);

    if (
      char === escapeChar &&
      (nextInDelimLength === delimiter || nextChar === "[" || nextChar === "]")
    ) {
      if (inBrackets) {
        bracketContent += nextChar;
      } else {
        current += nextChar;
      }
      i += 2;
    } else if (char === "[" && !inBrackets) {
      if (current) {
        segments.push({ type: "property", key: current });
        current = "";
      }
      inBrackets = true;
      bracketContent = "";
      i++;
    } else if (char === "]" && inBrackets) {
      if (!/^\d+$/.test(bracketContent.trim())) {
        throw new Error(
          `Invalid array index: [${bracketContent}]. Only numeric indices are supported.`
        );
      }
      segments.push({ type: "index", key: bracketContent.trim() });
      inBrackets = false;
      bracketContent = "";
      i++;
    } else if (currentInDelimLength === delimiter && !inBrackets) {
      if (current) {
        segments.push({ type: "property", key: current });
        current = "";
      }
      i += delimiter.length;
    } else if (inBrackets) {
      bracketContent += char;
      i++;
    } else {
      current += char;
      i++;
    }
  }

  if (inBrackets) {
    throw new Error("Unclosed bracket in notation");
  }

  if (current) {
    segments.push({ type: "property", key: current });
  }

  if (segments.length === 0) {
    throw new Error(
      "Invalid notation: must contain at least one property or index"
    );
  }

  return segments;
}

/**
 * Creates an accessor function from a parsed property path with array support
 * The returned function safely navigates nested objects and arrays using the parsed path
 * @param path - Array of path segments to access in sequence
 * @returns Function that takes a record and returns the nested value or undefined
 * @example
 * const path = [{ type: "property", key: "users" }, { type: "index", key: "0" }, { type: "property", key: "name" }];
 * const accessor = createAccessorFromPath(path);
 * accessor({ users: [{ name: "John" }] }) // "John"
 */
function createAccessorFromPath<T = unknown>(
  path: PropertyPath
): PropertyAccessor<T> {
  return (record: Record<string, any>): T | undefined => {
    let current: any = record;

    for (const segment of path) {
      if (current == null) {
        return undefined;
      }

      if (segment.type === "property") {
        if (typeof current !== "object") {
          return undefined;
        }
        current = current[segment.key];
      } else if (segment.type === "index") {
        if (!Array.isArray(current)) {
          return undefined;
        }
        const index = parseInt(segment.key, 10);
        if (index < 0 || index >= current.length) {
          return undefined;
        }
        current = current[index];
      }
    }

    return current as T;
  };
}

/**
 * Main parser function that creates an accessor from notation string with array support
 * Combines path parsing and accessor creation into a single operation
 * @param notation - Notation string with dots and brackets (e.g., "users[0].profile.name")
 * @param options - Parser configuration options
 * @returns Accessor function for the specified property path
 * @example
 * const accessor = createAccessor("user.profile.name");
 * const name = accessor(userData); // safely gets nested property
 *
 * const arrayAccessor = createAccessor("users[0].name");
 * const userName = arrayAccessor(data); // safely accesses array elements
 *
 * const complexAccessor = createAccessor("items[2].meta\\.data.values[1]", { escapeChar: "\\" });
 * const value = complexAccessor(response); // handles escaped dots and nested arrays
 */
function createAccessor<T = unknown>(
  notation: string,
  options: ParserOptions = {}
): PropertyAccessor<T> {
  const path = parsePath(notation, options);
  return createAccessorFromPath<T>(path);
}

/**
 * Utility function to test if a property path exists in a record (with array support)
 * Useful for validation before attempting to access nested properties or array elements
 * @param notation - Notation string with dots and brackets to test
 * @param record - Record to test against
 * @param options - Parser configuration options
 * @returns Boolean indicating if the complete path exists
 * @example
 * hasProperty("user.name", data) // true if data.user.name exists
 * hasProperty("users[0].name", data) // true if data.users[0].name exists
 * hasProperty("missing.path", data) // false if any part is undefined
 */
function hasProperty(
  notation: string,
  record: Record<string, any>,
  options: ParserOptions = {}
): boolean {
  const accessor = createAccessor(notation, options);
  return accessor(record) !== undefined;
}

export {
  createAccessor,
  createAccessorFromPath,
  parsePath,
  hasProperty,
  type PropertyAccessor,
  type PropertyPath,
  type PathSegment,
  type ParserOptions,
};
