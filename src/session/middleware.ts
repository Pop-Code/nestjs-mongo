import { Injectable, NestMiddleware } from '@nestjs/common';
import Debug from 'debug';

import { DEBUG } from '../constants';
import { runInSessionContext } from './context';

/**
 * Runs each request in its own session context (see {@link runInSessionContext}), so a mongo session
 * can be shared by all the operations made while handling the request.
 *
 * Works with the express and fastify adapters (the request/response objects are not used).
 */
@Injectable()
export class SessionLoaderMiddleware implements NestMiddleware {
    protected log = Debug(`${DEBUG}:SessionLoaderMiddleware`);

    use(_: unknown, __: unknown, next: (error?: any) => void) {
        runInSessionContext(() => {
            this.log('Running request in a session context');
            next();
        });
    }
}
