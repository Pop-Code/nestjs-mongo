import { ClassTransformOptions } from 'class-transformer';

export interface MongoExecutionOptions {
    transform?: ClassTransformOptions;
    database?: string;
    mongoOperationOptions?: any;
}
