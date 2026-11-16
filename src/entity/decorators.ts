/**
 * Set the collection of a model. Required on every model.
 *
 * @example
 * ```ts
 * @Collection('users')
 * export class User extends Entity {}
 * ```
 */
export function Collection(name: string) {
    return (target: any) => Reflect.defineMetadata('mongo:collectionName', name, target);
}
