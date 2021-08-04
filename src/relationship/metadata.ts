import { ClassConstructor } from 'class-transformer';
import { isEmpty } from 'class-validator';
import { cloneDeep, find, uniqBy } from 'lodash';

import { RELATIONSHIP_LIST_METADATA_NAME, RELATIONSHIP_METADATA_NAME } from '../constants';
import { EntityInterface } from '../entity/interfaces';
import { EntityManager } from '../entity/manager';
import { isClass } from '../helpers';
import {
    ChildRelationshipMetadata,
    RelationshipCascade,
    RelationshipMetadata,
    RelationshipMetadataOptions,
    RelationshipTypeDescriptor,
} from './interfaces';

/**
 * Set relationship metadata
 * @private
 * @param target An instance of an object
 * @param property The property to set as relationship
 * @param metadata The metadata defining the relationship
 */
export function setRelationshipMetadata<R extends EntityInterface = any>(
    target: any,
    property: string,
    metadata: RelationshipMetadataOptions<R>
) {
    const model = target.constructor;
    if (isEmpty(metadata.type)) {
        throw new Error(`"type" property is required in setRelationshipMetadata for ${model.name as string}`);
    }

    if (isEmpty(metadata.isArray)) {
        metadata.isArray = false;
    }

    addRelationshipMetadata(model, property, metadata);

    Reflect.defineMetadata(RELATIONSHIP_METADATA_NAME, metadata, model, property);
}

export function getRelationFromModelName(modelName: string, target: Function, property: string, em?: EntityManager) {
    if (em === undefined) {
        throw new Error(
            `EntityManager parameter is required to get relationship metadata for property ${property.toString()} in object ${
                target.name
            }`
        );
    }
    const model = em.getModel(modelName);
    if (model === undefined) {
        throw new Error(`Can not get model ${modelName}`);
    }

    return model;
}

/**
 * Get relationship metadata
 *
 * @param target A class constructor
 * @param property The property that was set as relationship
 * @param em The entity manager (only required if the relationship target type is set as a string)
 * @param obj The instance of the entity (only required if the type of the relationship is dynamic)
 */
export function getRelationshipMetadata<R extends EntityInterface = any>(
    target: Function,
    property: string,
    em?: EntityManager,
    obj?: any
): RelationshipMetadata<R> {
    const metadata: RelationshipMetadataOptions<R> | undefined = Reflect.getMetadata(
        RELATIONSHIP_METADATA_NAME,
        target,
        property
    );

    if (metadata === undefined) {
        throw new Error(`Can not get relationship metadata for property "${property.toString()}" on "${target.name}"`);
    }

    const metadataDefinition = cloneDeep(metadata) as RelationshipMetadata<R>;

    if (!isClass(metadata.type) && typeof metadata.type === 'function') {
        const type = metadata.type as RelationshipTypeDescriptor<R>;
        const dynamicType = type(obj);

        if (dynamicType === false) {
            throw new Error(`Can not get the dynamic type of ${target.name} ${property} property`);
        }

        metadataDefinition.type =
            typeof dynamicType === 'string' ? getRelationFromModelName(dynamicType, target, property, em) : dynamicType;
    }

    if (typeof metadata.type === 'string') {
        metadataDefinition.type = getRelationFromModelName(metadata.type, target, property, em);
    }

    return metadataDefinition;
}

/**
 * WRTIE DEF
 *
 * @private
 * @param target A class constructor
 * @param property The property containing the child
 * @param metadata
 */
export function addRelationshipMetadata<P = any>(
    target: ClassConstructor<P>,
    property: string,
    metadata: RelationshipMetadataOptions<any>
) {
    const relationsMetadata = getRelationshipMetadataList(target);
    relationsMetadata.push({
        property,
        possibleTypes: metadata.possibleTypes
    });
    Reflect.defineMetadata(
        RELATIONSHIP_LIST_METADATA_NAME,
        uniqBy(relationsMetadata, (r: any) => r.property),
        target
    );
}

/**
 *
 * @param target The class constructor of an entity
 * @returns
 */
export function getRelationshipMetadataList<P = any>(target: ClassConstructor<P>): ChildRelationshipMetadata[] {
    return (Reflect.getMetadata(RELATIONSHIP_LIST_METADATA_NAME, target) ?? []).slice();
}

/**
 *
 * @param ChildClass
 * @param manager
 */
export function setRelationshipsCascadesMetadata<Child extends EntityInterface = any>(
    ChildClass: ClassConstructor<Child>,
    manager: EntityManager
) {
    const props = getRelationshipMetadataList(ChildClass);
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
                    const parentMeta = getRelationshipsCascadesMetadata(owner);
                    const cascadeOP: RelationshipCascade = {
                        model: target,
                        cascade: relationshipMetadata.cascade,
                        property: prop.property,
                        isArray: relationshipMetadata.isArray
                    };
                    parentMeta.push(cascadeOP);

                    Reflect.defineMetadata(
                        'CASCADE',
                        uniqBy(parentMeta, (m: any) => m.property),
                        owner
                    );
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

/**
 *
 * @param target
 * @returns
 */
export function getRelationshipsCascadesMetadata<Parent extends EntityInterface = any>(
    target: ClassConstructor<Parent>
): RelationshipCascade[] {
    return (Reflect.getMetadata('CASCADE', target) ?? []).slice();
}

/**
 *
 * @param parent
 * @param relationshipType
 * @returns
 */
export function getRelationshipCascadesMetadata<
    Parent extends EntityInterface = any,
    Child extends EntityInterface = any
>(parent: ClassConstructor<Parent>, relationshipType: ClassConstructor<Child>): RelationshipCascade<Child> | undefined {
    const relCascades = (getRelationshipsCascadesMetadata<Parent>(parent) ?? []).slice();
    return find(relCascades, (cs) => {
        return cs.model === relationshipType;
    });
}
