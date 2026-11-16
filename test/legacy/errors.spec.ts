import 'reflect-metadata';

import { BadRequestException } from '@nestjs/common';
import { TestingModule } from '@nestjs/testing';
import { IsOptional, IsString } from 'class-validator';
import Debug from 'debug';
import { ObjectId } from 'mongodb';

import {
    Collection,
    Entity,
    EntityManager,
    Filter,
    getRelationshipMetadata,
    HistoryActions,
    IsValidRelationship,
    ObjectIdPipe,
    Relationship,
    RelationshipPipe,
    setRelationshipMetadata,
    Slugify,
    TransactionsOrchestrator
} from '../../src';
import { EntityTest } from '../entity/entity';
import { EntityRelationship } from '../relationship/entity.relationship';
import { closeModule, createModule } from '../orm/setup';

@Collection('legacyChild')
class Child extends Entity {
    @IsString()
    name: string;

    @Relationship({ type: () => EntityTest })
    @IsValidRelationship({
        with: async (_child: Child, parent: EntityTest) => (parent.foo === 'bad' ? 'The parent is bad' : true)
    })
    @IsOptional()
    parentId?: ObjectId;

    @Relationship({ type: () => EntityTest, isArray: true })
    @IsValidRelationship()
    @IsOptional()
    parentIds?: ObjectId[];

    notARelationship?: string;
}

// not registered: the relationships of a registered model are resolved when it is registered
class BadRelationships extends Entity {
    @Relationship({ type: () => false as never })
    dynamicFalse?: ObjectId;

    @Relationship('UnknownModel')
    unknown?: ObjectId;
}

class NoCollection extends Entity {}

let ctx: { mod: TestingModule; em: EntityManager };
let em: EntityManager;

beforeAll(async () => {
    ctx = await createModule('legacy-errors', [EntityTest, EntityRelationship, Child]);
    em = ctx.em;
});

describe('relationship metadata', () => {
    it('should throw for the invalid metadata', () => {
        expect(() => setRelationshipMetadata(new Child(), 'name', { type: undefined as never })).toThrow(
            '"type" property is required'
        );
        expect(() => getRelationshipMetadata(Child, 'notARelationship')).toThrow(
            'Can not get relationship metadata for property "notARelationship" on "Child"'
        );
        expect(() => getRelationshipMetadata(BadRelationships, 'dynamicFalse', em, new BadRelationships())).toThrow(
            'Can not get the dynamic type of BadRelationships dynamicFalse property'
        );
        expect(() => getRelationshipMetadata(BadRelationships, 'unknown')).toThrow(
            'EntityManager parameter is required'
        );
        expect(() => getRelationshipMetadata(BadRelationships, 'unknown', em)).toThrow(
            'Can not get model UnknownModel'
        );
    });
});

describe('getRelationship / getRelationships', () => {
    it('should check the kind of the relationship', async () => {
        const child = Object.assign(new Child(), { name: 'c', parentIds: [new ObjectId()] });
        await expect(em.getRelationship(child, 'parentIds')).rejects.toThrow('is defined as an array');
        await expect(em.getRelationships(child, 'parentId')).rejects.toThrow('is not defined as an array');
        await expect(em.getRelationship(child, 'notARelationship')).rejects.toThrow(
            'Can not get relationship metadata'
        );
    });

    it('should return nothing for an empty relationship', async () => {
        const child = Object.assign(new Child(), { name: 'c' });
        expect(await em.getRelationship(child, 'parentId')).toBeUndefined();
        expect(await em.getRelationships(child, 'parentIds')).toEqual([]);
    });
});

