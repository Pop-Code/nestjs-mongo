import { Injectable } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { HealthIndicatorService } from '@nestjs/terminus';

import { DEFAULT_CONNECTION_NAME } from '../constants';
import { EntityManager } from '../entity/manager';
import { getEntityManagerToken } from '../module/injection';

/** Options of {@link MongoHealthIndicator.pingCheck}. */
export interface MongoPingCheckOptions {
    /** The name of the connection (the default connection when not set). */
    connectionName?: string;
    /** The time to wait for the answer of the server, in milliseconds (default 1000). */
    timeout?: number;
}

/**
 * A `@nestjs/terminus` health indicator for the connections of the module.
 * Import the `TerminusModule`, and add `MongoHealthIndicator` to the providers of the module of the health controller.
 *
 * ```ts
 * @Get('health')
 * @HealthCheck()
 * check() {
 *     return this.health.check([() => this.mongo.pingCheck('mongo')]);
 * }
 * ```
 */
@Injectable()
export class MongoHealthIndicator {
    constructor(
        private readonly healthIndicatorService: HealthIndicatorService,
        private readonly moduleRef: ModuleRef
    ) {}

    /** Runs the `ping` command on a connection: `up` when the server answers before the timeout, `down` otherwise. */
    async pingCheck<const Key extends string>(
        key: Key,
        { connectionName = DEFAULT_CONNECTION_NAME, timeout = 1000 }: MongoPingCheckOptions = {}
    ) {
        const indicator = this.healthIndicatorService.check(key);
        let timer: NodeJS.Timeout | undefined;
        try {
            const em = this.moduleRef.get<EntityManager>(getEntityManagerToken(connectionName), { strict: false });
            const timedOut = new Promise<never>((_resolve, reject) => {
                timer = setTimeout(() => reject(new Error(`timeout of ${timeout}ms exceeded`)), timeout);
            });
            await Promise.race([em.ping(), timedOut]);
            return indicator.up();
        } catch (e) {
            return indicator.down({ message: e instanceof Error ? e.message : String(e) });
        } finally {
            clearTimeout(timer);
        }
    }
}
