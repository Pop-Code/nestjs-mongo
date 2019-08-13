import { EntityInterface } from './entity';
import { ClassType } from 'class-transformer/ClassTransformer';

export interface RelationshipMetadata<Model extends EntityInterface> {
    type: ClassType<Model>;
    isArray?: boolean;
}

export interface WithRelationshipInterface {
    getCachedRelationship<T = any>(prop: string): T;
    setCachedRelationship(prop: string, value: any): WithRelationshipInterface;
}
