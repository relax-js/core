const fs = require('fs');
const path = require('path');

/**
 * Fails publishing when a path named in package.json `exports` is missing on disk, so a stale or
 * partial dist cannot ship an entry point that consumers are told to import.
 */
const pkg = require('./package.json');

const missing = Object.entries(pkg.exports).flatMap(([entry, targets]) =>
    Object.values(targets)
        .filter((target) => !fs.existsSync(path.join(__dirname, target)))
        .map((target) => `${entry} -> ${target}`)
);

if (missing.length > 0) {
    console.error('Missing export targets:\n  ' + missing.join('\n  '));
    process.exit(1);
}
console.log('All export targets exist');
