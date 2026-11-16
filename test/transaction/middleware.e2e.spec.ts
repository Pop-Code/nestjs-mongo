import 'reflect-metadata';

import { Controller, Get, INestApplication, MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { Test } from '@nestjs/testing';

import { EntityManager, InjectEntityManager, MongoModule, SessionLoaderMiddleware } from '../../src';
import { DBTEST } from '../constants';
import { EntityTest } from '../entity/entity';

@Controller()
class SessionController {
    constructor(@InjectEntityManager() private readonly em: EntityManager) {}

    @Get('session')
    async session() {
        const session = this.em.getClient().startSession();
        this.em.setSessionContext(session); // requires the context opened by the middleware
        await new Promise((resolve) => setTimeout(resolve, 20));
        const kept = this.em.getSessionContext()?.session === session;
        await session.endSession();
        return { kept };
    }

    @Get('empty')
    empty() {
        // every request has its own context: nothing leaks from the previous request
        return { empty: this.em.getSessionContext() === undefined };
    }
}

@Module({
    imports: [
        MongoModule.forRootAsync({ useFactory: () => ({ uri: DBTEST + '-middleware' }) }),
        MongoModule.forFeature({ models: [EntityTest] })
    ],
    controllers: [SessionController]
})
class AppModule implements NestModule {
    configure(consumer: MiddlewareConsumer) {
        consumer.apply(SessionLoaderMiddleware).forRoutes('*path');
    }
}

let app: INestApplication;
let url: string;

beforeAll(async () => {
    const mod = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = mod.createNestApplication();
    await app.listen(0);
    url = await app.getUrl();
});

describe('SessionLoaderMiddleware (express)', () => {
    it('should keep the session of a request across async calls', async () => {
        const res = await fetch(`${url}/session`);
        expect(await res.json()).toEqual({ kept: true });
    });
    it('should give each request its own context', async () => {
        await fetch(`${url}/session`);
        const res = await fetch(`${url}/empty`);
        expect(await res.json()).toEqual({ empty: true });
    });
});

afterAll(async () => {
    await app.close();
});
