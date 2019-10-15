import { ApiModelProperty } from '@nestjs/swagger';
import { IsNumber } from 'class-validator';
import { ISerializable, Serializable } from '../serializer';

export interface PaginatedResponse extends ISerializable {}

@Serializable()
export class PaginatedResponse {
    @ApiModelProperty({
        description: 'The total count of data',
        minimum: 0
    })
    @IsNumber()
    count: number;
    data: any;
}
