import { Injectable, NestMiddleware } from '@nestjs/common';
import { createNamespace } from 'cls-hooked';
import Debug from 'debug';
import { Request, Response } from 'express';

import { DEBUG, SESSION_LOADER_NAMESPACE } from '../constants';

@Injectable()
export class SessionLoaderMiddleware implements NestMiddleware {
    protected log = Debug(`${DEBUG}:SessionLoaderMiddleware`);
    protected static readonly ns = createNamespace(SESSION_LOADER_NAMESPACE);

    use(_: Request, __: Response, next: (error?: Error | any) => void) {
        SessionLoaderMiddleware.ns.run(() => {
            this.log('Running namespace %s', SESSION_LOADER_NAMESPACE);
            next();
        });
    }
}
