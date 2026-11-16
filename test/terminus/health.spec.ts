import 'reflect-metadata';

import { Controller, Get, Module } from '@nestjs/common';
import { HealthCheck, HealthCheckService, TerminusModule } from '@nestjs/terminus';
import { Test, TestingModule } from '@nestjs/testing';

import { EntityManager, getEntityManagerToken, MongoModule } from '../../src';
import { MongoHealthIndicator } from '../../src/terminus';
import { DBTEST } from '../constants';

const NAME = 'health-secondary';

@Controller()
class HealthController {
    constructor(
        readonly health: HealthCheckService,
        readonly mongo: MongoHealthIndicator
    ) {}

    @Get('health')
    @HealthCheck()
    async check() {
        return await this.health.check([
            async () => await this.mongo.pingCheck('mongo'),
            async () => await this.mongo.pingCheck('secondary', { connectionName: NAME })
        ]);
    }
}

@Module({
    imports: [TerminusModule.forRoot({ logger: false })],
    controllers: [HealthController],
    providers: [MongoHealthIndicator]
})
class HealthModule {}

let mod: TestingModule;
let indicator: MongoHealthIndicator;

beforeAll(async () => {
    mod = await Test.createTestingModule({
        imports: [
            MongoModule.forRoot({ uri: `${DBTEST}-health` }),
            MongoModule.forRoot({ connectionName: NAME, uri: `${DBTEST}-health-secondary` }),
            HealthModule
        ]
    }).compile();
    await mod.init();
    indicator = mod.get(MongoHealthIndicator);
});

describe('MongoHealthIndicator', () => {
    it('should report the connections up', async () => {
        const result = await mod.get(HealthController).check();
        expect(result.status).toBe('ok');
        expect(result.info).toEqual({ mongo: { status: 'up' }, secondary: { status: 'up' } });
    });

    it('should report down an unknown connection', async () => {
        const result = await indicator.pingCheck('unknown', { connectionName: 'unknown' });
        expect(result.unknown.status).toBe('down');
    });

    it('should report down when the server does not answer in time', async () => {
        const em = mod.get<EntityManager>(getEntityManagerToken());
        const ping = jest.spyOn(em, 'ping').mockReturnValue(new Promise(() => {}));
        const result = await indicator.pingCheck('mongo', { timeout: 10 });
        expect(result.mongo).toEqual({ status: 'down', message: 'timeout of 10ms exceeded' });
        ping.mockRejectedValueOnce('failure');
        expect((await indicator.pingCheck('mongo')).mongo).toEqual({ status: 'down', message: 'failure' });
        ping.mockRestore();
    });
});

afterAll(async () => {
    await mod.close();
});
