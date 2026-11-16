---
title: Getting started
---

# Getting started

## Install

```bash
npm install nestjs-mongo mongodb class-validator
# or
yarn add nestjs-mongo mongodb class-validator
```

`@nestjs/common`, `@nestjs/core`, `mongodb`, `class-validator` and `reflect-metadata` are peer dependencies:
your application provides them, so there is only one copy of each.

Enable decorators in your `tsconfig.json` (a NestJS project already does):

```json
{
    "compilerOptions": {
        "experimentalDecorators": true,
        "emitDecoratorMetadata": true
    }
}
```

## Connect

Register the connection once, in your root module. `useFactory` returns the connection `uri` and any
[`MongoClientOptions`](https://mongodb.github.io/node-mongodb-native/7.0/interfaces/MongoClientOptions.html) of the driver.

```ts
// app.module.ts
import { BadRequestException, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongoModule } from 'nestjs-mongo';

import { UserModule } from './user/user.module';

@Module({
    imports: [
        MongoModule.forRootAsync({
            imports: [ConfigModule],
            inject: [ConfigService],
            useFactory: (config: ConfigService) => ({
                uri: config.getOrThrow('MONGO_URI'), // mongodb://localhost:27017/my-app
                // thrown when an entity is not valid on save (default: the ValidationError[] array)
                exceptionFactory: (errors) => new BadRequestException(errors)
            })
        }),
        UserModule
    ]
})
export class AppModule {}
```

The database is the one in the uri. The client is connected when the application starts and closed when it shuts down.

## Define a model

A model is a class that extends `Entity` and has a `@Collection`. `Entity` adds `_id`, `createdAt` and `updatedAt`.

Every persisted property needs a class-validator decorator: properties without one are removed on save
(validation runs with `whitelist: true`). Use `@Allow()` for a property without rules.

```ts
// user/user.entity.ts
import { IsEmail, IsOptional, IsString } from 'class-validator';
import { Collection, Entity, IsUnique } from 'nestjs-mongo';

@Collection('users')
export class User extends Entity {
    @IsEmail()
    @IsUnique() // validation + unique index
    email: string;

    @IsString()
    name: string;

    @IsString()
    @IsOptional()
    bio?: string;
}
```

## Register the model and use its repository

`MongoModule.forFeature()` registers the models: it creates the collection and the indexes, and provides a repository for each model.

```ts
// user/user.module.ts
import { Module } from '@nestjs/common';
import { MongoModule } from 'nestjs-mongo';

import { User } from './user.entity';
import { UserService } from './user.service';

@Module({
    imports: [MongoModule.forFeature({ models: [User] })],
    providers: [UserService],
    exports: [UserService]
})
export class UserModule {}
```

```ts
// user/user.service.ts
import { Injectable } from '@nestjs/common';
import { ObjectId } from 'mongodb';
import { EntityRepository, InjectEntityRepository } from 'nestjs-mongo';

import { User } from './user.entity';

@Injectable()
export class UserService {
    constructor(@InjectEntityRepository(User) private readonly users: EntityRepository<User>) {}

    async register(email: string, name: string) {
        const user = this.users.fromPlain({ email, name });
        return await this.users.save(user); // validates, then inserts: user._id is set
    }

    async findById(id: ObjectId) {
        return await this.users.findOne({ _id: id }); // a User instance, or undefined
    }

    async findByName(name: string) {
        const cursor = await this.users.find({ name }, { sort: { createdAt: -1 } });
        return await cursor.toArray(); // User[]
    }
}
```

Next: [Entities and repositories](./Entities-And-Repositories.md).
