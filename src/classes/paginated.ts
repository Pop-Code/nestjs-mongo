import { IsNumber } from 'class-validator';
import { ISerializable, Serializable } from '../serializer';

export interface PaginatedData<D = any> extends ISerializable {}

@Serializable()
export class PaginatedData<D = any> {
    @IsNumber()
    count: number;
    data: D[];
}
