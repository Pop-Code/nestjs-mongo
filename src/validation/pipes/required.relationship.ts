import { ArgumentMetadata, NotFoundException } from '@nestjs/common';
import { ObjectId } from 'mongodb';

import { RelationshipPipe } from './relationship';

export class RequiredRelationshipPipe extends RelationshipPipe {
    async transform(value: ObjectId, metadata: ArgumentMetadata) {
        const val = await super.transform(value, metadata);
        if (val === undefined) {
            throw new NotFoundException(
                `${
                    (metadata.metatype as any).name as string
                } with "${value.toHexString()}" not found`
            );
        }
        return val;
    }
}
