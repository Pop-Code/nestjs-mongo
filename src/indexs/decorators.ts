import { IndexDescription } from 'mongodb';

import { setIndexMetadata } from './metadata';

/**
 * Declare an index on a property. Indexes are created when the model is registered.
 *
 * @param metadata The index options (`unique`, `sparse`, `expireAfterSeconds`, ...) and, for a compound
 * index, the `key`. Defaults to an ascending index on the property.
 *
 * @example
 * ```ts
 * @Index({ unique: true })
 * email: string;
 * ```
 */
export function Index(metadata?: Partial<IndexDescription>) {
    return function (target: any, property: string) {
        setIndexMetadata(target, { property, description: metadata ?? {} });
    };
}
