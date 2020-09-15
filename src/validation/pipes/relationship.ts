import { ArgumentMetadata, BadRequestException, Injectable, PipeTransform } from '@nestjs/common';
import { isMongoId } from 'class-validator';

import { InjectManager } from '../../decorators';
import { ObjectId } from '../../helpers';
import { MongoManager } from '../../manager';

@Injectable()
export class RelationshipPipe implements PipeTransform {
    constructor(@InjectManager() protected readonly em: MongoManager) {}

    async transform(value: any, metadata: ArgumentMetadata) {
        if (!isMongoId(value)) {
            throw new BadRequestException(
                `The ${metadata.data ?? 'objectId'} is malformed`
            );
        }
        return await this.em.findOne(metadata.metatype as any, {
            _id: new ObjectId(value)
        });
    }
}
