/**
 * @module nestjs-mongo
 */

import { ChangeStream } from 'mongodb';

export interface MongoCollectionSubscriberInterface {
    subscribe(classType: any): ChangeStream;
}
