import { ClassConstructor } from 'class-transformer';
import { isEmpty } from 'class-validator';
import { find } from 'lodash';
import { IndexSpecification } from 'mongodb';

import { RELATIONSHIP_METADATA_NAME } from '../constants';
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
) => ClassConstructor<Relationship>;

export interface BaseRelationshipMetadata {
    isArray?: boolean;
    inversedBy?: string;
    cascade?: CascadeType[];
    indexSpecification?: IndexSpecification | false;
}

export interface RelationshipMetadataOptions<R extends EntityInterface>
    extends BaseRelationshipMetadata {
    type: RelationshipTypeDescriptor<R> | ClassConstructor<R> | string;
}

export interface RelationshipMetadata<R extends EntityInterface>
    extends BaseRelationshipMetadata {
    type: ClassConstructor<R>;
}

export const relationshipCascadesMetadata = new Map<
    ClassConstructor<any>,
    RelationshipCascade[]
>();
export const childrenRelationshipMetadata = new Map<
    ClassConstructor<any>,
    string[]
>();

export function setRelationshipMetadata<R extends EntityInterface = any>(
    target: any,
    property: string,
    metadata: RelationshipMetadataOptions<R>
) {
    if (isEmpty(metadata.type)) {
        throw new Error('type is required in setRelationshipMetadata');
    }

    if (isEmpty(metadata.isArray)) {
        metadata.isArray = false;
    }

    addChildRelationshipMetadata(target.constructor, property);

    Reflect.defineMetadata(
        RELATIONSHIP_METADATA_NAME,
        metadata,
        target,
        property
    );
}

export function addChildRelationshipMetadata<P = any>(
    target: ClassConstructor<P>,
    property: string
) {
    const relationsMetadata = getChildrenRelationshipMetadata(target);
    relationsMetadata.push(property);
    childrenRelationshipMetadata.set(target, relationsMetadata);
}

export function getChildrenRelationshipMetadata<P = any>(
    target: ClassConstructor<P>
) {
    return childrenRelationshipMetadata.get(target) ?? [];
}

export function setRelationshipsCascadesMetadata<
    Child extends EntityInterface = any
>(child: ClassConstructor<Child>, manager: MongoManager) {
    const props = getChildrenRelationshipMetadata(child);
    if (Array.isArray(props)) {
        for (const prop of props) {
            // eslint-disable-next-line new-cap
            const rel = getRelationshipMetadata(new child(), prop, manager);
            if (Array.isArray(rel.cascade)) {
                let owner = rel.type;
                let target = child;
                if (rel.isArray !== undefined && rel.isArray) {
                    owner = child;
                    target = rel.type;
                }
                const parentMeta =
                    relationshipCascadesMetadata.get(owner) ?? [];

                const cascadeOP: RelationshipCascade = {
                    model: target,
                    cascade: rel.cascade,
                    property: prop,
                    isArray: rel.isArray
                };
                parentMeta.push(cascadeOP);
                relationshipCascadesMetadata.set(owner, parentMeta);
            }
        }
    }
}

export function getRelationshipsCascadesMetadata<
    Parent extends EntityInterface = any
>(target: ClassConstructor<Parent>) {
    return relationshipCascadesMetadata.get(target);
}

export function getRelationshipCascadesMetadata<
    Parent extends EntityInterface = any,
    Child extends EntityInterface = any
>(
    parent: ClassConstructor<Parent>,
    relationshipType: ClassConstructor<Child>
): RelationshipCascade<Child> | undefined {
    const relCascades = getRelationshipsCascadesMetadata<Parent>(parent);
    return find(relCascades, (cs) => {
        return cs.model === relationshipType;
    });
}

export function getRelationshipMetadata<R extends EntityInterface = any>(
    target: any,
    property: string | symbol,
    em?: MongoManager
): RelationshipMetadata<R> {
    const metadata: RelationshipMetadataOptions<R> = Reflect.getMetadata(
        RELATIONSHIP_METADATA_NAME,
        target,
        property
    );

    const metadataDefinition = metadata as RelationshipMetadata<R>;

    if (metadata === undefined) {
        throw new Error(
            `undefined relationship metadata for property ${property.toString()} in object ${
                target.name as string
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
                    target.name as string
                }`
            );
        }

        const model = em.getModel(metadata.type);
        if (model === undefined) {
            throw new Error(`Can not get model ${metadata.type}`);
        }
        metadataDefinition.type = model;
    }

    return metadataDefinition;
}
