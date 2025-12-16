export interface HetznerOption {
  label: string;
  value: string | number;
  city?: string;
  country?: string;
  networkZone?: string;
  disabled?: boolean;
  kind?: string;
}

export class HetznerCloud {
  private credentialId: string;

  private readonly BASE_URL = '/meta/proxy/api.hetzner.cloud/v1';

  constructor(credentialId: string) {
    this.credentialId = credentialId;
  }

  public async getLocations(): Promise<HetznerOption[]> {
    try {
      const response = await this.request('/locations');

      if (!response?.locations || !Array.isArray(response.locations)) {
        return [];
      }

      interface LocationResponse {
        name: string;
        city: string;
        country: string;
        network_zone: string;
      }

      const locations = response.locations
        .sort((a: LocationResponse, b: LocationResponse) => {
          if (a.network_zone !== b.network_zone) {
            return a.network_zone.localeCompare(b.network_zone);
          }
          return a.name.localeCompare(b.name);
        })
        .map((location: LocationResponse) => {
          const countryName = this.getCountryName(location.country);
          return {
            value: location.name,
            label: `${location.name.toUpperCase()} - ${
              location.city
            }, ${countryName}`,
            city: location.city,
            country: countryName,
            networkZone: location.network_zone,
          };
        });

      return locations;
    } catch (error) {
      return [];
    }
  }

  private getCountryName(countryCode: string): string {
    const countries: { [key: string]: string } = {
      DE: 'Germany',
      FI: 'Finland',
      US: 'USA',
      SG: 'Singapore',
      AU: 'Australia',
    };
    return countries[countryCode] || countryCode;
  }

  public async getServerTypes(location?: string): Promise<HetznerOption[]> {
    try {
      const response = await this.request('/server_types');

      if (!response?.server_types || !Array.isArray(response.server_types)) {
        return [];
      }

      interface ServerTypeResponse {
        name: string;
        deprecated: boolean;
        architecture: string;
        cores: number;
        memory: number;
        disk: number;
        cpu_type: 'shared' | 'dedicated';
        prices: Array<{
          location: string;
          price_monthly: {
            gross: string;
          };
        }>;
      }

      let serverTypes = response.server_types.filter(
        (type: ServerTypeResponse) => !type.deprecated,
      );

      if (location) {
        serverTypes = serverTypes.filter((type: ServerTypeResponse) =>
          type.prices.some((price) => price.location === location),
        );
      }

      // Group by CPU type and sort
      const sharedTypes = serverTypes
        .filter((type: ServerTypeResponse) => type.cpu_type === 'shared')
        .sort((a: ServerTypeResponse, b: ServerTypeResponse) =>
          a.name.localeCompare(b.name),
        );

      const dedicatedTypes = serverTypes
        .filter((type: ServerTypeResponse) => type.cpu_type === 'dedicated')
        .sort((a: ServerTypeResponse, b: ServerTypeResponse) =>
          a.name.localeCompare(b.name),
        );

      const formatServerType = (type: ServerTypeResponse): HetznerOption => {
        let priceLabel = '';
        if (location) {
          const price = type.prices.find((p) => p.location === location);
          if (price) {
            priceLabel = `€${Number(price.price_monthly.gross).toFixed(
              2,
            )}/mo, `;
          }
        }
        return {
          value: type.name,
          label: `${type.name} (${priceLabel}${type.architecture}, ${type.cores} vCPU, ${type.memory} GB RAM, ${type.disk} GB SSD)`,
        };
      };

      const result: HetznerOption[] = [];

      // Add dedicated servers group
      if (dedicatedTypes.length > 0) {
        result.push({
          label: '━━━ DEDICATED CPU SERVERS ━━━',
          value: 'dedicated-header',
          disabled: true,
          kind: 'group',
        });
        result.push(...dedicatedTypes.map(formatServerType));
      }

      // Add shared servers group
      if (sharedTypes.length > 0) {
        if (dedicatedTypes.length > 0) {
          result.push({
            label: '━━━ SHARED CPU SERVERS ━━━',
            value: 'shared-header',
            disabled: true,
            kind: 'group',
          });
        }
        result.push(...sharedTypes.map(formatServerType));
      }

      return result;
    } catch (error) {
      return [];
    }
  }

  public async getImages(): Promise<HetznerOption[]> {
    try {
      const response = await this.request('/images');

      if (!response?.images || !Array.isArray(response.images)) {
        return [];
      }

      interface ImageResponse {
        id: number;
        name: string;
        architecture: string;
        description: string;
      }

      return response.images
        .sort((a: ImageResponse, b: ImageResponse) =>
          a.name.localeCompare(b.name),
        )
        .map((image: ImageResponse) => ({
          value: image.id,
          label: `${image.name} (${image.architecture}) - ${image.description}`,
        }));
    } catch (error) {
      return [];
    }
  }

  public async getPlacementGroups(): Promise<HetznerOption[]> {
    try {
      const response = await this.request('/placement_groups');

      if (
        !response?.placement_groups ||
        !Array.isArray(response.placement_groups)
      ) {
        return [];
      }

      interface PlacementGroupResponse {
        id: number;
        name: string;
      }

      return response.placement_groups.map((pg: PlacementGroupResponse) => ({
        value: pg.id,
        label: pg.name,
      }));
    } catch (error) {
      return [];
    }
  }

  public async getNetworks(): Promise<HetznerOption[]> {
    try {
      const response = await this.request('/networks');

      if (!response?.networks || !Array.isArray(response.networks)) {
        return [];
      }

      interface NetworkResponse {
        id: number;
        name: string;
        ip_range: string;
      }

      return response.networks.map((network: NetworkResponse) => ({
        value: network.id,
        label: `${network.name} (${network.ip_range})`,
      }));
    } catch (error) {
      return [];
    }
  }

  public async getFirewalls(): Promise<HetznerOption[]> {
    try {
      const response = await this.request('/firewalls');

      if (!response?.firewalls || !Array.isArray(response.firewalls)) {
        return [];
      }

      interface FirewallResponse {
        id: number;
        name: string;
      }

      return response.firewalls.map((firewall: FirewallResponse) => ({
        value: firewall.id,
        label: firewall.name,
      }));
    } catch (error) {
      return [];
    }
  }

  public async getSshKeys(): Promise<HetznerOption[]> {
    try {
      const response = await this.request('/ssh_keys');

      if (!response?.ssh_keys || !Array.isArray(response.ssh_keys)) {
        return [];
      }

      interface SshKeyResponse {
        id: number;
        name: string;
      }

      return response.ssh_keys.map((key: SshKeyResponse) => ({
        value: key.id,
        label: key.name,
      }));
    } catch (error) {
      return [];
    }
  }

  private async request(
    endpoint: string,
    method: string = 'GET',
    body?: any,
  ): Promise<any> {
    const url = `${this.BASE_URL}${endpoint}`;

    const headers: HeadersInit = {
      'X-Api-CattleAuth-Header': `Bearer credID=${this.credentialId} passwordField=apiToken`,
      Accept: 'application/json',
    };

    if (body) {
      headers['Content-Type'] = 'application/json';
    }

    try {
      const response = await fetch(url, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
      });

      if (!response.ok) {
        const errorText = await response.text();

        if (response.status === 401) {
          throw new Error(
            'Authentication failed. Please check your Hetzner Cloud API token.',
          );
        }

        throw new Error(
          `HTTP error! status: ${response.status}, message: ${errorText}`,
        );
      }

      const data = await response.json();
      return data;
    } catch (error) {
      throw error;
    }
  }
}