describe('IsValidRelationship', () => {
    it('should check the arrays and the single values', async () => {
        const notArray = Object.assign(new Child(), { name: 'c', parentIds: new ObjectId() as never });
        expect((await em.validate(notArray))[0].constraints?.IsValidRelationship).toBe(
            'The parentIds must be an array'
        );
        const array = Object.assign(new Child(), { name: 'c', parentId: [new ObjectId()] as never });
        expect((await em.validate(array))[0].constraints?.IsValidRelationship).toBe(
            'The parentId must not be an array'
        );
        const missing = Object.assign(new Child(), { name: 'c', parentId: new ObjectId() });
        expect((await em.validate(missing))[0].constraints?.IsValidRelationship).toBe(
            'The property parentId contains an invalid relationship'
        );
    });

    it('should run the with test', async () => {
        const bad = await em.save(Object.assign(new EntityTest(), { foo: 'bad', bar: 'b' }));
        const good = await em.save(Object.assign(new EntityTest(), { foo: 'good', bar: 'b' }));
        const child = Object.assign(new Child(), { name: 'c', parentId: bad._id });
        expect((await em.validate(child))[0].constraints?.IsValidRelationship).toBe('The parent is bad');
        child.parentId = good._id;
        expect(await em.validate(child)).toHaveLength(0);
    });
});

describe('EntityManager errors', () => {
    it('should require a @Collection decorator', () => {
        expect(() => em.getCollectionName(NoCollection)).toThrow('@Collection decorator is required');
    });

    it('should list the models and find the repositories by name', () => {
        expect(em.getModels().get('Child')).toBe(Child);
        expect(em.getRepository(Child).getClassType()).toBe(Child);
    });

    it('should throw the errors of the collection creation', async () => {
        const db = em.getDatabase();
        jest.spyOn(em, 'getDatabase').mockReturnValue(db);
        jest.spyOn(db, 'listCollections').mockReturnValue({ toArray: async () => [] } as never);
        const createCollection = jest
            .spyOn(db, 'createCollection')
            .mockRejectedValueOnce(Object.assign(new Error('exists'), { code: 48 }));
        await expect(em.registerModel('Child', Child)).resolves.toBe(em);
        createCollection.mockRejectedValueOnce(Object.assign(new Error('denied'), { code: 13 }));
        await expect(em.registerModel('Child', Child)).rejects.toThrow('denied');
        jest.restoreAllMocks();
    });
});

describe('pipes', () => {
    const metadata = { type: 'param' as const, metatype: EntityTest, data: undefined };
    it('should reject a malformed id', async () => {
        await expect(new ObjectIdPipe().transform('x', metadata)).rejects.toThrow(
            new BadRequestException('The objectId is malformed')
        );
        await expect(new RelationshipPipe(em).transform('x', metadata)).rejects.toThrow('The objectId is malformed');
    });
});

describe('Filter', () => {
    it('should have defaults and build the sorts', () => {
        const filter = new Filter();
        expect(filter).toMatchObject({ skip: 0, limit: 50, orderBy: ['_id:asc'] });
        expect(filter.getSort()).toEqual([['_id', 1]]);
        expect(filter.getSortForAggregation()).toEqual({ _id: 1 });
        expect(filter.toQuery()).toEqual({});
    });
});

describe('HistoryActions', () => {
    it('should add the actions', () => {
        const history = new HistoryActions();
        expect(history.getActions()).toEqual([]);
    });
});

describe('Slugify', () => {
    it('should require keys or generate', () => {
        class NoSeed {
            @Slugify({})
            slug: string;
        }
        expect(() => em.fromPlain(NoSeed as never, { slug: undefined }, {})).toThrow('Unable to slugify');
    });
});

describe('TransactionsOrchestrator', () => {
    it('should run the jobs one after the other and reject the failed jobs', async () => {
        const orchestrator = new TransactionsOrchestrator(Debug('test'));
        const order: number[] = [];
        const first = orchestrator.addJob(async () => {
            await new Promise((resolve) => setTimeout(resolve, 10));
            order.push(1);
            throw new Error('first');
        });
        const second = orchestrator.addJob(async () => {
            order.push(2);
            return 2;
        });
        await expect(first).rejects.toThrow('first');
        await expect(second).rejects.toThrow('first');
        expect(order).toEqual([1]);
    });
});

afterAll(async () => {
    await closeModule(ctx);
});
