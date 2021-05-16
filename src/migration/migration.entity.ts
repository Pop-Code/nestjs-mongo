import { Type } from 'class-transformer';
import { IsString } from 'class-validator';

import { Entity } from '../entity';

export class MigrationEntity extends Entity {
    @Type(() => String)
    @IsString()
    version: string;
}
