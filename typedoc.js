module.exports = {
    out: 'docs',
    exclude: ['**/test/**/*'],
    theme: 'default',
    name: 'NestJS Mongo',
    readme: 'README.md',
    excludePrivate: true,
    hideGenerator: true,
    entryPoints: ['src/index.ts'],
    navigationLinks: {
        GitHub: 'https://github.com/Pop-Code/nestjs-mongo',
        npm: 'https://www.npmjs.com/package/nestjs-mongo'
    },
    externalSymbolLinkMappings: {
        '@types/node': { '"node:tls".connect': 'https://nodejs.org/api/tls.html#tlsconnectoptions-callback' }
    },
    includeVersion: true
};
