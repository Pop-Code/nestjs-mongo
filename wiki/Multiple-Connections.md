---
title: Multiple connections
---

# Multiple connections

Give a `connectionName` to each additional connection, and use the same name in `forFeature()` and in the injection decorators:

```ts
@Module({
    imports: [
        MongoModule.forRootAsync({ useFactory: () => ({ uri: 'mongodb://localhost:27017/app' }) }), // the default connection
        MongoModule.forRootAsync({
            connectionName: 'analytics',
            useFactory: () => ({ uri: 'mongodb://analytics:27017/analytics' })
        }),
        MongoModule.forFeature({ models: [User] }),
        MongoModule.forFeature({ connectionName: 'analytics', models: [PageView] })
    ]
})
export class AppModule {}

@Injectable()
export class StatsService {
    constructor(
        @InjectEntityRepository(PageView, 'analytics') private readonly pageViews: EntityRepository<PageView>,
        @InjectEntityManager('analytics') private readonly analytics: EntityManager,
        @InjectMongoClient('analytics') private readonly analyticsClient: MongoClient
    ) {}
}
```

- A model class belongs to one connection: register it on a single connection.
- Relationships, cascades, transactions and validators work within a connection. A relationship can not reference a model of another connection.
- The injection tokens are available with `getEntityManagerToken(name)`, `getEntityRepositoryToken(model.name, name)`, `getConnectionToken(name)` and `getConfigToken(name)`, for example to override them in tests.
