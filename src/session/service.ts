import { Injectable } from '@nestjs/common';
import { getNamespace } from 'cls-hooked';
import Debug from 'debug';
import { ClientSession } from 'mongodb';

import { DEBUG, MONGO_SESSION_KEY, SESSION_LOADER_NAMESPACE } from '../constants';

@Injectable()
export class SessionLoaderService {
    protected log = Debug(`${DEBUG}:SessionLoaderService`);

    getSession() {
        return getNamespace(SESSION_LOADER_NAMESPACE);
    }

    getMongoSession(): ClientSession | undefined {
        const session = this.getSession();
        return session?.get?.(MONGO_SESSION_KEY);
    }

    setMongoSession(mongoClientSession: ClientSession): void {
        this.log(
            'Registering mongo session on namespace %s',
            SESSION_LOADER_NAMESPACE
        );

        const session = this.getSession();
        session?.set?.(MONGO_SESSION_KEY, mongoClientSession);
    }

    clearMongoSession(): void {
        this.log(
            'Clearing mongo session on namespace %s',
            SESSION_LOADER_NAMESPACE
        );
        const session = this.getSession();
        session?.set?.(MONGO_SESSION_KEY, undefined);
    }
}
