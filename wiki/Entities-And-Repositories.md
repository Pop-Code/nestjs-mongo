---
title: Entities and repositories
---

# Entities and repositories

## Models

```ts
import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Min, ValidateNested } from 'class-validator';
import { Collection, Entity } from 'nestjs-mongo';

export class Address {
    @IsString()
    city: string;
}

@Collection('customers')
export class Customer extends Entity {
    @IsString()
    name: string;

    @IsInt()
    @Min(0)
    points = 0; // default value for new instances

    @ValidateNested()
    @Type(() => Address) // nested objects need @Type to be transformed to class instances
    @IsOptional()
    address?: Address;
}
```

- `@Collection(name)` is required. Classes can extend other models: decorators (validation, indexes, relationships) are inherited.
- `Entity` provides `_id: ObjectId`, `createdAt: Date` (set when the instance is created) and `updatedAt?: Date` (set on every update).
- Properties are validated with class-validator on save, with `whitelist: true`: **a property without any class-validator decorator is not saved**. Use `@Allow()` when a property has no rule.
- Documents read from mongo are transformed to model instances with class-transformer, so use `@Type()` for nested classes and dates.

## The entity manager

There is one `EntityManager` per connection. Repositories delegate to it, and you can inject it to work with several models:

```ts
import { EntityManager, InjectEntityManager } from 'nestjs-mongo';

constructor(@InjectEntityManager() private readonly em: EntityManager) {}

const customer = await this.em.findOne(Customer, { name: 'Ada' });
const cursor = await this.em.find(Customer, { points: { $gt: 10 } }, { limit: 20 });
const count = await this.em.count(Customer, {});
```

Queries and options are the ones of the mongodb driver (`Filter`, `FindOptions`, `CountDocumentsOptions`, ...).
`find()` returns the native `FindCursor`, mapped to model instances.

For anything the helpers do not cover (aggregations, bulk writes, `updateMany`...), use the native collection.
Hydrate the results with `fromPlain` when you need model instances:

```ts
const collection = this.em.getCollection(Customer); // mongodb Collection
const docs = await collection.aggregate([{ $match: { points: { $gt: 10 } } }]).toArray();
const customers = docs.map((doc) => this.em.fromPlain(Customer, doc));
```

Native collection calls skip validation, cascades and the session of the context ([Transactions](./Transactions.md)): pass `{ session }` yourself if needed.

## Saving

`save()` inserts an entity without `_id`, and updates an entity with an `_id`:

```ts
const customer = this.em.fromPlain(Customer, { name: 'Ada' });
await this.em.save(customer); // insertOne, customer._id is now set

customer.points = 42;
customer.address = undefined; // explicitly undefined: removed with $unset
await this.em.save(customer); // updateOne({ _id }, { $set, $unset }), updatedAt is set
```

- The entity is validated first. When it is invalid, `save()` throws the result of the `exceptionFactory` of the module options (by default the `ValidationError[]` array).
- Options: every `InsertOneOptions` / `UpdateOptions` of the driver, plus `skipValidation` and `validatorOptions` (class-validator options, for example `{ groups: ['admin'] }`).
- An update `$set`s the whole entity: it does not compute a diff. Use the native collection for atomic operators like `$inc` or `$push`.

## Deleting

```ts
await this.em.deleteOne(Customer, { _id: id }); // throws NotFoundException if nothing matches
await this.em.deleteMany(Customer, { points: 0 });
```

Both run the delete cascades of [relationships](./Relationships.md#cascade-delete). They load the matching entities first to do that.

## Repositories

Each model registered with `forFeature()` gets an `EntityRepository`, which has the same methods as the manager without the model argument:
`save`, `find`, `findOne`, `count`, `deleteOne`, `deleteMany`, `watch`, `getRelationship(s)`, `fromPlain`, `merge`, `validate`, `getCollection`.

```ts
constructor(@InjectEntityRepository(Customer) private readonly customers: EntityRepository<Customer>) {}
```

### Custom repositories

Extend `EntityRepository` to keep your queries in one place, and register it with the model:

```ts
import { EntityRepository } from 'nestjs-mongo';

export class CustomerRepository extends EntityRepository<Customer> {
    async findTop(limit = 10) {
        const cursor = await this.find({}, { sort: { points: -1 }, limit });
        return await cursor.toArray();
    }
}

@Module({
    imports: [MongoModule.forFeature({ models: [{ model: Customer, repository: CustomerRepository }] })]
})
export class CustomerModule {}

// inject it with the model as token, and your class as type
constructor(@InjectEntityRepository(Customer) private readonly customers: CustomerRepository) {}
```

## EntityService, Filter and pagination

`EntityService` is an optional base class for CRUD services. Set its `repository` and you get `create`, `get`, `list`, `update`, `delete` and `subscribe`:

```ts
import { Injectable } from '@nestjs/common';
import { EntityService, InjectEntityRepository } from 'nestjs-mongo';

@Injectable()
export class CustomerService extends EntityService<Customer, CustomerRepository> {
    constructor(@InjectEntityRepository(Customer) protected readonly repository: CustomerRepository) {
        super();
    }
}
```

| Method                       | Does                                                                                  |
| ---------------------------- | ------------------------------------------------------------------------------------- |
| `create(data, save?)`        | `fromPlain(data)`, then saves it if `save` is true                                    |
| `get(id)`                    | `findOne({ _id })`, throws `NotFoundException`                                        |
| `list(filter, ResponseType)` | paginated and sorted find, returns `{ count, data }` as an instance of `ResponseType` |
| `update(id, data, save?)`    | `get(id)`, merges `data`, then saves it if `save` is true                             |
| `delete(id)`                 | `deleteOne({ _id })`, throws `NotFoundException`                                      |
| `subscribe(callback)`        | see [Change streams](./Change-Streams.md)                                             |

`Filter` describes a page: `skip` (default 0), `limit` (default 50, max 500) and `orderBy` (`['property:asc' | 'property:desc']`, default `['_id:asc']`).
It is validated and transformed like any other class, so it works with the NestJS `ValidationPipe` on query strings (`?skip=0&limit=10&orderBy=name:asc,createdAt:desc`).
Override `toQuery()` to add your own criteria:

```ts
import { Type } from 'class-transformer';
import { IsInt, IsOptional } from 'class-validator';
import { Filter, PaginatedData } from 'nestjs-mongo';

export class CustomerFilter extends Filter {
    @IsInt()
    @IsOptional()
    @Type(() => Number)
    minPoints?: number;

    toQuery() {
        return this.minPoints !== undefined ? { points: { $gte: this.minPoints } } : {};
    }
}

export class CustomerPage extends PaginatedData<Customer> {}

@Get()
async list(@Query(new ValidationPipe({ transform: true })) filter: CustomerFilter) {
    return await this.customerService.list(filter, CustomerPage); // { count, data }
}
```

## Pipes

| Pipe                       | Transforms a route parameter to                                                     |
| -------------------------- | ----------------------------------------------------------------------------------- |
| `ObjectIdPipe`             | an `ObjectId` (`400 Bad Request` if malformed)                                      |
| `RelationshipPipe`         | the entity whose class is the parameter type, or `undefined`                        |
| `RequiredRelationshipPipe` | the entity whose class is the parameter type (`404 Not Found` if it does not exist) |

```ts
@Get(':id')
async get(@Param('id', RequiredRelationshipPipe) customer: Customer) {
    return customer.serialize();
}

@Delete(':id')
async remove(@Param('id', ObjectIdPipe) id: ObjectId) {
    await this.customerService.delete(id);
}
```
