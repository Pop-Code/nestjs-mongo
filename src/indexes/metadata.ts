import { ClassConstructor } from 'class-transformer';
import { find } from 'lodash';
import { IndexSpecification } from 'mongodb';

import { INDEX_METADATA_NAME } from '../constants';
import { EntityInterface } from '../interfaces/entity';
import { MongoManager } from '../manager';
import { getChildrenRelationshipMetadata, getRelationshipMetadata } from '../relationship/metadata';

export interface IndexMetadata {
    property: string;
    metadata: Partial<IndexSpecification>;
}

export function setIndexMetadata(
    target: any,
    property: string,
    metadata: Partial<IndexSpecification>
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
    ModelClass: ClassConstructor<Model>,
    manager: MongoManager
) {
    const indexes: IndexSpecification[] = [];

    // declared indexes
    const indexesMetadata = getIndexMetadatas(ModelClass);
    const collection = await manager.getCollection(ModelClass);
    if (indexesMetadata !== undefined) {
        for (const index of indexesMetadata) {
            const mongoIndex = {
                ...index.metadata,
                key: {
                    [index.property]: 1,
                    ...index.metadata.key
                }
            };
            indexes.push(mongoIndex);
        }
    }

    // relationship indexes
    const props = getChildrenRelationshipMetadata(ModelClass);
    for (const { property } of props) {
        // get relationship metadata
        const rel = getRelationshipMetadata(
            new ModelClass(),
            property,
            manager
        );
        const indexName = `${ModelClass.name}_${property}_relationship`;
        if (typeof rel.indexSpecification === 'object') {
            indexes.push({
                name: indexName,
                ...rel.indexSpecification
            });
        } else if (rel.indexSpecification !== false) {
            indexes.push({
                name: indexName,
                key: { [property]: 1 }
            });
        }
    }
    if (indexes.length > 0) {
        await collection.createIndexes(indexes);
    }
}
