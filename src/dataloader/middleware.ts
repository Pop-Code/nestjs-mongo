import { Injectable, NestMiddleware } from '@nestjs/common';
import { createNamespace } from 'cls-hooked';
import Debug from 'debug';
import { Request, Response } from 'express';
import { v1 as uuid } from 'uuid';

import { DEBUG, LOADER_SESSION_NAME } from '../constants';
import { InjectManager } from '../decorators';
import { MongoManager } from '../manager';
import { DataloaderService } from './service';

@Injectable()
export class DataLooaderMiddleware implements NestMiddleware {
    protected log = Debug(DEBUG + ':DataLooaderMiddleware');

    constructor(
        @InjectManager() protected readonly em: MongoManager,
        protected readonly dataloaderService: DataloaderService
    ) {}

    use(req: Request, res: Response, next: Function) {
        const namespace = createNamespace(LOADER_SESSION_NAME);
        const loaderId = uuid();
        req[LOADER_SESSION_NAME + '_uuid'] = loaderId;
        namespace.run(() => {
            this.log('Running namespace %s', LOADER_SESSION_NAME);
            for (const [id, model] of this.em.getModels().entries()) {
                const loader = this.dataloaderService.create(
                    model,
                    this.em,
                    loaderId
                );
                this.log('Register loader %s on current context', id);
                namespace.set(id, loader);
            }
            next();
        });
    }
}
