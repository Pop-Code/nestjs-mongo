import { ArgumentMetadata, BadRequestException, Injectable, PipeTransform } from '@nestjs/common';
import { isMongoId } from 'class-validator';
import { ObjectId } from 'mongodb';

import { EntityManager, getModelEntityManager } from '../../entity/manager';
import { InjectEntityManager } from '../../module/injection';

/**
 * Load an entity from a route parameter. The entity class is the type of the parameter.
 * Resolves to `undefined` when the entity does not exist.
 *
 * @throws BadRequestException when the value is not an ObjectId
 */
@Injectable()
export class RelationshipPipe implements PipeTransform {
    constructor(@InjectEntityManager() protected readonly em: EntityManager) {}

    async transform(value: any, metadata: ArgumentMetadata) {
        if (!isMongoId(value)) {
            throw new BadRequestException(`The ${metadata.data ?? 'objectId'} is malformed`);
        }
        // the manager of the connection of the model
        const em = getModelEntityManager(metadata.metatype) ?? this.em;
        return await em.findOne(metadata.metatype as any, {
            _id: new ObjectId(value)
        });
    }
}
