import { EntityInterface } from '../interfaces/entity';
import { RELATIONSHIP_METADATA_NAME } from '../constants';
import { ClassType } from 'class-transformer/ClassTransformer';

export type RelationshipTypeDescriptor<
    Relationship extends EntityInterface,
    Obj = any
> = (object: Obj) => ClassType<Relationship>;

export interface RelationshipMetadata<
    Relationship extends EntityInterface = any,
    Obj = any
> {
    type?: ClassType<Relationship>;
    typeFn?: RelationshipTypeDescriptor<Relationship, Obj>;
    isArray?: boolean;
}

export function setRelationshipMetadata<
    Relationship extends EntityInterface = any,
    Obj = any
>(
    target: any,
    property: string | symbol,
    metadata: RelationshipMetadata<Relationship, Obj>
) {
    if (!metadata.type && !metadata.typeFn) {
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
    Relationship extends EntityInterface = any,
    Obj = any
>(target: Obj, property: string | symbol) {
    const metadata: RelationshipMetadata<
        Relationship,
        Obj
    > = Reflect.getMetadata(RELATIONSHIP_METADATA_NAME, target, property);

    // determine the final metadata type here
    if (metadata && metadata.typeFn instanceof Function) {
        metadata.type = metadata.typeFn(target);
    }

    return metadata;
}
