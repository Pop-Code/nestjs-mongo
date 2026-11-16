import { ArgumentMetadata, NotFoundException } from '@nestjs/common';
import { ObjectId } from 'mongodb';

import { RelationshipPipe } from './relationship';

/**
 * Like {@link RelationshipPipe}, but throws a `NotFoundException` when the entity does not exist.
 */
export class RequiredRelationshipPipe extends RelationshipPipe {
    async transform(value: string | ObjectId, metadata: ArgumentMetadata) {
        const val = await super.transform(value, metadata);
        if (val === undefined) {
            throw new NotFoundException(`${(metadata.metatype as any).name as string}:${String(value)} not found`);
        }
        return val;
    }
}
