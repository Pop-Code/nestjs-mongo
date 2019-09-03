import {
    PipeTransform,
    Injectable,
    ArgumentMetadata,
    BadRequestException,
    Inject
} from '@nestjs/common';
import { MongoManager } from '../../manager';
import { Validator } from 'class-validator';
import { ObjectId } from '../../helpers';
import { InjectManager } from '../../decorators';

// Validation methods
@Injectable()
export class RelationshipPipe implements PipeTransform {
    protected validator: Validator;
    constructor(@InjectManager() protected readonly em: MongoManager) {
        this.validator = new Validator();
    }

    async transform(value: any, metadata: ArgumentMetadata) {
        if (!this.validator.isMongoId(value)) {
            throw new BadRequestException(`The ${metadata.data} is malformed`);
        }
        return await this.em.findOne(metadata.metatype as any, {
            _id: new ObjectId(value)
        });
    }
}
