const Hapi = require('@hapi/hapi');
const H2o2 = require('@hapi/h2o2');
const scriptPort = require('ut-port-script');
const busApi = ['rpc', 'a', 'api'];
// const license = require('@feasibleone/aegis')(module);
module.exports = ({namespace, methods, params}) => ({
    [namespace]: class extends scriptPort(...params) {
        get defaults() {
            return {
                // namespace,
                type: 'gateway',
                server: {
                    port: 8080
                },
                capture: false,
                api: ['/rpc/{path*}'],
                proxy: {
                    passThrough: true,
                    xforward: true,
                    host: 'localhost',
                    port: 8090,
                    protocol: 'http'
                },
                discover: false
            };
        }

        async init() {
            function createAgent() {
                const tls = params[0]?.config?.utBus?.serviceBus?.jsonrpc?.client?.tls;
                if (!tls) return;
                const {Agent} = require('https');
                return new Agent(require('ut-bus/cert')({tls}));
            }
            const agent = createAgent();
            const result = await super.init(...arguments);
            this.httpServer = new Hapi.Server(this.config.server);
            if (this.config.capture) {
                await this.httpServer.register({
                    plugin: require('ut-function.capture-hapi'),
                    options: {name: this.config.id + '-receive', ...this.config.capture}
                });
            }
            await this.httpServer.register([{plugin: H2o2, options: {agent}}]);

            this.httpServer.ext('onPreResponse', (request, h) => {
                const response = request.response;
                if (response.isBoom) this.error(response);
                return h.continue;
            });

            const apiPath = api => {
                switch (typeof api) {
                    case 'string': {
                        const [root, type, service, ...rest] = api.split('/');
                        const last = rest[rest.length - 1];
                        if (last === '{path*}') rest.pop();
                        return busApi.includes(type) && service && {
                            serviceName: service + '-service',
                            path: [root, type, service, ...rest].join('/'),
                            pathType: last === '{path*}' ? 'Prefix' : 'Exact'
                        };
                    }
                    case 'object': {
                        const parts = api.path.split('/');
                        const last = parts[parts.length - 1];
                        if (last === '{path*}') parts.pop();
                        return api.service && {
                            serviceName: api.service + '-service',
                            path: parts.join('/'),
                            pathType: last === '{path*}' ? 'Prefix' : 'Exact'
                        };
                    }
                }
            };
            this.config.k8s = {
                ingresses: this.config.api.map(api => {
                    api = apiPath(api);
                    return api && {
                        name: namespace.toLowerCase(),
                        host: this.config.host || namespace.toLowerCase(),
                        servicePort: 'http-jsonrpc',
                        ...api
                    };
                }).filter(Boolean)
            };
            return result;
        }

        async start() {
            const result = await super.start(...arguments);
            // const stream = this.pull({exec: this.sendRequest}, {requests: {}});
            const {api, proxy, discover} = this.config;
            const bus = this.bus;
            const options = {
                auth: false,
                payload: {
                    maxBytes: 1024 * 1024 * 1024,
                    parse: false,
                    output: 'stream'
                },
                async handler(request, h) {
                    // license.active(namespace);
                    const [, root, service] = request.path.split('/', 3);
                    const appService = (request.route.settings.app && request.route.settings.app.service);
                    const {hostname, host = hostname, port, protocol} = (discover && (appService || busApi.includes(root)))
                        ? await bus.discoverService(appService || service)
                        : bus.info();
                    return h.proxy({
                        ...proxy,
                        ...host && {host},
                        ...port && {port},
                        ...protocol && {protocol}
                    });
                }
            };
            this.httpServer.route(api.map(path => ({
                method: '*',
                path: path.path || path,
                options: {
                    ...path.service && {
                        app: {
                            service: path.service
                        }
                    },
                    ...options
                }
            })));
            await this.httpServer.start();
            return result;
        }

        async stop() {
            if (this.httpServer) {
                await this.httpServer.stop();
                delete this.httpServer;
            }
            return super.stop(...arguments);
        }

        ready() {
            const {protocol, port} = this.httpServer.info;
            this.log?.info?.(`${protocol}://localhost:${port}/api`);
            return super.ready();
        }

        handlers() {
            return {
                [namespace + 'service.get']: () => params[0].utMethod.pkg,
                ...methods
            };
        }
    }
}[namespace]);
