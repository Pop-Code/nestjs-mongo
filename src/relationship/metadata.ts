import { ClassType } from 'class-transformer/ClassTransformer';
import { isEmpty } from 'class-validator';
import { find } from 'lodash';

import { CHILD_RELATIONSHIPS, RELATIONSHIP_METADATA_NAME, RELATIONSHIPS_CASCADES_METADATA_NAME } from '../constants';
import { isClass } from '../helpers';
import { EntityInterface } from '../interfaces/entity';
import { MongoManager } from '../manager';

export enum CascadeType {
    DELETE = 'DELETE'
}

export interface RelationshipCascade<Child extends EntityInterface = any> {
    model: Child;
    cascade: CascadeType[];
    property: string;
    isArray?: boolean;
}

export type RelationshipTypeDescriptor<Relationship extends EntityInterface> = (
    obj: unknown
) => ClassType<Relationship>;

export interface BaseRelationshipMetadata {
    isArray?: boolean;
    inversedBy?: string;
    cascade?: CascadeType[];
}

export interface RelationshipMetadataOptions<R extends EntityInterface>
    extends BaseRelationshipMetadata {
    type: RelationshipTypeDescriptor<R> | ClassType<R> | string;
}

export interface RelationshipMetadata<R extends EntityInterface>
    extends BaseRelationshipMetadata {
    type: ClassType<R>;
}

export function setRelationshipMetadata<R extends EntityInterface = any>(
    target: any,
    property: string | symbol,
    metadata: RelationshipMetadataOptions<R>
) {
    if (isEmpty(metadata.type)) {
        throw new Error('type is required in setRelationshipMetadata');
    }

    if (isEmpty(metadata.isArray)) {
        metadata.isArray = false;
    }

    let relationsMetadata = Reflect.getMetadata(
        CHILD_RELATIONSHIPS,
        target.constructor
    );
    if (relationsMetadata === undefined) {
        relationsMetadata = [];
    }
    relationsMetadata.push(property);
    Reflect.defineMetadata(
        CHILD_RELATIONSHIPS,
        relationsMetadata,
        target.constructor
    );

    Reflect.defineMetadata(
        RELATIONSHIP_METADATA_NAME,
        metadata,
        target.constructor,
        property
    );
}

export function setRelationshipsCascadesMetadata<
    Child extends EntityInterface = any
>(child: ClassType<Child>, manager: MongoManager) {
    const props = Reflect.getMetadata(CHILD_RELATIONSHIPS, child);
    if (Array.isArray(props)) {
        for (const prop of props) {
            const rel = getRelationshipMetadata(child, prop, manager);
            if (Array.isArray(rel.cascade)) {
                let owner = rel.type;
                let target = child;
                if (rel.isArray) {
                    owner = child;
                    target = rel.type;
                }
                const parentMeta =
                    Reflect.getMetadata(
                        RELATIONSHIPS_CASCADES_METADATA_NAME,
                        owner
                    ) ?? [];
                const cascadeOP: RelationshipCascade = {
                    model: target,
                    cascade: rel.cascade,
                    property: prop,
                    isArray: rel.isArray
                };
                parentMeta.push(cascadeOP);
                Reflect.defineMetadata(
                    RELATIONSHIPS_CASCADES_METADATA_NAME,
                    parentMeta,
                    owner
                );
            }
        }
    }
}

export function getRelationshipsCascadesMetadata<
    Parent extends EntityInterface = any
>(target: ClassType<Parent>): RelationshipCascade[] {
    return Reflect.getMetadata(RELATIONSHIPS_CASCADES_METADATA_NAME, target);
}

export function getRelationshipCascadesMetadata<
    Parent extends EntityInterface = any,
    Child extends EntityInterface = any
>(
    parent: ClassType<Parent>,
    relationshipType: ClassType<Child>
): RelationshipCascade<Child> {
    const relCascades = getRelationshipsCascadesMetadata<Parent>(parent);
    return find(relCascades, (cs) => {
        return cs.model === relationshipType;
    });
}

export function getRelationshipMetadata<
    R extends EntityInterface = any,
    P = object
>(
    target: P,
    property: string | symbol,
    em?: MongoManager
): RelationshipMetadata<R> {
    const finalTarget =
        typeof target === 'function' ? target : target.constructor;

    const metadata: RelationshipMetadataOptions<R> = Reflect.getMetadata(
        RELATIONSHIP_METADATA_NAME,
        finalTarget,
        property
    );

    const metadataDefinition = metadata as RelationshipMetadata<R>;

    if (metadata === undefined) {
        throw new Error(
            `undefined relationship metadata for property ${property.toString()} in object ${
                finalTarget.name
            }`
        );
    }

    if (!isClass(metadata.type) && typeof metadata.type === 'function') {
        const type = metadata.type as RelationshipTypeDescriptor<R>;
        metadataDefinition.type = type(target);
    }

    if (typeof metadata.type === 'string') {
        if (em === undefined) {
            throw new Error(
                `MongoManager parameter is required to get relationship metadata for property ${property.toString()} in object ${
                    finalTarget.name
                }`
            );
        }
        metadataDefinition.type = em.getModel(metadata.type);
    }

    return metadataDefinition;
}
