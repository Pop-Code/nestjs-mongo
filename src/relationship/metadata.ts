import { EntityInterface } from '../interfaces/entity';
import { ClassType } from 'class-transformer/ClassTransformer';
import { RELATIONSHIP_METADATA_NAME } from '../constants';

export interface WithRelationshipInterface {
    getCachedRelationship<T = any>(prop: string): T;
    setCachedRelationship(prop: string, value: any): WithRelationshipInterface;
}

export interface RelationshipMetadata<
    Model extends EntityInterface = any,
    Relationship extends EntityInterface = any
> {
    type?: ClassType<Relationship>;
    typeFn?: RelationshipTypeDescriptor<Model, Relationship>;
    isArray?: boolean;
}

export type RelationshipTypeDescriptor<
    Model extends EntityInterface,
    Relationship extends EntityInterface
> = (object: Model) => ClassType<Relationship>;

export const setRelationshipMetadata = <
    Model extends EntityInterface = any,
    Relationship extends EntityInterface = any
>(
    target: any,
    property: string | symbol,
    metadata: RelationshipMetadata<Model, Relationship>
) => {
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
};

export const getRelationshipMetadata = <
    Model extends EntityInterface = any,
    Relationship extends EntityInterface = any
>(
    target: Model,
    property: string | symbol
) => {
    const metadata: RelationshipMetadata<
        Model,
        Relationship
    > = Reflect.getMetadata(RELATIONSHIP_METADATA_NAME, target, property);

    // determine the final metadata type here
    if (metadata && metadata.typeFn instanceof Function) {
        metadata.type = metadata.typeFn(target);
    }

    return metadata;
};
