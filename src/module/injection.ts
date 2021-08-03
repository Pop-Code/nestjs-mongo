import { Inject } from '@nestjs/common';
import { ClassConstructor } from 'class-transformer';

import { DEFAULT_CONNECTION_NAME } from '../constants';

export function getEntityRepositoryToken(model: string, connectionName: string = DEFAULT_CONNECTION_NAME) {
    return `${connectionName}_${model}Repository`;
}

export function getDataloaderToken(model: string, connectionName: string = DEFAULT_CONNECTION_NAME) {
    return `${connectionName}_${model}Dataloader`;
}

export function getConfigToken(connectionName: string = DEFAULT_CONNECTION_NAME) {
    return `${connectionName}_MongoConfig`;
}

export function getConnectionToken(connectionName: string = DEFAULT_CONNECTION_NAME) {
    return `${connectionName}_MongoConnection`;
}

export function getEntityManagerToken(connectionName: string = DEFAULT_CONNECTION_NAME) {
    return `${connectionName}_EntityManager`;
}

export function InjectMongoClient(connectionName: string = DEFAULT_CONNECTION_NAME) {
    return Inject(getConnectionToken(connectionName));
}

export function InjectEntityManager(connectionName: string = DEFAULT_CONNECTION_NAME) {
    return Inject(getEntityManagerToken(connectionName));
}

export function InjectEntityRepository(
    entity: ClassConstructor<any>,
    connectionName: string = DEFAULT_CONNECTION_NAME
) {
    return Inject(getEntityRepositoryToken(entity.name, connectionName));
}
