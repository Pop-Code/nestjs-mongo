import { applyDecorators } from '@nestjs/common';
import { RuntimeException } from '@nestjs/core/errors/exceptions/runtime.exception';
import { Expose, Transform, Type } from 'class-transformer';
import slugify from 'slugify';

type KeysOfType<T, V> = { [K in keyof T]: T[K] extends V ? K : never }[keyof T];

interface ISlugifyOptions<T = any> {
    /* enforce "slugify-able" keys to reference only string values */
    keys?: Array<KeysOfType<T, string>>;
    generate?: (obj: T) => string;
    expose?: boolean;
    options?:
        | {
              replacement?: string;
              remove?: RegExp;
              lower?: boolean;
              strict?: boolean;
          }
        | string;
}

export function SlugDecorator<T>(target: any, key: string, config: ISlugifyOptions<T>) {
    const seed = (obj: any) => {
        if (typeof config.generate === 'function') return config.generate(obj);

        if (config.keys?.length !== undefined && config.keys?.length > 0)
            return config.keys.filter(Boolean).reduce((str, key) => `${str} ${obj[key] as string}`, '');

        throw new RuntimeException('Unable to slugify');
    };
    return Transform(({ value, obj }) => value ?? slugify(seed(obj), config.options))(target, key);
}

export function Slugify<T = any>(config: ISlugifyOptions<T>) {
    return applyDecorators(
        ...[
            Type(() => String),
            (target: any, key: string) => SlugDecorator<T>(target, key, config),
            ...(config.expose !== undefined && config.expose ? [Expose()] : [])
        ]
    );
}
