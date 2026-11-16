---
title: Serialization
---

# Serialization

## From plain objects

`fromPlain()` (on the manager or a repository) uses class-transformer to build a model instance, for example from a request body:

```ts
const user = this.users.fromPlain(body); // a User instance, ObjectId strings become ObjectId
```

`merge(entity, data)` deep merges data into an existing entity (`undefined` values of `data` are ignored). It is what `EntityService.update()` uses.

Properties starting with `__` are excluded from the transformations: use the prefix for runtime-only state.

## To plain objects

Models extend `Entity`, which is `@Serializable()`. It adds two methods:

| Method        | Returns                                                                                                                                                            |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `serialize()` | a plain object built with class-transformer (`instanceToPlain`): `@Exclude()` / `@Expose()` apply, ObjectIds become hex strings                                    |
| `toJSON()`    | the own properties and the getters, without the `__` properties. `JSON.stringify` (and so NestJS responses) uses it. class-transformer decorators do **not** apply |

```ts
@Collection('users')
export class User extends Entity {
    @IsString()
    firstName: string;

    @IsString()
    lastName: string;

    @Exclude({ toPlainOnly: true })
    @IsString()
    passwordHash: string;

    get fullName() {
        return `${this.firstName} ${this.lastName}`;
    }
}

@Get(':id')
async get(@Param('id', RequiredRelationshipPipe) user: User) {
    return user.serialize(); // no passwordHash, _id as a string
}
```

> **Warning:** returning the entity itself (`return user;`) goes through `toJSON()`, which ignores `@Exclude()`: `passwordHash` would be in the response.
> Return `serialize()` when a model has excluded properties.

`@Serializable()` works on any class (`Filter` and `PaginatedData` use it too).

## ObjectId properties

Use `@TypeObjectId()` for an `ObjectId` property that is not a relationship (`@Relationship` already does it), and `@TypeObjectId(true)` for an array:

```ts
@TypeObjectId()
ownerId: ObjectId;

@TypeObjectId(true)
viewerIds: ObjectId[];
```

The value becomes an `ObjectId` in `fromPlain()` and a hex string in `serialize()`.

## Slugs

`@Slugify` fills an empty property with a slug (with [slugify](https://github.com/simov/slugify)) when an instance is created with `fromPlain()`:

```ts
@Collection('articles')
export class Article extends Entity {
    @IsString()
    title: string;

    @Slugify<Article>({ keys: ['title'], options: { lower: true, strict: true } })
    @IsString()
    slug: string;

    // or with a function
    @Slugify<Article>({ generate: (article) => `${article.title} ${article.createdAt.getFullYear()}` })
    @IsString()
    slugWithYear: string;
}
```

An existing value is kept. `expose: true` adds `@Expose()` to the property.
