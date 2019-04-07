# nestjs-mongo

[NestJS Mongo][doc-link] is a module that provide a little orm. Build with typescript and the nodejs mogodb driver

### [Install FROM NPM][npm]

```bash
npm install nestjs-mongo
# or unig yarn
yarn install nestjs-mongo
```

### Usage

An example of nestjs module that import the nestjs-mongo

```ts
// module.ts
import { Module } from '@nestjs/common';
import { MongoModule } from 'nestjs-mongo';

@Module({
    imports: [
        MongoModule.forRootAsync({
            imports: [],
            useFactory: (config: ConfigService) => ({
                uri: config.mongoUri
            }),
            inject: [MyConfigService]
        })
    ]
})
export class MyModule {}
```

TODO, write doc.

### Documentation

A typedoc is generated and available on github [https://pop-code.github.io/nestjs-mongo][doc-link]

### [CHANGELOG][changelog]

#### TODO

-   [ ] write docs
-   [ ] add more tests
-   [ ] add examples

[npm]: https://www.npmjs.com/package/nestjs-mongo
[doc-link]: https://pop-code.github.io/nestjs-mongo
[changelog]: https://github.com/Pop-Code/nestjs-mongo/blob/master/CHANGELOG.md
