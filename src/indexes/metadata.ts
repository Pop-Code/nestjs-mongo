import { ClassType } from 'class-transformer/ClassTransformer';
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
    ModelClass: ClassType<Model>,
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
    for (const property of props) {
        // get relationship metadata
        const rel = getRelationshipMetadata(
            new ModelClass(),
            property,
            manager
        );
        const indexName = `${ModelClass.name}_${property}_relationship`;
        if (rel.indexSpecification !== undefined) {
            indexes.push({
                ...rel.indexSpecification,
                name: indexName
            });
        } else {
            indexes.push({
                key: { [property]: 1 },
                name: indexName
            });
        }
    }
    if (indexes.length > 0) {
        await collection.createIndexes(indexes);
    }
}
