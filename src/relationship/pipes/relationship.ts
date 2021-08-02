import { ArgumentMetadata, BadRequestException, Injectable, PipeTransform } from '@nestjs/common';
import { isMongoId } from 'class-validator';
import { ObjectId } from 'mongodb';

import { EntityManager } from '../../entity/manager';
import { InjectEntityManager } from '../../module/injection';

@Injectable()
export class RelationshipPipe implements PipeTransform {
    constructor(@InjectEntityManager() protected readonly em: EntityManager) {}

    async transform(value: any, metadata: ArgumentMetadata) {
        if (!isMongoId(value)) {
            throw new BadRequestException(`The ${metadata.data ?? 'objectId'} is malformed`);
        }
        return await this.em.findOne(metadata.metatype as any, {
            _id: new ObjectId(value)
        });
    }
}
