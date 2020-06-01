module.exports = {
    implementation: 'gateway',
    gateway: true,
    utLog: {
        streams: {
            sentry: {
                level: 'error',
                stream: '../sentryNodeStream',
                streamConfig: {
                    dsn: 'http://896a3873c7be4e9e8751e9dfff00442a@sentry.k8s.softwaregroup-bg.com/13',
                    patchGlobal: false,
                    logger: 'ut-gateway'
                },
                type: 'raw'
            }
        }
    }
};
