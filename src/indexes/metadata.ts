import { ClassConstructor } from 'class-transformer';
import { IndexSpecification } from 'mongodb';

import { INDEX_METADATA_NAME } from '../constants';
import { EntityInterface } from '../interfaces/entity';
import { MongoManager } from '../manager';

export interface IndexMetadata {
    property: string;
    metadata: Partial<IndexSpecification>;
}

export function setIndexMetadata(target: any, property: string, metadata: Partial<IndexSpecification>) {
    const constructorName: string = target.constructor.name;
    const metadataName = `${INDEX_METADATA_NAME}:${constructorName}`;
    let targetMetadata: IndexMetadata[] | undefined = Reflect.getMetadata(metadataName, target.constructor);
    if (targetMetadata === undefined) {
        targetMetadata = [];
    }
    targetMetadata.push({ property, metadata });
    Reflect.defineMetadata(metadataName, targetMetadata, target.constructor);
}

export function getIndexMetadatas(target: any): IndexMetadata[] {
    const metadataKeys: string[] = Reflect.getMetadataKeys(target).filter((p) => p.startsWith(INDEX_METADATA_NAME));
    return metadataKeys.reduce<IndexMetadata[]>((previous, current) => {
        return previous.concat(Reflect.getMetadata(current, target));
    }, []);
}

export function getIndexMetadata(target: any, property: string): IndexMetadata | undefined {
    return getIndexMetadatas(target).find((meta) => meta.property === property);
}

export async function createIndexes<Model extends EntityInterface>(
    ModelClass: ClassConstructor<Model>,
    manager: MongoManager
) {
    const indexes: IndexSpecification[] = [];

    // declared indexes
    const indexesMetadata = getIndexMetadatas(ModelClass);
    const collection = manager.getCollection(ModelClass);

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

    if (indexes.length > 0) {
        try {
            await collection.createIndexes(indexes);
        } catch (e) {
            throw new Error(
                `Unable to create index on collection ${collection.namespace}: ${JSON.stringify(indexes)} ${
                    e.message as string
                }`
            );
        }
    }
}
