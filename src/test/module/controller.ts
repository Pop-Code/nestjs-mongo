import { Controller, Get, Req } from '@nestjs/common';
import { Request } from 'express';

import { DATA_LOADER_NAMESPACE } from '../../constants';
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
        if (loader === undefined) {
            throw new Error('Dataloader do not exist');
        }
        return {
            item,
            uuid: loader.uuid,
            reqUuid: request[DATA_LOADER_NAMESPACE + '_uuid']
        };
    }
}
