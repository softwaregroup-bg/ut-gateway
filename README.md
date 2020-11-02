# API gateway

Reverse proxy to expose selected API paths

To be used instead of kubernetes ingress when deploying outside kubernetes.
In kubernetes it generates the appropriate ingress resources for
exposing the API.

## Usage

Require it in a layer and give it configuration namespace, as in this example:

```js
adminPortal: () => [
    require('ut-gateway')({namespace: 'adminApi'})
]
```

## Configuration

Use the namespace as a key to configure the exposed paths and ingress host name:

```js
adminApi: {
    host: 'admin.domain.local', // expose at specific host
    server: {
        port: 8004 // http server port
    },
    // Set to true to support calling a service in a different process,
    // when the layer is activated. Not needed in kubernetes or
    // when other reverse proxy is used.
    discover: true,
    api: [
        'login', // expose whole namespace
        {path: '/api', service: 'browser'}, // expose single path
        {path: '/api/{path*}', service: 'browser'} // expose path prefix
    ]
}
```

The above configuration will do the following:

1) Generate kubernetes ingress resources for the listed APIs.
1) Create reverse proxy listening on port `8004`, which exposed the listed APIs,
  if the `adminPortal` layer is activated. This layer only needs to be activated
  in cases where no other reverse proxy is used, i.e. it is not needed in
  kubernetes or when same kind of configuration can be applied to other reverse
  proxies like nginx, haproxy, etc. Activating this layer is mostly useful
  during development.

Generation of specific configuration for proxies like haproxy and nginx is
planned for future versions.
