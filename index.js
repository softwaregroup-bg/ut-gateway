module.exports = ({namespace, methods}) => (...params) => require('./port')({namespace, methods, params});
