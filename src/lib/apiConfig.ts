/**
 * Centralized backend URL configuration.
 *
 * In production, set the VITE_BACKEND_URL environment variable to the
 * Render service URL (e.g. https://nbbc-04la.onrender.com).
 * Locally it falls back to http://localhost:3001.
 */

const backendUrl =
  import.meta.env.VITE_BACKEND_URL?.replace(/\/+$/, '') ||
  'http://localhost:3001';

/** Base URL for REST API calls (e.g. "https://nbbc-04la.onrender.com") */
export const API_BASE = backendUrl;

/**
 * WebSocket URL derived from the backend URL.
 * https:// → wss://   |   http:// → ws://
 */
export const WS_URL = backendUrl
  .replace(/^https:\/\//, 'wss://')
  .replace(/^http:\/\//, 'ws://');
