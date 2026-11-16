---
title: Change streams
---

# Change streams

Change streams require a replica set.

## `watch()`

`watch()` opens a native [change stream](https://www.mongodb.com/docs/manual/changeStreams/) on the collection of a model:

```ts
const stream = this.users.watch([{ $match: { operationType: 'insert' } }], { fullDocument: 'updateLookup' });
stream.on('change', (change) => {
    /* ... */
});
// later
await stream.close();
```

The documents of the events are plain documents: use `fromPlain()` to get model instances.

## `EntityService.subscribe()`

`subscribe()` watches the collection of the service, transforms `fullDocument` to a model instance, and calls your callback with an event name
built from the operation and the model name (`onInsertUser`, `onUpdateUser`, `onReplaceUser`, `onDeleteUser`...):

```ts
@Injectable()
export class UserNotifier implements OnModuleInit, OnModuleDestroy {
    private stream?: ChangeStream;

    constructor(private readonly userService: UserService) {}

    onModuleInit() {
        this.stream = this.userService.subscribe((eventName, change) => {
            if (eventName === 'onInsertUser' && change.operationType === 'insert') {
                console.log('new user', change.fullDocument.email);
            }
        });
    }

    async onModuleDestroy() {
        await this.stream?.close();
    }
}
```

Errors thrown by the callback are logged with the `nestjs-mongo` [debug](https://github.com/debug-js/debug) namespace (`DEBUG=nestjs-mongo*`), not rethrown.
