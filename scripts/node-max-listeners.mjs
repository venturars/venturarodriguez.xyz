/**
 * Preload for `pnpm dev`: raises Node's default EventEmitter listener cap so Vite +
 * Astro + Tailwind don't trigger MaxListenersExceededWarning on shared FSWatcher.
 * Loaded via NODE_OPTIONS=--import (runs outside Vite's config loader).
 */
import EventEmitter from "node:events";

EventEmitter.defaultMaxListeners = 25;
