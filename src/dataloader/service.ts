import { ClassType } from 'class-transformer/ClassTransformer';
import Debug from 'debug';
import { ObjectId } from 'mongodb';
import { DEBUG } from '../constants';
import { EntityInterface } from '../interfaces/entity';
import { MongoManager } from '../manager';
import { MongoDataloader } from './data';

export class DataloaderService {
    protected log = Debug(DEBUG + ':DataloaderService');

    protected readonly loaders: Map<string, MongoDataloader<any>> = new Map();

    getLoaders() {
        return this.loaders;
    }

    get<Model extends EntityInterface>(id: string): MongoDataloader<Model> {
        return this.loaders.get(id);
    }

    register<Model extends EntityInterface>(
        id: string,
        dataloader: MongoDataloader<Model>
    ): DataloaderService {
        this.log('Register %s', id);
        this.loaders.set(id, dataloader);
        return this;
    }

    create<Model extends EntityInterface>(
        model: ClassType<Model>,
        em: MongoManager
    ) {
        const log = this.log.extend(model.name);
        log('creating data loader');
        return new MongoDataloader<Model>(
            async keys => {
                log('find', keys);
                const cursor = await em.find(model, { _id: { $in: keys } });
                return await cursor.toArray();
            },
            {
                batch: true,
                maxBatchSize: 500,
                cache: true,
                cacheKeyFn: (key: ObjectId) => key.toString()
            }
        );
    }

    createAndRegister<Model extends EntityInterface>(
        id: string,
        model: ClassType<Model>,
        em: MongoManager
    ) {
        const dataloader = this.create(model, em);
        this.register(id, dataloader);
        return dataloader;
    }

    unregister(id: string) {
        this.log('Delete %s', id);
        this.loaders.delete(id);
        return this;
    }
}
