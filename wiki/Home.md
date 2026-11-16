---
title: Guides
children:
    - ./Getting-Started.md
    - ./Entities-And-Repositories.md
    - ./Relationships.md
    - ./Validation-And-Indexes.md
    - ./Transactions.md
    - ./Serialization.md
    - ./Change-Streams.md
    - ./Multiple-Connections.md
    - ./Upgrading.md
---

# nestjs-mongo

nestjs-mongo is a small ORM-like layer for [NestJS](https://nestjs.com) on top of the official [mongodb driver](https://www.mongodb.com/docs/drivers/node/current/).
It does not hide the driver: queries are plain mongodb filters and cursors are native cursors. It adds:

- **Models** as TypeScript classes, transformed with [class-transformer](https://github.com/typestack/class-transformer) and validated with [class-validator](https://github.com/typestack/class-validator)
- **Repositories** injected per model, and an **entity manager** per connection
- **Relationships** between models (`ObjectId` references), with validation, loading helpers and cascade delete
- **Indexes** and **unique** validation declared with decorators
- **Transactions** shared across all the operations of a request (async context)
- **Change streams** helpers, **pipes** for route parameters, and **serialization**

## Requirements

| nestjs-mongo | NestJS     | mongodb driver | MongoDB server | Node.js  |
| ------------ | ---------- | -------------- | -------------- | -------- |
| 0.15.x       | 10, 11, 12 | 7.x            | 4.4 to 9.0     | >= 22.12 |
| 0.14.x       | 8, 9       | 4.x            | 3.6 to 6.0     | >= 14    |

Transactions and change streams require a replica set (a single node replica set is fine for development).

## Guides

1. [Getting started](./Getting-Started.md): install, connect, define a model, use a repository
2. [Entities and repositories](./Entities-And-Repositories.md): CRUD, custom repositories, the `EntityService` and pagination
3. [Relationships](./Relationships.md): references, validation, loading, cascade delete, dynamic types, pipes
4. [Validation and indexes](./Validation-And-Indexes.md): validation on save, `@IsUnique`, `@Index`
5. [Transactions](./Transactions.md): sessions and the request context
6. [Serialization](./Serialization.md): `serialize()`, `toJSON()`, ObjectIds, slugs
7. [Change streams](./Change-Streams.md): `watch()` and `subscribe()`
8. [Multiple connections](./Multiple-Connections.md)
9. [Upgrading](./Upgrading.md) from 0.14

The full API reference is generated with typedoc: <https://pop-code.github.io/nestjs-mongo>.
