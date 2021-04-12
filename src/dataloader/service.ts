import { ClassConstructor } from 'class-transformer';
import { getNamespace } from 'cls-hooked';
import Debug from 'debug';
import { Cursor, ObjectId } from 'mongodb';

import { DEBUG, LOADER_SESSION_NAME } from '../constants';
import { EntityInterface } from '../interfaces/entity';
import { MongoManager } from '../manager';
import { MongoDataloader } from './data';

export class DataloaderService {
    protected log = Debug(DEBUG + ':DataloaderService');

    protected readonly loaders: Map<string, MongoDataloader<any>> = new Map();

    getSession() {
        return getNamespace(LOADER_SESSION_NAME);
    }

    get<Model extends EntityInterface>(
        id: string
    ): MongoDataloader<Model> | undefined {
        if (id === '__ignore__') {
            return;
        }
        this.log('Retrieving dataloader %s', id);
        const session = this.getSession();
        if (session === undefined) {
            this.log('Namespace %s does not exist', LOADER_SESSION_NAME);
            return;
        }
        const loader = session.get(id);
        if (loader === undefined) {
            this.log('Unable to find dataloader %s in session', id);
        }
        return loader;
    }

    create<Model extends EntityInterface>(
        model: ClassConstructor<Model>,
        em: MongoManager,
        uuid: string
    ) {
        this.log('creating data loader %s %s', model.name, uuid);
        const loader = new MongoDataloader<Model>(
            async (keys) => {
                this.log('dataloader %s %s find %o', model.name, uuid, keys);
                const jobs: Array<Promise<Model | Error | undefined>> = [];
                for (const key of keys) {
                    jobs.push(
                        // TODO try to use one query only
                        em.findOne(
                            model,
                            { _id: key },
                            { dataloader: '__ignore__' }
                        )
                    );
                }
                return await Promise.all(
                    jobs.map(async (j) => await j.catch((e) => e))
                );
            },
            {
                batch: true,
                maxBatchSize: 500,
                cache: true,
                cacheKeyFn: (key: ObjectId) => key.toHexString()
            }
        );
        loader.uuid = uuid;
        return loader;
    }

    update<Model extends EntityInterface>(id: string, entity: Model) {
        const loader = this.get(id);
        if (loader === undefined) {
            return false;
        }
        this.log(
            'Updating dataloader %s %s %s',
            loader.uuid,
            entity.constructor.name,
            entity._id
        );
        loader.clear(entity._id).prime(entity._id, entity);
    }

    updateAll<Model extends EntityInterface>(
        id: string,
        entities: Cursor<Model>
    ) {
        const loader = this.get(id);
        if (loader === undefined) {
            return false;
        }
        entities
            .forEach((entity) => {
                this.log(
                    'Updating dataloader %s %s %s',
                    loader.uuid,
                    entity.constructor.name,
                    entity._id
                );
                loader.clear(entity._id).prime(entity._id, entity);
            })
            .catch((e) => console.log(e));
    }

    delete<Model extends EntityInterface>(id: string, entity: Model) {
        const loader = this.get(id);
        if (loader === undefined) {
            return false;
        }
        this.log(
            'Deleting from dataloader %s %s %s',
            loader.uuid,
            entity.constructor.name,
            entity._id
        );
        loader.clear(entity._id);
    }
}
