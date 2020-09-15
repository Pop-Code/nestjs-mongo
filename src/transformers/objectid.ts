import { ArgumentMetadata, BadRequestException, Injectable, PipeTransform } from '@nestjs/common';
import { isMongoId } from 'class-validator';

import { ObjectId } from '../helpers';

@Injectable()
export class ObjectIdPipe implements PipeTransform {
    async transform(value: any, metadata: ArgumentMetadata) {
        if (!isMongoId(value)) {
            throw new BadRequestException(
                `The ${metadata.data ?? 'objectId'} is malformed`
            );
        }
        return new ObjectId(value);
    }
}
