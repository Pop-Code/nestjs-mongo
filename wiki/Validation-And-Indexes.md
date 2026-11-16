---
title: Validation and indexes
---

# Validation and indexes

## Validation on save

`save()` validates the entity with class-validator before writing it:

- with `whitelist: true`: properties without a class-validator decorator are removed (use `@Allow()` to keep one without rules),
- when it is invalid, `save()` throws `exceptionFactory(errors)`. Set the factory in the module options:

```ts
MongoModule.forRootAsync({
    useFactory: () => ({
        uri: 'mongodb://localhost:27017/my-app',
        exceptionFactory: (errors) => new BadRequestException(errors)
    })
});
```

Without a factory, the `ValidationError[]` array is thrown.

Per call options:

```ts
await em.save(entity, { skipValidation: true });
await em.save(entity, { validatorOptions: { groups: ['admin'], skipMissingProperties: true } });
```

You can also validate without saving: `await em.validate(entity)` returns the errors, `await em.validate(entity, {}, true)` throws them.

## `@IsUnique`

Checks that no other entity has the same value, and creates a unique index on the property:

```ts
@Collection('users')
export class User extends Entity {
    @IsEmail()
    @IsUnique()
    email: string;

    // unique per tenant: compound unique index { slug: 1, tenantId: 1 }
    @IsString()
    @IsUnique({ keys: ['tenantId'] })
    slug: string;

    @TypeObjectId()
    tenantId: ObjectId;
}
```

| Option    | Does                                                                        |
| --------- | --------------------------------------------------------------------------- |
| `keys`    | other properties of a compound unique key                                   |
| `sparse`  | creates a sparse index, and treats an empty key as "the key does not exist" |
| `noIndex` | validates only, without creating the index                                  |

plus every class-validator option (`message`, `groups`...). The check ignores the entity itself (on update), and runs in the session of the context ([Transactions](./Transactions.md)).

The validation gives a readable error, but it can not prevent a race between two concurrent saves: keep the index (the default), it is what guarantees uniqueness.

## `@Index`

Declares an index on a property:

```ts
@Collection('events')
export class Event extends Entity {
    @Index() // { name: 1 }
    @IsString()
    name: string;

    @Index({ unique: true, sparse: true })
    @IsString()
    @IsOptional()
    externalId?: string;

    @Index({ key: { date: -1, name: 1 } }) // compound index
    @IsDate()
    @Type(() => Date)
    date: Date;

    @Index({ expireAfterSeconds: 3600 }) // TTL index
    @IsDate()
    @Type(() => Date)
    expiresAt: Date;
}
```

The options are the ones of the driver [`IndexDescription`](https://mongodb.github.io/node-mongodb-native/7.0/interfaces/IndexDescription.html) (`key`, `name`, `unique`, `sparse`, `partialFilterExpression`, `expireAfterSeconds`, `collation`...).

Indexes are created when the model is registered (at startup), for the model and the classes it extends. `@Relationship` also creates an index on its property.
Creating an index that conflicts with an existing one (same key, different options) logs an error and does not stop the application: drop the old index to change it.
