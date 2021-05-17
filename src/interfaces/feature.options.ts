import { Type } from '@nestjs/common';

import { MongoRepository } from '../repository';
import { EntityInterface } from './entity';

export interface MongoFeatureModelOptions {
    model: Type<EntityInterface>;
    repository?: Type<MongoRepository<EntityInterface>>;
}

export interface MongoFeatureOptions {
    connectionName?: string;
    models: Array<MongoFeatureModelOptions | Type<EntityInterface>>;
}
