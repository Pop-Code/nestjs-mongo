import { applyDecorators } from '@nestjs/common';
import { Expose, Transform, Type } from 'class-transformer';
import slugify from 'slugify';

export type KeysOfType<T, V> = { [K in keyof T]: T[K] extends V ? K : never }[keyof T];

export interface ISlugifyOptions<T = any> {
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

        throw new Error('Unable to slugify: set the "keys" or "generate" option of @Slugify');
    };
    return Transform(({ value, obj }) => value ?? slugify(seed(obj), config.options))(target, key);
}

/**
 * Generate a slug when the property is empty, from other properties (`keys`) or a `generate` function.
 * The slug is generated when transforming plain data to a class (`fromPlain`).
 *
 * @example
 * ```ts
 * @Slugify<Article>({ keys: ['title'], options: { lower: true } })
 * slug: string;
 * ```
 */
export function Slugify<T = any>(config: ISlugifyOptions<T>) {
    return applyDecorators(
        ...[
            Type(() => String),
            (target: any, key: string) => SlugDecorator<T>(target, key, config),
            ...(config.expose !== undefined && config.expose ? [Expose()] : [])
        ]
    );
}
