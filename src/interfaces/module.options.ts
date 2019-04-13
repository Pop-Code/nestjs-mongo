import { MongoClientOptions } from 'mongodb';
import { ExceptionFactory } from './exception';

export interface MongoModuleOptions extends MongoClientOptions {
    uri: string;
    exceptionFactory: ExceptionFactory;
}
