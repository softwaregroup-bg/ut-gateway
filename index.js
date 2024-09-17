module.exports = ({namespace, methods, licenseFeature}) => (...params) => require('./port')({namespace, methods, params, licenseFeature});
