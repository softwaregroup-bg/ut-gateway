const Hapi = require('@hapi/hapi');
const H2o2 = require('@hapi/h2o2');
const scriptPort = require('ut-port-script');

module.exports = function({namespace, methods}) {
    return (...params) => ({
        [namespace]: class extends scriptPort(...params) {
            get defaults() {
                return {
                    namespace,
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
                const result = await super.init(...arguments);
                this.httpServer = new Hapi.Server(this.config.server);
                if (this.config.capture) {
                    await this.httpServer.register({
                        plugin: require('ut-function.capture-hapi'),
                        options: {name: this.config.id + '-receive', ...this.config.capture}
                    });
                }
                await this.httpServer.register([H2o2]);
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
                        parse: false,
                        output: 'stream'
                    },
                    async handler(request, h) {
                        const [, root, service] = request.path.split('/', 3);
                        const {host, port, protocol} = root === 'rpc'
                            ? discover && await bus.discoverService(service)
                            : bus.info();
                        return h.proxy({
                            ...proxy,
                            ...host && {host},
                            ...port && {port},
                            ...protocol && {protocol}
                        });
                    }
                };
                this.httpServer.route(api.map(path => ({method: '*', path, options})));
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

            handlers() {
                return {
                    [namespace + 'service.get']: () => params[0].utMethod.pkg,
                    ...methods
                };
            }
        }
    }[namespace]);
};
