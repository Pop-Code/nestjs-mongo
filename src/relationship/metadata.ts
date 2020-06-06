import { EntityInterface } from '../interfaces/entity';
import { RELATIONSHIP_METADATA_NAME } from '../constants';
import { ClassType } from 'class-transformer/ClassTransformer';
import { isEmpty } from 'class-validator';

export type RelationshipTypeDescriptor<
    Relationship extends EntityInterface,
    Parent = object
> = (object: Parent) => ClassType<Relationship>;

export interface RelationshipMetadata<
    R extends EntityInterface = any,
    P = object
> {
    type?: ClassType<R>;
    typeFn?: RelationshipTypeDescriptor<R, P>;
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
    if (isEmpty(metadata.type) && isEmpty(metadata.typeFn)) {
        throw new Error(
            'type or typeFn are required in setRelationshipMetadata'
        );
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
>(target: P, property: string | symbol) {
    const metadata: RelationshipMetadata<R, P> = Reflect.getMetadata(
        RELATIONSHIP_METADATA_NAME,
        target,
        property
    );

    if (metadata !== undefined && metadata.typeFn instanceof Function) {
        metadata.type = metadata.typeFn(target);
    }

    return metadata;
}
