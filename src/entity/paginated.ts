import { IsNumber } from 'class-validator';

import { Serializable, SerializableInterface } from '../serializer';

export interface PaginatedData extends SerializableInterface {}

@Serializable()
export class PaginatedData<D = any> {
    @IsNumber()
    count: number;

    data: D[];
}
