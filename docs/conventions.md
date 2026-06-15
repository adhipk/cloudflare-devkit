# Conventions

## Project names

Use lowercase kebab-case:

```txt
personal-site
notes-api
image-proxy
```

The project name becomes the default Worker name.

## Recipe shape

Every recipe should be independently runnable after scaffolding:

```txt
package.json
wrangler.jsonc
src/ or public/
```

## App vs infra

Use Wrangler inside each app for:

```txt
code deploys
bindings
routes
local dev
```

Use OpenTofu later for shared/account resources:

```txt
domains
DNS records
R2 buckets
D1 databases
KV namespaces
queues
```

## Generated projects

By default, generated projects are written to:

```txt
projects/<project-name>
```

`projects/` is gitignored so experiments do not pollute the devkit repo.
