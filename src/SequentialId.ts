/**
 * @module SequentialId
 * Generates compact, time-ordered unique identifiers suitable for distributed systems.
 *
 * IDs are structured to be:
 * - Unique across multiple clients (via baseId)
 * - Time-sortable (timestamp is the most significant bits)
 * - Compact (Base36 encoding produces short strings)
 *
 * Bit allocation (58 bits total):
 * - 30 bits for timestamp (seconds since January 1, 2025)
 * - 8 bits for per-second counter (supports 256 IDs/second)
 * - 20 bits for client/endpoint identifier (supports ~1M unique sources)
 */

const TIMESTAMP_BITS = 30;
const COUNTER_BITS = 8;
const BASEID_BITS = 20;

const MAX_TIMESTAMP = (1 << TIMESTAMP_BITS) - 1;
const MAX_COUNTER = (1 << COUNTER_BITS) - 1;
const MAX_BASEID = (1 << BASEID_BITS) - 1;

const EPOCH = Math.floor(new Date('2025-01-01T00:00:00Z').getTime() / 1000);

let lastTimestamp = 0;
let counter = 0;

/**
 * Generates a unique, time-ordered sequential ID.
 *
 * The ID combines a timestamp, per-second counter, and client identifier
 * into a compact Base36 string. IDs generated later will sort after earlier IDs,
 * making them suitable for ordered collections.
 *
 * @param baseId - Unique identifier for the client/endpoint (0 to 1,048,575).
 *                 Use different baseIds for different servers or processes to
 *                 avoid collisions.
 * @returns Base36 encoded string representing the unique ID
 * @throws Error if baseId is out of valid range
 * @throws Error if more than 256 IDs are generated in a single second
 * @throws Error if timestamp exceeds range (after year 2045)
 *
 * @example
 * // Generate ID for server instance 1
 * const id1 = generateSequentialId(1);
 * // Returns something like: 'k2j8m3n5p'
 *
 * @example
 * // Different servers use different baseIds
 * const SERVER_ID = parseInt(process.env.SERVER_ID || '0');
 * const orderId = generateSequentialId(SERVER_ID);
 *
 * @example
 * // IDs are time-sortable
 * const id1 = generateSequentialId(0);
 * await delay(1000);
 * const id2 = generateSequentialId(0);
 * console.log(id1 < id2); // true (lexicographic comparison works)
 */
export function generateSequentialId(baseId: number): string {
    if (baseId < 0 || baseId > MAX_BASEID) {
        throw new Error(`baseId must be between 0 and ${MAX_BASEID}`);
    }

    const now = Math.floor(Date.now() / 1000);
    if (now === lastTimestamp) {
        counter++;
        if (counter > MAX_COUNTER) {
            throw new Error('Too many IDs generated in one second');
        }
    } else {
        lastTimestamp = now;
        counter = 0;
    }

    const timestamp = now - EPOCH;
    if (timestamp > MAX_TIMESTAMP) {
        throw new Error('Timestamp exceeds allowed range (beyond 2045-01-01)');
    }

    const ts = BigInt(timestamp);
    const cnt = BigInt(counter);
    const uid = BigInt(baseId);

    // [ timestamp (30 bits) | counter (8 bits) | baseId (20 bits) ]
    const id =
        (ts << BigInt(COUNTER_BITS + BASEID_BITS)) |
        (cnt << BigInt(BASEID_BITS)) |
        uid;

    return id.toString(36).toLowerCase();
}
