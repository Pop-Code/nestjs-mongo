import { ArgumentMetadata, NotFoundException } from '@nestjs/common';
import { RelationshipPipe } from './relationship';
import { ObjectId } from 'mongodb';

export class RequiredRelationshipPipe extends RelationshipPipe {
    async transform(value: ObjectId, metadata: ArgumentMetadata) {
        const val = await super.transform(value, metadata);
        if (val === undefined) {
            throw new NotFoundException(
                `${metadata.metatype.name} with ${
                    metadata.data
                } "${value.toHexString()}" not found`
            );
        }
        return val;
    }
}
