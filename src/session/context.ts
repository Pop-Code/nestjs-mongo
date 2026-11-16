import { AsyncLocalStorage } from 'node:async_hooks';

import { ClientSessionContext } from './types';

/**
 * The data stored for one async context (a request, a transaction...).
 */
export interface SessionStore {
    context?: ClientSessionContext;
}

// Shared through the global object, so all the copies of the package loaded in a process
// (for example with a linked package) use the same storage.
const STORAGE_KEY = Symbol.for('nestjs-mongo:session-storage');
const globalStore = globalThis as typeof globalThis & { [STORAGE_KEY]?: AsyncLocalStorage<SessionStore> };

/**
 * The `AsyncLocalStorage` that holds the mongo session of the current async context.
 */
export const sessionStorage: AsyncLocalStorage<SessionStore> = (globalStore[STORAGE_KEY] ??=
    new AsyncLocalStorage<SessionStore>());

/**
 * Run a function in a new session context. Everything called by the function, sync or async,
 * shares this context. Contexts can be nested: the inner context does not change the outer one.
 *
 * {@link SessionLoaderMiddleware} does it for each HTTP request. Use it directly in a CLI command,
 * a queue consumer or a test.
 *
 * @returns The result of the function (a promise for an async function)
 */
export function runInSessionContext<T>(fn: () => T): T {
    return sessionStorage.run({}, fn);
}

/**
 * Returns true when the code runs inside a session context.
 */
export function hasSessionContext(): boolean {
    return sessionStorage.getStore() !== undefined;
}
