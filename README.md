# Rancher Node Driver UI extension for Hetzner Cloud

This project implements a custom node driver UI extension for Rancher, enabling users to provision and manage nodes in Hetzner Cloud using the new v3 extension API.

It is building upon the great work of [mxschmitt](https://github.com/mxschmitt/ui-driver-hetzner) and [JonasProgrammer](https://github.com/JonasProgrammer/docker-machine-driver-hetzner). It is meant to be used together with a custom fork of JonasProgrammer's Docker-machine-driver, introducing some Rancher-specific adjustments, found in this repository: https://github.com/bluquist/docker-machine-driver-hetzner

## Features
- Seamless integration with Rancher for creating and managing Hetzner Cloud nodes
- Full compatibility with RKE2 clusters
- Dynamic selection of server location, type, image, placement group, networks, firewalls, and SSH keys
- Support for private networking
- Vue 3 UI with Rancher look and feel

## Usage

### Add node driver
First, create the Hetzner node driver in Rancher, by applying this YAML configuration:

```yaml
apiVersion: management.cattle.io/v3
kind: NodeDriver
metadata:
  annotations:
    lifecycle.cattle.io/create.node-driver-controller: "true"
    privateCredentialFields: apiToken
  name: hetzner
spec:
  active: true
  addCloudCredential: true
  builtin: false
  checksum: "104dfdf16ec82d6e6b28c715d396f611578c29ddb8b37f0ff719d1867beb0a53"
  description: ""
  displayName: Hetzner
  externalId: ""
  url: https://github.com/bluquist/docker-machine-driver-hetzner/releases/download/v5.1.0/docker-machine-driver-hetzner_5.1.0_linux_amd64.tar.gz
  whitelistDomains:
  - api.hetzner.cloud
```

**Do not** add the node driver via the Rancher UI. Otherwise the credential annotation is missing, and you will not be able to create cloud credentials for Hetzner.

### Install the extension
In Rancher, navigate to `Extensions`, open the three-dot context menu and select "Manage repositories". Add a new HTTPS-repository pointing to `https://bluquist.github.io/rancher-node-driver-hetzner/`.

Navigate to `Extensions` again and install the "Hetzner Node Driver" extension that should now be available.

### Add a cloud credential
In Rancher, navigate to `Cluster Management` → `Cloud Credentials`. Create a new cloud credential for Hetzner. Add a read-write API token to the Hetzner project you want to create your cluster in. See the [Hetzner documentation](https://docs.hetzner.com/cloud/api/getting-started/generating-api-token/) for details on how to create API tokens.

### Create a cluster
You should now be able to create a new cluster using the Hetzner driver. If you want to use private networks for communication, make sure that Rancher can reach the private Hetzner network.

Optionally, a subnet can be selected for each network so that nodes get their private IP from a specific IP range. This requires a docker-machine-driver-hetzner build that supports the `<network>:<ip-range>` syntax for `--hetzner-networks` (see https://github.com/JonasProgrammer/docker-machine-driver-hetzner/pull/131). Without a subnet selection, the configuration sent to the driver is unchanged and works with older driver versions.

## Development

See the Rancher extension documentation for details on the development: https://extensions.rancher.io/extensions/next/introduction


### Run in development mode
This will load the extension into an existing Rancher installation for development purposes, including hot-reloading support.

```bash
API=<URL_TO_RANCHER> yarn dev
```

### Build for production
```bash
yarn build-pkg hetzner-node-driver
```

The built extension will be available in `dist-pkg/`.

### Customization
- Edit `pkg/hetzner-node-driver/machine-config/hetzner.vue` to change the UI or logic.
- Update `pkg/hetzner-node-driver/hcloud.ts` for API changes or enhancements.
- Add translations in `pkg/hetzner-node-driver/l10n/`.

## References
- [Rancher extension documentation](https://extensions.rancher.io/extensions/next/introduction)
- [Hetzner Cloud API](https://docs.hetzner.cloud)
