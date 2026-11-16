import { Exclude, Transform, Type } from 'class-transformer';
import { IsArray, IsInt, IsOptional, IsString, ValidateNested } from 'class-validator';
import { ObjectId } from 'mongodb';

import {
    AfterDelete,
    AfterInsert,
    AfterLoad,
    AfterUpdate,
    BeforeDelete,
    BeforeInsert,
    BeforeSave,
    BeforeUpdate,
    CascadeType,
    Collection,
    DeletedAt,
    Embedded,
    Entity,
    Index,
    IsUnique,
    Relationship,
    TypeObjectId,
    Version
} from '../../src';

export class Address {
    @IsString()
    street: string;

    @IsString()
    city: string;

    @IsOptional()
    @IsString()
    zip?: string;

    get label() {
        return `${this.street}, ${this.city}`;
    }
}

@Collection('ormCustomer')
export class Customer extends Entity {
    @IsString()
    name: string;

    @IsOptional()
    @IsString()
    normalizedName?: string;

    @IsOptional()
    @IsString()
    nickname?: string;

    @IsOptional()
    @IsInt()
    visits?: number;

    @IsOptional()
    @IsArray()
    @IsString({ each: true })
    tags?: string[];

    @IsOptional()
    @ValidateNested()
    @Embedded(() => Address)
    address?: Address;

    @IsOptional()
    @ValidateNested({ each: true })
    @Embedded(() => Address, { isArray: true })
    addresses?: Address[];

    @IsOptional()
    @TypeObjectId()
    ownerId?: ObjectId;

    // not decorated: not validated, removed from the written document by the whitelist
    transient?: string;

    __hooks: string[] = [];

    @BeforeSave()
    normalize() {
        this.normalizedName = typeof this.name === 'string' ? this.name.toLowerCase() : undefined;
    }

    @BeforeInsert()
    beforeInsert() {
        this.__hooks.push('beforeInsert');
    }

    @AfterInsert()
    afterInsert() {
        this.__hooks.push('afterInsert');
    }

    @BeforeUpdate()
    async beforeUpdate() {
        await Promise.resolve();
        this.__hooks.push('beforeUpdate');
    }

    @AfterUpdate()
    afterUpdate() {
        this.__hooks.push('afterUpdate');
    }

    @AfterLoad()
    afterLoad() {
        this.__hooks.push('afterLoad');
    }
}

@Collection('ormVip')
export class VipCustomer extends Customer {
    @IsOptional()
    @IsString()
    level?: string;

    @BeforeInsert()
    vipBeforeInsert() {
        this.__hooks.push('vipBeforeInsert');
    }
}

@Collection('ormVersioned')
export class Versioned extends Entity {
    @IsString()
    title: string;

    @Version()
    version?: number;
}

export const softDeleteEvents: string[] = [];

@Collection('ormSoft')
export class SoftDeleted extends Entity {
    @IsString()
    name: string;

    @DeletedAt()
    deletedAt?: Date;

    @BeforeDelete()
    beforeDelete() {
        softDeleteEvents.push(`beforeDelete:${this.name}`);
    }

    @AfterDelete()
    afterDelete() {
        softDeleteEvents.push(`afterDelete:${this.name}`);
    }
}

@Collection('ormSoftChild')
export class SoftDeletedChild extends Entity {
    @IsString()
    name: string;

    @Relationship({ type: () => SoftDeleted, cascade: [CascadeType.DELETE] })
    @IsOptional()
    parentId?: ObjectId;

    @DeletedAt()
    deletedAt?: Date;
}

@Collection('ormUnique')
export class UniqueEmail extends Entity {
    @IsUnique()
    @IsString()
    email: string;
}

@Index({ key: { lastName: 1, firstName: -1 }, name: 'person_name' })
@Collection('ormPerson')
export class Person extends Entity {
    @IsString()
    firstName: string;

    @IsString()
    lastName: string;

    @Index({ expireAfterSeconds: 3600 })
    @IsOptional()
    @Type(() => Date)
    expiresAt?: Date;
}

export class Legacy {
    @Type(() => Date)
    date: Date;

    @Transform(({ value }) => (typeof value === 'string' ? value.toUpperCase() : value))
    code: string;

    @Exclude()
    secret?: string;

    @Exclude({ toPlainOnly: true })
    hiddenInOutput?: string;

    @Type(() => Address)
    address?: Address;

    plain?: { nested: { value: number } };
}
