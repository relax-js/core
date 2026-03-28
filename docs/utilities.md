# Utilities

Small helper functions and data structures exported from `@relax.js/core/utils`.

## generateSequentialId

Generates compact, time-ordered unique identifiers. IDs sort lexicographically in creation order, making them useful for ordered collections and databases.

```typescript
import { generateSequentialId } from '@relax.js/core/utils';

const id = generateSequentialId(1);
// Returns a Base36 string like 'k2j8m3n5p'
```

### Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `baseId` | `number` | Unique identifier for the client/process (0 to 1,048,575) |

Use different `baseId` values for different servers or processes to avoid collisions:

```typescript
const SERVER_ID = parseInt(process.env.SERVER_ID || '0');
const orderId = generateSequentialId(SERVER_ID);
```

### Structure

Each ID encodes 58 bits of data in Base36:

| Bits | Field | Range |
|------|-------|-------|
| 30 | Timestamp (seconds since 2025-01-01) | Until ~2059 |
| 8 | Per-second counter | 256 IDs/second |
| 20 | Client identifier | ~1M unique sources |

### Time-Sortable

IDs generated later sort after earlier IDs:

```typescript
const id1 = generateSequentialId(0);
// ... wait ...
const id2 = generateSequentialId(0);
console.log(id1 < id2); // true
```

### Errors

- Throws if `baseId` is out of range (0 to 1,048,575)
- Throws if more than 256 IDs are generated in a single second
- Throws if timestamp exceeds range (after ~2059)

## resolveValue

Safely navigates nested object properties using a path array. Returns `undefined` if any segment is null or missing (no exceptions thrown).

```typescript
import { resolveValue } from '@relax.js/core/utils';

const user = { address: { city: 'Stockholm' } };

resolveValue(['address', 'city'], user);
// Returns: 'Stockholm'

resolveValue(['address', 'zip'], user);
// Returns: undefined

// Safe with null values
const data = { user: null };
resolveValue(['user', 'name'], data);
// Returns: undefined (no error)
```

### Use with Dot-Notation Paths

```typescript
const path = 'user.profile.avatar'.split('.');
const avatar = resolveValue(path, context);
```

## LinkedList

A doubly-linked list with O(1) insertion and removal at both ends.

```typescript
import { LinkedList } from '@relax.js/core/utils';

const list = new LinkedList<string>();

list.addFirst('A');
list.addLast('B');
list.addLast('C');

console.log(list.length);      // 3
console.log(list.firstValue);  // 'A'
console.log(list.lastValue);   // 'C'

list.removeFirst(); // Returns 'A'
list.removeLast();  // Returns 'C'
console.log(list.length);      // 1
```

### Node Access

Access the internal `Node` wrappers to traverse or remove specific nodes:

```typescript
let node = list.first;
while (node) {
    console.log(node.value);
    node = node.next;
}

// Remove a specific node
const node = list.first;
node.remove(); // Removes from list and updates length
```

### API

| Method/Property | Description |
|-----------------|-------------|
| `addFirst(value)` | Insert at the beginning |
| `addLast(value)` | Insert at the end |
| `removeFirst()` | Remove and return the first value |
| `removeLast()` | Remove and return the last value |
| `length` | Number of nodes |
| `first` | First `Node` (or `undefined`) |
| `last` | Last `Node` (or `undefined`) |
| `firstValue` | Value of the first node |
| `lastValue` | Value of the last node |

### Node Properties

| Property | Description |
|----------|-------------|
| `value` | The stored value |
| `next` | Next node (or `null`) |
| `prev` | Previous node (or `null`) |
| `remove()` | Remove this node from the list |
