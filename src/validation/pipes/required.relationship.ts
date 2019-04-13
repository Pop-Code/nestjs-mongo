import { ArgumentMetadata, NotFoundException } from '@nestjs/common';
import { RelationshipPipe } from './relationship';

export class RequiredRelationshipPipe extends RelationshipPipe {
    async transform(value: any, metadata: ArgumentMetadata) {
        const val = await super.transform(value, metadata);
        if (!val) {
            throw new NotFoundException(
                `${metadata.metatype.name} with ${
                    metadata.data
                } "${value}" not found`
            );
        }
        return val;
    }
}
