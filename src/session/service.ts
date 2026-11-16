import { Injectable } from '@nestjs/common';
import Debug from 'debug';
import { ClientSession } from 'mongodb';

import { DEBUG } from '../constants';
import { runInSessionContext, sessionStorage } from './context';
import { TransactionsOrchestrator } from './orchestrator';
import { ClientSessionContext } from './types';

/**
 * Store and read the mongo session of the current async context (using `AsyncLocalStorage`).
 */
@Injectable()
export class SessionLoaderService {
    protected log = Debug(`${DEBUG}:SessionLoaderService`);

    /**
     * Run a function in a new session context, see {@link runInSessionContext}.
     */
    run<T>(fn: () => T): T {
        return runInSessionContext(fn);
    }

    /**
     * Get the mongo session of the current async context, if one was set.
     */
    getSessionContext(): ClientSessionContext {
        return sessionStorage.getStore()?.context;
    }

    /**
     * Set the mongo session of the current async context.
     *
     * @throws Error when the code does not run in a session context
     */
    setSessionContext(mongoClientSession: ClientSession): void {
        const store = sessionStorage.getStore();
        if (store === undefined) {
            throw new Error(
                'No session context: run this code with runInSessionContext(), or in a request handled by SessionLoaderMiddleware'
            );
        }
        this.log('Registering mongo session on the current context');
        store.context = {
            session: mongoClientSession,
            orchestrator: new TransactionsOrchestrator(this.log)
        };
    }

    /**
     * Remove the mongo session of the current async context.
     */
    clearSessionContext(): void {
        const store = sessionStorage.getStore();
        if (store !== undefined) {
            this.log('Clearing mongo session on the current context');
            store.context = undefined;
        }
    }
}
