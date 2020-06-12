import { EntityInterface } from '../interfaces/entity';
import { RELATIONSHIP_METADATA_NAME } from '../constants';
import { ClassType } from 'class-transformer/ClassTransformer';
import { isEmpty } from 'class-validator';
import { isClass } from '../helpers';
import { MongoManager } from '../manager';

export type RelationshipTypeDescriptor<
    Relationship extends EntityInterface,
    Parent = object
> = (object: Parent) => ClassType<Relationship>;

export interface RelationshipMetadata<
    R extends EntityInterface = any,
    P = object
> {
    type: ClassType<R> | RelationshipTypeDescriptor<R, P> | string;
    isArray?: boolean;
    inversedBy?: string;
}

export function setRelationshipMetadata<
    R extends EntityInterface = any,
    P = object
>(
    target: any,
    property: string | symbol,
    metadata: RelationshipMetadata<R, P>
) {
    if (isEmpty(metadata.type)) {
        throw new Error('type is required in setRelationshipMetadata');
    }

    if (metadata.isArray === undefined || metadata.isArray === null) {
        metadata.isArray = false;
    }

    Reflect.defineMetadata(
        RELATIONSHIP_METADATA_NAME,
        metadata,
        target,
        property
    );
}

export function getRelationshipMetadata<
    R extends EntityInterface = any,
    P = object
>(target: P, property: string | symbol, em?: MongoManager) {
    const metadata: RelationshipMetadata<R, P> = Reflect.getMetadata(
        RELATIONSHIP_METADATA_NAME,
        target,
        property
    );

    if (metadata === undefined) {
        throw new Error(
            `undefined relationship metadata for property ${property.toString()} in object ${
                target.constructor.name
            }`
        );
    }

    if (!isClass(metadata.type) && typeof metadata.type === 'function') {
        const type = metadata.type as RelationshipTypeDescriptor<R, P>;
        metadata.type = type(target);
    }

    if (typeof metadata.type === 'string') {
        if (em === undefined) {
            throw new Error(
                `MongoManager parameter is required to get relationship metadata for property ${property.toString()} in object ${
                    target.constructor.name
                }`
            );
        }
        metadata.type = em.getModel(metadata.type);
    }

    return metadata;
}
