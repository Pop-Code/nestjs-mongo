import { ClassConstructor } from 'class-transformer';
import { isEmpty } from 'class-validator';
import { cloneDeep, find, first } from 'lodash';
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
    obj?: any
) => ClassConstructor<Relationship> | false;

export interface PossibleTypes {
    property: string;
    values: string[];
}

export interface BaseRelationshipMetadata {
    isArray?: boolean;
    inversedBy?: string;
    cascade?: CascadeType[];
    indexSpecification?: IndexSpecification | false;
    possibleTypes?: PossibleTypes;
}

export interface RelationshipMetadataOptions<R extends EntityInterface> extends BaseRelationshipMetadata {
    type: RelationshipTypeDescriptor<R> | ClassConstructor<R> | string;
}

export interface RelationshipMetadata<R extends EntityInterface> extends BaseRelationshipMetadata {
    type: ClassConstructor<R>;
}

export const relationshipCascadesMetadata = new Map<ClassConstructor<any>, RelationshipCascade[]>();
export const childrenRelationshipMetadata = new Map<
    ClassConstructor<any>,
    Array<{ property: string; possibleTypes?: PossibleTypes }>
>();

/**
 * Set relationship metadata on the entity constructor
 *
 * @param target The entity
 * @param property The property
 * @param metadata The relationship metadata
 */
export function setRelationshipMetadata<R extends EntityInterface = any>(
    target: any,
    property: string,
    metadata: RelationshipMetadataOptions<R>
) {
    const constructorName: string = target.constructor.name;
    const metadataName = `${RELATIONSHIP_METADATA_NAME}:${constructorName}`;

    if (isEmpty(metadata.type)) {
        throw new Error(`"type" property is required in setRelationshipMetadata for ${metadataName}`);
    }

    if (isEmpty(metadata.isArray)) {
        metadata.isArray = false;
    }

    addChildRelationshipMetadata(target.constructor, property, metadata);
    Reflect.defineMetadata(metadataName, metadata, target.constructor, property);
}

/**
 * Get the relationship metadata
 *
 * @param target The entity
 * @param property The property
 * @param em The entity manager
 * @param obj An instance of the entity
 * @returns
 */
export function getRelationshipMetadata<R extends EntityInterface = any>(
    target: Function,
    property: string,
    em?: MongoManager,
    obj?: any
): RelationshipMetadata<R> {
    const constructorName: string = target.name;
    const metadataName = `${RELATIONSHIP_METADATA_NAME}:${constructorName}`;

    const metadataKeys: string[] = Reflect.getMetadataKeys(target, property).filter((p) =>
        p.startsWith(RELATIONSHIP_METADATA_NAME)
    );

    const metadata = first(
        metadataKeys.reduce<Array<RelationshipMetadataOptions<R>>>((previous, current) => {
            return previous.concat(Reflect.getMetadata(current, target, property));
        }, [])
    );

    if (metadata === undefined) {
        throw new Error(
            `Can not get relationship metadata for property "${property.toString()}" from metadata "${metadataName}"`
        );
    }

    const metadataDefinition = cloneDeep(metadata) as RelationshipMetadata<R>;

    if (!isClass(metadata.type) && typeof metadata.type === 'function') {
        const type = metadata.type as RelationshipTypeDescriptor<R>;
        const dynamicType = type(obj);
        if (dynamicType === false) {
            throw new Error(`Can not get the dynamic type of ${target.name} ${property} property`);
        }
        metadataDefinition.type = dynamicType;
    }

    if (typeof metadata.type === 'string') {
        if (em === undefined) {
            throw new Error(
                `MongoManager parameter is required to get relationship metadata for property ${property.toString()} in object ${
                    target.name
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

/**
 * Define the child relationship
 *
 * @param target The entity constructor
 * @param property The property
 * @param metadata The relationship metadata
 */
export function addChildRelationshipMetadata<P = any>(
    target: ClassConstructor<P>,
    property: string,
    metadata: RelationshipMetadataOptions<any>
) {
    const relationsMetadata = getChildrenRelationshipMetadata(target);
    relationsMetadata.push({
        property,
        possibleTypes: metadata.possibleTypes
    });
    childrenRelationshipMetadata.set(target, relationsMetadata);
}

/**
 * Get the child relationship
 * @param target
 * @returns
 */
export function getChildrenRelationshipMetadata<P = any>(target: ClassConstructor<P>) {
    return childrenRelationshipMetadata.get(target) ?? [];
}

export function setRelationshipsCascadesMetadata<Child extends EntityInterface = any>(
    ChildClass: ClassConstructor<Child>,
    manager: MongoManager
) {
    const props = getChildrenRelationshipMetadata(ChildClass);
    if (Array.isArray(props)) {
        for (const prop of props) {
            const _setMetadata = (c: Child) => {
                const relationshipMetadata = getRelationshipMetadata(c.constructor, prop.property, manager, c);
                if (Array.isArray(relationshipMetadata.cascade)) {
                    let owner = relationshipMetadata.type;
                    let target = ChildClass;
                    if (relationshipMetadata.isArray === true) {
                        owner = ChildClass;
                        target = relationshipMetadata.type;
                    }
                    const parentMeta = relationshipCascadesMetadata.get(owner) ?? [];
                    const cascadeOP: RelationshipCascade = {
                        model: target,
                        cascade: relationshipMetadata.cascade,
                        property: prop.property,
                        isArray: relationshipMetadata.isArray
                    };
                    parentMeta.push(cascadeOP);
                    relationshipCascadesMetadata.set(owner, parentMeta);
                }
            };
            if (prop.possibleTypes !== undefined) {
                for (const typeValue of prop.possibleTypes.values) {
                    const c = new ChildClass();
                    c[prop.possibleTypes.property] = typeValue;
                    _setMetadata(c);
                }
            } else {
                const c = new ChildClass();
                _setMetadata(c);
            }
        }
    }
}

export function getRelationshipsCascadesMetadata<Parent extends EntityInterface = any>(
    target: ClassConstructor<Parent>
) {
    return relationshipCascadesMetadata.get(target);
}

export function getRelationshipCascadesMetadata<
    Parent extends EntityInterface = any,
    Child extends EntityInterface = any
>(parent: ClassConstructor<Parent>, relationshipType: ClassConstructor<Child>): RelationshipCascade<Child> | undefined {
    const relCascades = getRelationshipsCascadesMetadata<Parent>(parent);
    return find(relCascades, (cs) => {
        return cs.model === relationshipType;
    });
}
