import { RuntimeException } from '@nestjs/core/errors/exceptions/runtime.exception';
import { Transform } from 'class-transformer';
import { isNotEmpty } from 'class-validator';
import slugify from 'slugify';

type KeysOfType<T, V> = { [K in keyof T]: T[K] extends V ? K : never }[keyof T];

interface ISlugifyOptions<T = any> {
    /* enforce "slugify-able" keys to reference only string values */
    keys?: Array<KeysOfType<T, string>>;
    generate?: (obj: T) => string;
}

export function SlugTransformer(obj: any, options: ISlugifyOptions) {
    const seed = (() => {
        if (typeof options.generate === 'function')
            return options.generate(obj);

        if (options.keys.length > 0)
            return options.keys
                .filter(Boolean)
                .reduce((str, key) => `${str} ${obj[key] as string}`, '');

        throw new RuntimeException('Unable to slugify');
    })();

    return slugify(seed);
}

export function Slugify<T = any>(options: ISlugifyOptions<T>) {
    return (target: any, key: string) => {
        Transform((val: any, obj: any) => {
            if (isNotEmpty(val)) return val;
            return SlugTransformer(obj, options);
        })(target, key);
    };
}
