import { IndexDescription } from 'mongodb';

import { setIndexMetadata } from './metadata';

/**
 * Declares an index. Indexes are created when the model is registered.
 *
 * On a property, the index defaults to an ascending index on the property. On a class, the `key` is required
 * (for a compound index). The description takes every option of the driver: `unique`, `sparse`, `expireAfterSeconds`
 * (TTL), `partialFilterExpression`, `name`, and the special keys (`'text'`, `'2dsphere'`, `'hashed'`).
 *
 * @example
 * ```ts
 * @Index({ key: { lastName: 1, firstName: 1 } })
 * @Collection('users')
 * class User extends Entity {
 *     @Index({ unique: true })
 *     email: string;
 *
 *     @Index({ expireAfterSeconds: 3600 })
 *     expiresAt: Date;
 * }
 * ```
 */
export function Index(metadata?: Partial<IndexDescription>) {
    return function (target: any, property?: string | symbol) {
        if (property === undefined) {
            if (metadata?.key === undefined) {
                throw new Error(`@Index() on the class ${target.name as string} requires a "key"`);
            }
            setIndexMetadata(target.prototype, { description: metadata });
            return;
        }
        setIndexMetadata(target, { property: String(property), description: metadata ?? {} });
    } as ClassDecorator & PropertyDecorator;
}
