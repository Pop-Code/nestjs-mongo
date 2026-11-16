import 'reflect-metadata';

import { Test, TestingModule } from '@nestjs/testing';

import {
    EntityManager,
    getEntityManagerToken,
    hasSessionContext,
    MongoModule,
    runInSessionContext,
    SessionLoaderMiddleware
} from '../../src';
import { DBTEST } from '../constants';
import { EntityTest } from '../entity/entity';
import { EntityChildTest } from '../module/child';

let mod: TestingModule;
let em: EntityManager;

beforeAll(async () => {
    mod = await Test.createTestingModule({
        imports: [
            MongoModule.forRootAsync({ useFactory: () => ({ uri: DBTEST + '-transaction' }) }),
            MongoModule.forFeature({ models: [EntityTest, EntityChildTest] })
        ]
    }).compile();
    await mod.init();
    em = mod.get<EntityManager>(getEntityManagerToken());
});

describe('startSessionWithTransaction', () => {
    it('should commit all the operations, and validate relationships inside the transaction', async () => {
        let parent: EntityTest | undefined;
        await runInSessionContext(async () => {
            await em.startSessionWithTransaction(
                async () => {
                    parent = await em.save(Object.assign(new EntityTest(), { foo: 'tx', bar: 'commit' }));
                    // @IsValidRelationship finds the parent through the session of the context
                    await em.save(Object.assign(new EntityChildTest(), { foo: 'child', parentId: parent._id }));
                },
                { useContext: true }
            );
        });
        expect(await em.findOne(EntityTest, { _id: parent!._id })).toBeInstanceOf(EntityTest);
        expect(await em.count(EntityChildTest, { parentId: parent!._id })).toBe(1);
    });

    it('should roll back all the operations when the transaction function throws', async () => {
        await expect(
            runInSessionContext(async () => {
                await em.startSessionWithTransaction(
                    async () => {
                        await em.save(Object.assign(new EntityTest(), { foo: 'tx', bar: 'rollback' }));
                        throw new Error('abort');
                    },
                    { useContext: true }
                );
            })
        ).rejects.toThrow('abort');
        expect(await em.count(EntityTest, { bar: 'rollback' })).toBe(0);
    });
});

describe('session context', () => {
    it('should use the session without any outer context (no middleware)', async () => {
        expect(hasSessionContext()).toBe(false);
        let parentId;
        await em.startSessionWithTransaction(
            async (session) => {
                expect(em.getSessionContext()?.session).toBe(session);
                const parent = await em.save(Object.assign(new EntityTest(), { foo: 'tx', bar: 'no-context' }));
                parentId = parent._id;
                // only visible through the session of the context
                await em.save(Object.assign(new EntityChildTest(), { foo: 'child', parentId }));
            },
            { useContext: true }
        );
        expect(em.getSessionContext()).toBeUndefined();
        expect(await em.count(EntityChildTest, { parentId })).toBe(1);
    });

    it('should not change the session of an outer context', async () => {
        await runInSessionContext(async () => {
            const outer = em.getClient().startSession();
            em.setSessionContext(outer);
            await em.startSessionWithTransaction(
                async (inner) => {
                    expect(em.getSessionContext()?.session).toBe(inner);
                },
                { useContext: true }
            );
            expect(em.getSessionContext()?.session).toBe(outer);
            await outer.endSession();
        });
    });

    it('should isolate concurrent contexts', async () => {
        const sessions = [em.getClient().startSession(), em.getClient().startSession()];
        const seen = await Promise.all(
            sessions.map(
                async (session) =>
                    await runInSessionContext(async () => {
                        em.setSessionContext(session);
                        await new Promise((resolve) => setTimeout(resolve, 10));
                        return em.getSessionContext()?.session;
                    })
            )
        );
        expect(seen[0]).toBe(sessions[0]);
        expect(seen[1]).toBe(sessions[1]);
        await Promise.all(sessions.map(async (s) => await s.endSession()));
    });

    it('should run the next handler of the middleware in a session context', (done) => {
        new SessionLoaderMiddleware().use({}, {}, () => {
            setImmediate(() => {
                expect(hasSessionContext()).toBe(true);
                done();
            });
        });
    });
});

afterAll(async () => {
    await em.getDatabase().dropDatabase();
    await mod.close();
});
