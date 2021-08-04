import { ClassConstructor } from 'class-transformer';
import { CreateIndexesOptions, IndexDescription } from 'mongodb';

import { EntityInterface } from '../entity/interfaces';

/**
 * Define the cascade operation of a relationship
 */
export enum CascadeType {
    DELETE = 'DELETE'
}

/**
 * Define the items with cascade operation on a class
 *
 * @example A Child class is defining a Relationship with a Parent with a cascade delete.
 * The Child will have metadata defining the cascade operations to execute.
 */
export interface RelationshipCascade<Child extends EntityInterface = any> {
    model: Child;
    cascade: CascadeType[];
    property: string;
    isArray?: boolean;
}

/**
 * The signature of the function used to determine the type of a relationship target
 */
export type RelationshipTypeDescriptor<Relationship extends EntityInterface> = (
    obj?: any
) => ClassConstructor<Relationship> | string | false;

/**
 * Define a list of possible values (as string) for a property used to defined a dynamic type
 */
export interface PossibleTypes {
    property: string;
    values: string[];
}

/**
 * Define the PossibleTypes of the relationship linked to a property
 */
export interface ChildRelationshipMetadata {
    property: string;
    possibleTypes?: PossibleTypes;
}

/**
 * The abstract relationship metadata
 */
export interface BaseRelationshipMetadata {
    isArray?: boolean;
    cascade?: CascadeType[];
    index?: { description?: IndexDescription & CreateIndexesOptions };
    possibleTypes?: PossibleTypes;
}

/**
 * The relationship metadata with a type defined as a function returning a class constructor (aka the model)
 */
export interface RelationshipMetadataOptions<R extends EntityInterface> extends BaseRelationshipMetadata {
    type: RelationshipTypeDescriptor<R> | ClassConstructor<R> | string;
}
/**
 * The relationship metadata with a type defined as a class constructor (aka the model)
 */
export interface RelationshipMetadata<R extends EntityInterface> extends BaseRelationshipMetadata {
    type: ClassConstructor<R>;
}
