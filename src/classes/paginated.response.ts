import { IsNumber } from 'class-validator';
import { ISerializable, Serializable } from '../serializer';

export interface PaginatedResponse extends ISerializable {}

@Serializable()
export class PaginatedResponse {
    @IsNumber()
    count: number;
    data: any;
}
