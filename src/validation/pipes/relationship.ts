/**
 * @module nestjs-mongo
 */

import {
    PipeTransform,
    Injectable,
    ArgumentMetadata,
    BadRequestException
} from '@nestjs/common';
import { MongoManager } from '../../manager';
import { Validator } from 'class-validator';
import { ObjectId } from '../../helpers';

// Validation methods
@Injectable()
export class RelationshipPipe implements PipeTransform {
    private validator: Validator;
    constructor(private readonly em: MongoManager) {
        this.validator = new Validator();
    }

    async transform(value: any, metadata: ArgumentMetadata) {
        if (!this.validator.isMongoId(value)) {
            throw new BadRequestException(`The ${metadata.data} is malformed`);
        }
        switch (metadata.type) {
            case 'query':
            case 'param':
                return await this.em.findOne(metadata.metatype, {
                    _id: new ObjectId(value)
                });
        }
        return value;
    }
}
