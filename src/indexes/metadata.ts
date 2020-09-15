import { ClassType } from 'class-transformer/ClassTransformer';
import { find } from 'lodash';
import { IndexOptions } from 'mongodb';

import { INDEX_METADATA_NAME } from '../constants';
import { EntityInterface } from '../interfaces/entity';
import { MongoManager } from '../manager';

export interface IndexMetadata {
    property: string;
    metadata: IndexOptions;
}

export function setIndexMetadata(
    target: any,
    property: string,
    metadata: IndexOptions
) {
    let targetMetadata: IndexMetadata[] | undefined = Reflect.getMetadata(
        INDEX_METADATA_NAME,
        target
    );
    if (targetMetadata === undefined) {
        targetMetadata = [];
    }
    targetMetadata.push({ property, metadata });
    Reflect.defineMetadata(
        INDEX_METADATA_NAME,
        targetMetadata,
        target.constructor
    );
}

export function getIndexMetadatas(target: any): IndexMetadata[] | undefined {
    return Reflect.getMetadata(INDEX_METADATA_NAME, target);
}

export function getIndexMetadata(
    target: any,
    property: string
): IndexMetadata | undefined {
    const metas = Reflect.getMetadata(INDEX_METADATA_NAME, target);
    return find(metas, (meta) => meta.property === property);
}

export async function createIndexes<Model extends EntityInterface>(
    model: ClassType<Model>,
    manager: MongoManager
) {
    const indexes = getIndexMetadatas(model);
    if (indexes === undefined) {
        return;
    }
    for (const index of indexes) {
        await manager
            .getCollection(model)
            .createIndex(index.property, index.metadata);
    }
}
