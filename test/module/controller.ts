import { Controller, Get, Req } from '@nestjs/common';
import { Request } from 'express';

import { DATA_LOADER_NAMESPACE } from '../../src/constants';
import { InjectManager } from '../../src/decorators';
import { ObjectId } from '../../src/helpers';
import { MongoManager } from '../../src/manager';
import { EntityTest } from '../entity/entity';

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
