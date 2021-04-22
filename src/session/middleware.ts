import { Inject, Injectable, NestMiddleware } from '@nestjs/common';
import { createNamespace } from 'cls-hooked';
import Debug from 'debug';
import { Request, Response } from 'express';

import { DEBUG, SESSION_LOADER_NAMESPACE } from '../constants';
import { InjectManager } from '../decorators';
import { MongoManager } from '../manager';
import { SessionLoaderService } from './service';

@Injectable()
export class SessionLoaderMiddleware implements NestMiddleware {
    protected log = Debug(`${DEBUG}:SessionLoaderMiddleware`);
    @InjectManager() protected readonly em: MongoManager;
    @Inject(SessionLoaderService)
    protected readonly service: SessionLoaderService;

    use(_: Request, __: Response, next: Function) {
        createNamespace(SESSION_LOADER_NAMESPACE).run(() => {
            this.log('Running namespace %s', SESSION_LOADER_NAMESPACE);
            next();
        });
    }
}
