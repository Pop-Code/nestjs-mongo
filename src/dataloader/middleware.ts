import { Injectable, NestMiddleware } from '@nestjs/common';
import { createNamespace } from 'cls-hooked';
import Debug from 'debug';
import { Request, Response } from 'express';
import { v1 as uuid } from 'uuid';

import { DATA_LOADER_NAMESPACE, DEBUG } from '../constants';
import { InjectManager } from '../decorators';
import { MongoManager } from '../manager';
import { DataloaderService } from './service';

@Injectable()
export class DataLoaderMiddleware implements NestMiddleware {
    protected log = Debug(DEBUG + ':DataLooaderMiddleware');
    protected static readonly ns = createNamespace(DATA_LOADER_NAMESPACE);

    constructor(
        @InjectManager() protected readonly em: MongoManager,
        protected readonly dataloaderService: DataloaderService
    ) {}

    use(req: Request, res: Response, next: Function) {
        const loaderId = uuid();
        req[DATA_LOADER_NAMESPACE + '_uuid'] = loaderId;
        DataLoaderMiddleware.ns.run(() => {
            this.log('Running namespace %s', DATA_LOADER_NAMESPACE);
            for (const [id, model] of this.em.getModels().entries()) {
                const loader = this.dataloaderService.create(
                    model,
                    this.em,
                    loaderId
                );
                this.log('Register loader %s on current context', id);
                DataLoaderMiddleware.ns.set(id, loader);
            }
            next();
        });
    }
}
