export const DEBUG = 'nestjs-mongo';

export const DEFAULT_CONNECTION_NAME = 'nestjs-mongo:connection:default';
export const NAMED_CONNECTION_TOKEN = 'nestjs-mongo:connection:name';

export const RELATIONSHIP_METADATA_NAME = 'nestjs-mongo:relationship';
export const INVERSED_RELATIONSHIP_METADATA_NAME =
    'nestjs-mongo:inversed_relationship';
export const RELATIONSHIPS_CASCADES_METADATA_NAME =
    'nestjs-mongo:relationships_cascades';
export const CHILD_RELATIONSHIPS = 'nestjs-mongo:child_relationships';
export const INDEX_METADATA_NAME = 'nestjs-mongo:index';

export const DATA_LOADER_NAMESPACE = 'nestjs-mongo:ns_dataloader';
export const SESSION_LOADER_NAMESPACE = 'nestjs-mongo:ns_sessionloader';
export const MONGO_SESSION_KEY = 'ns_sessionloader:mongo_client_session';
