// utils/route-tag.js

import { dirname } from 'path';
import { fileURLToPath } from 'url';

/**
 * Extracts the route category from the file's full path.
 * Example: routes/api/bbox → returns "api" as API tag.
 */
export function routeTag(importUrl) {
    const __filename = fileURLToPath(importUrl);
    const __dirname = dirname(__filename);

    // normalize path separator
    const normalizedPath = __dirname.replace(/\\/g, '/');

    const match = normalizedPath.match(/\/routes\/([^/]+)/);
    return match ? match[1] : 'unknown';
}
