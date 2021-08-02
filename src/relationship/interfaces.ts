import { ClassConstructor } from 'class-transformer';
import { CreateIndexesOptions, IndexDescription } from 'mongodb';

import { EntityInterface } from '../entity/interfaces';

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
    index?: { description?: IndexDescription & CreateIndexesOptions };
    possibleTypes?: PossibleTypes;
}

export interface RelationshipMetadataOptions<R extends EntityInterface> extends BaseRelationshipMetadata {
    type: RelationshipTypeDescriptor<R> | ClassConstructor<R> | string;
}

export interface RelationshipMetadata<R extends EntityInterface> extends BaseRelationshipMetadata {
    type: ClassConstructor<R>;
}
