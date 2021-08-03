import { Injectable } from '@nestjs/common';
import { getNamespace } from 'cls-hooked';
import Debug from 'debug';
import { ClientSession } from 'mongodb';

import { DEBUG, MONGO_SESSION_KEY, SESSION_LOADER_NAMESPACE } from '../constants';
import { TransactionsOrchestrator } from './orchestrator';
import { ClientSessionContext } from './types';

@Injectable()
export class SessionLoaderService {
    protected log = Debug(`${DEBUG}:SessionLoaderService`);

    getSession() {
        return getNamespace(SESSION_LOADER_NAMESPACE);
    }

    getSessionContext(): ClientSessionContext {
        return this.getSession()?.get?.(MONGO_SESSION_KEY);
    }

    setSessionContext(mongoClientSession: ClientSession): void {
        this.log('Registering mongo session on namespace %s', SESSION_LOADER_NAMESPACE);

        const context = this.getSession();
        const orchestrator = new TransactionsOrchestrator(this.log);

        context?.set?.(MONGO_SESSION_KEY, {
            session: mongoClientSession,
            orchestrator
        });
    }

    clearSessionContext(): void {
        this.log('Clearing mongo session on namespace %s', SESSION_LOADER_NAMESPACE);
        this.getSession()?.set?.(MONGO_SESSION_KEY, undefined);
    }
}
