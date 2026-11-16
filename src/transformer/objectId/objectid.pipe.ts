import { ArgumentMetadata, BadRequestException, Injectable, PipeTransform } from '@nestjs/common';
import { isMongoId } from 'class-validator';
import { ObjectId } from 'mongodb';

/**
 * Transform a route parameter to an `ObjectId`.
 *
 * @throws BadRequestException when the value is not an ObjectId
 */
@Injectable()
export class ObjectIdPipe implements PipeTransform {
    async transform(value: any, metadata: ArgumentMetadata) {
        if (!isMongoId(value)) {
            throw new BadRequestException(`The ${metadata.data ?? 'objectId'} is malformed`);
        }
        return new ObjectId(value);
    }
}
