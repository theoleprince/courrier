import 'fake-indexeddb/auto';
import '@testing-library/jest-dom/vitest';

// jsdom's Blob polyfill does not implement `arrayBuffer()` (real browsers do).
// Patched here for tests only; production code (services/crypto.ts) relies on
// the standard Blob API.
// jsdom does not implement canvas 2D rendering; genererLogoMonogramme() already
// degrades to an empty string when getContext() returns null, but jsdom logs a
// noisy "not implemented" error to stderr for every call. Silenced here.
if (typeof HTMLCanvasElement !== 'undefined') {
  HTMLCanvasElement.prototype.getContext = (() => null) as typeof HTMLCanvasElement.prototype.getContext;
}
