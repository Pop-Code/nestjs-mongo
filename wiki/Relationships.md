---
title: Relationships
---

# Relationships

A relationship is a property that stores the `ObjectId` (or an array of `ObjectId`) of other entities.

```ts
import { ObjectId } from 'mongodb';
import { Collection, Entity, IsValidRelationship, Relationship } from 'nestjs-mongo';

@Collection('posts')
export class Post extends Entity {
    @Relationship(() => User) // the target model
    @IsValidRelationship() // the user must exist
    authorId: ObjectId;

    @Relationship({ type: () => Tag, isArray: true })
    @IsValidRelationship()
    @IsOptional()
    tagIds?: ObjectId[];
}
```

`@Relationship`:

- transforms the value from/to `ObjectId` (like `@TypeObjectId`),
- creates an index on the property (named `<Class>_<property>_relationship`),
- stores metadata used by `getRelationship(s)`, `@IsValidRelationship` and cascades.

The target type can be:

| Form                         | Use                                                                          |
| ---------------------------- | ---------------------------------------------------------------------------- |
| `() => User`                 | the usual form. The function avoids problems with circular imports           |
| `'User'`                     | the name of a registered model, when even a function causes circular imports |
| `(post) => (post.x ? A : B)` | a [dynamic type](#dynamic-types), computed from the entity                   |

Options: `type`, `isArray`, `cascade` (`[CascadeType.DELETE]`), `index` (`{ description }` to change the index: `unique`, compound `key`...) and `possibleTypes` (dynamic types).

## Loading relationships

```ts
const author = await this.em.getRelationship<User>(post, 'authorId'); // User | undefined
const tags = await this.em.getRelationships<Tag>(post, 'tagIds'); // Tag[]
// or with a repository
const author = await this.posts.getRelationship<User>(post, 'authorId');
```

`getRelationship` returns `undefined` when the property is empty. `getRelationships` returns `[]` when the property is empty,
and only the entities that exist. Using the wrong one for the `isArray` setting throws an error.

## Validation

`@IsValidRelationship()` checks on save that every referenced entity exists. Add your own rules with `with`, an async function
that receives the entity and the loaded relationship (an entity, or an array for `isArray`), and returns `true` or an error message:

```ts
@Relationship(() => User)
@IsValidRelationship({
    with: async (post: Post, author: User) => (author.active ? true : 'The author must be active')
})
authorId: ObjectId;
```

Combine it with `@IsOptional()` for optional relationships. All class-validator options (`groups`, `message`...) are supported.

## Cascade delete

With `cascade: [CascadeType.DELETE]`, deleting an entity through the manager or a repository (`deleteOne` / `deleteMany`) also deletes the related entities:

```ts
@Collection('comments')
export class Comment extends Entity {
    // deleting a Post deletes its comments
    @Relationship({ type: () => Post, cascade: [CascadeType.DELETE] })
    @IsValidRelationship()
    postId: ObjectId;
}

@Collection('galleries')
export class Gallery extends Entity {
    // isArray: deleting a Gallery deletes the referenced pictures
    @Relationship({ type: () => Picture, isArray: true, cascade: [CascadeType.DELETE] })
    pictureIds: ObjectId[];
}
```

- On a single relationship, the cascade goes from the **target to the owner**: deleting the `Post` deletes the `Comment`s whose `postId` is the post.
- On an array relationship, it goes from the **owner to the targets**: deleting the `Gallery` deletes the `Picture`s in `pictureIds`.
- Cascades are recursive (a post deletes its comments, which delete their own children...).
- The model that declares the relationship must be registered with `forFeature()`: cascades are set up when it is registered.
- Cascades only run through `deleteOne` / `deleteMany` of the manager or repositories, not through the native collection.
  Run the delete in a [transaction](./Transactions.md) to make the whole cascade atomic.

## Dynamic types

When a property can reference different models, return the type from the entity, and list the possible values of the
discriminator property in `possibleTypes` (needed to set up cascades for every type):

```ts
export enum OwnerType {
    User = 'User',
    Team = 'Team'
}

@Collection('files')
export class File extends Entity {
    @IsEnum(OwnerType)
    ownerType: OwnerType;

    @Relationship<User | Team>({
        type: (file: File) =>
            file.ownerType === OwnerType.User ? User : file.ownerType === OwnerType.Team ? Team : false,
        possibleTypes: { property: 'ownerType', values: Object.values(OwnerType) },
        cascade: [CascadeType.DELETE]
    })
    @IsValidRelationship()
    ownerId: ObjectId;
}
```

Return `false` when the type can not be determined: loading the relationship then throws an error.
