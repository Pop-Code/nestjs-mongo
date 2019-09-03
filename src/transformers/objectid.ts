import {
    PipeTransform,
    Injectable,
    ArgumentMetadata,
    BadRequestException
} from '@nestjs/common';
import { Validator } from 'class-validator';
import { ObjectId } from '../helpers';

@Injectable()
export class ObjectIdPipe implements PipeTransform {
    protected validator: Validator;
    constructor() {
        this.validator = new Validator();
    }

    async transform(value: any, metadata: ArgumentMetadata) {
        if (!this.validator.isMongoId(value)) {
            throw new BadRequestException(`The ${metadata.data} is malformed`);
        }
        return new ObjectId(value);
    }
}
