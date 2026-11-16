import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { ValidationError } from 'class-validator';

/**
 * Thrown by the default `exceptionFactory` when an entity is not valid.
 * Extends the NestJS `BadRequestException` (HTTP 400).
 */
export class EntityValidationException extends BadRequestException {
    constructor(public readonly errors: ValidationError[]) {
        super({ message: 'Validation failed', errors });
    }
}

/**
 * Thrown by the `*OrFail` methods when no document matches the filter.
 * Extends the NestJS `NotFoundException` (HTTP 404).
 */
export class EntityNotFoundException extends NotFoundException {
    constructor(
        public readonly entityName: string,
        public readonly filter?: unknown
    ) {
        super(`${entityName} not found`);
    }
}

/**
 * Thrown when a write fails on a unique index (MongoDB error code 11000).
 * Extends the NestJS `ConflictException` (HTTP 409).
 */
export class DuplicateKeyException extends ConflictException {
    constructor(
        message: string,
        public readonly keyValue?: Record<string, unknown>,
        cause?: unknown
    ) {
        super(message, { cause });
    }
}

/**
 * Thrown when an entity with a `@Version()` property was changed by another write since it was loaded.
 * Extends the NestJS `ConflictException` (HTTP 409).
 */
export class OptimisticLockException extends ConflictException {
    constructor(
        public readonly entityName: string,
        public readonly id: unknown,
        public readonly version: number
    ) {
        super(`${entityName} ${String(id)} was modified since version ${version}`);
    }
}

/**
 * Maps the errors of the mongodb driver to the exceptions of the module:
 * a duplicate key error (11000) becomes a {@link DuplicateKeyException}, other errors are returned as is.
 */
interface MongoWriteError {
    code?: number;
    message?: string;
    keyValue?: Record<string, unknown>;
    writeErrors?: Array<{
        code?: number;
        keyValue?: Record<string, unknown>;
        err?: { keyValue?: Record<string, unknown> };
    }>;
}

const isMongoWriteError = (e: unknown): e is MongoWriteError => typeof e === 'object' && e !== null;

export function mapMongoError(e: unknown): unknown {
    if (!isMongoWriteError(e)) return e;
    if (e.code === 11000) {
        return new DuplicateKeyException(e.message ?? 'Duplicate key', e.keyValue, e);
    }
    const writeError = e.writeErrors?.find((w) => w?.code === 11000);
    if (writeError !== undefined) {
        return new DuplicateKeyException(
            e.message ?? 'Duplicate key',
            writeError.err?.keyValue ?? writeError.keyValue,
            e
        );
    }
    return e;
}
