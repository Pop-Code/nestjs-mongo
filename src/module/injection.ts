import { Inject } from '@nestjs/common';
import { ClassConstructor } from 'class-transformer';

import { DEFAULT_CONNECTION_NAME } from '../constants';

/**
 * Get the injection token of the repository of a model.
 */
export function getEntityRepositoryToken(model: string, connectionName: string = DEFAULT_CONNECTION_NAME) {
    return `${connectionName}_${model}Repository`;
}

/**
 * Get the injection token of the options of a connection.
 */
export function getConfigToken(connectionName: string = DEFAULT_CONNECTION_NAME) {
    return `${connectionName}_MongoConfig`;
}

/**
 * Get the injection token of the `MongoClient` of a connection.
 */
export function getConnectionToken(connectionName: string = DEFAULT_CONNECTION_NAME) {
    return `${connectionName}_MongoConnection`;
}

/**
 * Get the injection token of the {@link EntityManager} of a connection.
 */
export function getEntityManagerToken(connectionName: string = DEFAULT_CONNECTION_NAME) {
    return `${connectionName}_EntityManager`;
}

/**
 * Inject the `MongoClient` of a connection.
 */
export function InjectMongoClient(connectionName: string = DEFAULT_CONNECTION_NAME) {
    return Inject(getConnectionToken(connectionName));
}

/**
 * Inject the {@link EntityManager} of a connection.
 */
export function InjectEntityManager(connectionName: string = DEFAULT_CONNECTION_NAME) {
    return Inject(getEntityManagerToken(connectionName));
}

/**
 * Inject the repository of a model.
 *
 * @example
 * ```ts
 * constructor(@InjectEntityRepository(User) private readonly users: EntityRepository<User>) {}
 * ```
 */
export function InjectEntityRepository(
    entity: ClassConstructor<any>,
    connectionName: string = DEFAULT_CONNECTION_NAME
) {
    return Inject(getEntityRepositoryToken(entity.name, connectionName));
}
