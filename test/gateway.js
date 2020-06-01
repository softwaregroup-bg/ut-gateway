module.exports = () => () => ({
    gateway: () => [
        require('../')({namespace: 'testApi'})
    ]
});
