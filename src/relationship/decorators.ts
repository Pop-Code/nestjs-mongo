import { ClassType } from 'class-transformer/ClassTransformer';
import Debug from 'debug';
import { DEBUG } from '../constants';
import { EntityInterface } from '../interfaces/entity';
import { setRelationshipMetadata, RelationshipMetadata } from './metadata';
import { isClass } from '../helpers';

export const Relationship = <
    Model extends EntityInterface,
    Relationship extends EntityInterface = any
>(
    options: RelationshipMetadata<Model, Relationship> | ClassType<Relationship>
) => {
    const debug = Debug(DEBUG + ':Relationship');

    return (target: Model, property: string) => {
        debug('Register relationship metadata %o', options);
        if (isClass(options)) {
            setRelationshipMetadata<Model>(target, property, {
                type: options as ClassType<Relationship>,
                isArray: false
            });
        } else {
            setRelationshipMetadata<Model>(
                target,
                property,
                options as RelationshipMetadata<Model, Relationship>
            );
        }
    };
};

function getCachedRelationship(prop: string) {
    if (!this.__cachedRelationships) {
        return;
    }
    return this.__cachedRelationships.get(prop);
}
function setCachedRelationship(prop: string, value: any) {
    if (!this.__cachedRelationships) {
        Object.defineProperty(this, '__cachedRelationships', {
            writable: true,
            value: new Map(),
            enumerable: false,
            configurable: false
        });
    }
    this.__cachedRelationships.set(prop, value);
    return this;
}
export const WithRelationship = () => {
    return (target: any) => {
        target.prototype.getCachedRelationship = getCachedRelationship;
        target.prototype.setCachedRelationship = setCachedRelationship;
    };
};
