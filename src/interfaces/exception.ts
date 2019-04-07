import { ValidationError } from 'class-validator';

export type ExceptionFactory = (errors: ValidationError[]) => any;
