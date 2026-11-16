import { DEFAULT_CONNECTION_NAME } from '../constants';
import { getEntityManager } from '../entity/manager';
import { EntityTransactionOptions } from '../entity/options';

/**
 * Runs the method in a transaction of a connection (see `EntityManager.withTransaction()`):
 * the operations of the entity manager in the method use the session of the transaction.
 * When the method is called in a transaction of the same connection, it runs in this transaction.
 *
 * ```ts
 * @Transactional()
 * async transfer(from: Account, to: Account, amount: number) { ... }
 * ```
 */
export function Transactional(options: EntityTransactionOptions & { connectionName?: string } = {}): MethodDecorator {
    return (_target, _key, descriptor: PropertyDescriptor) => {
        const method: (...args: unknown[]) => Promise<unknown> = descriptor.value;
        const { connectionName = DEFAULT_CONNECTION_NAME, ...transactionOptions } = options;
        descriptor.value = async function (this: unknown, ...args: unknown[]) {
            const em = getEntityManager(connectionName);
            if (em === undefined) {
                throw new Error(`@Transactional(): no connection ${connectionName}`);
            }
            return await em.withTransaction(async () => await method.apply(this, args), transactionOptions);
        };
        return descriptor;
    };
}
