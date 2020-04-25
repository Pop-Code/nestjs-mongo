import { Controller, Get, Req } from '@nestjs/common';
import { Request } from 'express';

import { LOADER_SESSION_NAME } from '../../constants';
import { InjectManager } from '../../decorators';
import { ObjectId } from '../../helpers';
import { MongoManager } from '../../manager';
import { EntityTest } from './entity';

@Controller('test')
export class TestController {
    public entityTestId: ObjectId;

    constructor(@InjectManager() protected em: MongoManager) {}

    @Get()
    async index(@Req() request: Request) {
        const item = await this.em.findOne(EntityTest, {
            _id: this.entityTestId
        });
        const loader = this.em.getDataloader('EntityTest');
        return {
            item,
            uuid: loader.uuid,
            reqUuid: request[LOADER_SESSION_NAME + '_uuid']
        };
    }
}
