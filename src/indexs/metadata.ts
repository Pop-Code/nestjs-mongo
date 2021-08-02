import { ClassConstructor } from 'class-transformer';
import { CreateIndexesOptions, IndexDescription } from 'mongodb';

import { INDEX_METADATA_NAME } from '../constants';
import { EntityInterface } from '../entity/interfaces';
import { EntityManager } from '../entity/manager';

export interface IndexMetadata {
    property: string;
    // TODO in next mongodb release, IndexDescription is extending CreateIndexesOptions
    description?: Partial<IndexDescription> & CreateIndexesOptions;
}

export function setIndexMetadata(target: any, metadata: IndexMetadata) {
    const constructorName: string = target.constructor.name;
    const metadataName = `${INDEX_METADATA_NAME}:${constructorName}`;
    let targetMetadata: IndexMetadata[] | undefined = Reflect.getMetadata(metadataName, target.constructor);
    if (targetMetadata === undefined) {
        targetMetadata = [];
    }
    targetMetadata.push(metadata);
    Reflect.defineMetadata(metadataName, targetMetadata, target.constructor);
}

export function getIndexMetadatas(target: any): IndexMetadata[] {
    const metadataKeys: string[] = Reflect.getMetadataKeys(target).filter((p) => p.startsWith(INDEX_METADATA_NAME));
    return metadataKeys.reduce<IndexMetadata[]>((previous, current) => {
        return previous.concat(Reflect.getMetadata(current, target));
    }, []);
}

export function getIndexMetadata(target: any, property: string): IndexMetadata | undefined {
    return getIndexMetadatas(target).find((metadata) => metadata.property === property);
}

export async function createIndexes<Model extends EntityInterface>(
    ModelClass: ClassConstructor<Model>,
    manager: EntityManager
) {
    // declared indexes
    const indexesMetadata = getIndexMetadatas(ModelClass);
    const collection = manager.getCollection(ModelClass);

    if (indexesMetadata !== undefined) {
        const createIndexs: IndexDescription[] = [];
        for (const index of indexesMetadata) {
            let indexDescription: IndexDescription = {
                key: {
                    [index.property]: 1
                }
            };
            if (index.description !== undefined) {
                indexDescription = { ...indexDescription, ...index.description };
            }
            createIndexs.push(indexDescription);
        }
        if (createIndexs.length > 0) {
            try {
                return await collection.createIndexes(createIndexs);
            } catch (e) {
                console.error(
                    new Error(`Unable to create index on collection ${collection.namespace} ${e.message as string}`)
                );
            }
        }
    }
}
