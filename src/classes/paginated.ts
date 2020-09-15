import { IsNumber } from 'class-validator';

import { ISerializable, Serializable } from '../serializer';

export interface PaginatedData extends ISerializable {}

@Serializable()
export class PaginatedData<D = any> {
    @IsNumber()
    count: number;

    data: D[];
}
