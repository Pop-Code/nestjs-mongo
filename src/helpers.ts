import { DEFAULT_CONNECTION_NAME } from './constants';

export { ObjectId } from 'mongodb';

export const isClass = (fn: any) => /^\s*class/.test(fn.toString());

export function getRepositoryToken(
    model: string,
    connectionName: string = DEFAULT_CONNECTION_NAME
) {
    return `${connectionName}_${model}Repository`;
}

export function getDataloaderToken(
    model: string,
    connectionName: string = DEFAULT_CONNECTION_NAME
) {
    return `${connectionName}_${model}Dataloader`;
}

export function getConfigToken(
    connectionName: string = DEFAULT_CONNECTION_NAME
) {
    return `${connectionName}_MongoConfig`;
}

export function getConnectionToken(
    connectionName: string = DEFAULT_CONNECTION_NAME
) {
    return `${connectionName}_MongoConnection`;
}

export function getManagerToken(
    connectionName: string = DEFAULT_CONNECTION_NAME
) {
    return `${connectionName}_MongoManager`;
}
