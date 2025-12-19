<script setup lang="ts">
import { computed, nextTick, onMounted, reactive, ref, watch } from 'vue';
import Loading from '@shell/components/Loading.vue';
import LabeledSelect from '@shell/components/form/LabeledSelect.vue';
import KeyValue from '@shell/components/form/KeyValue.vue';
import Checkbox from '@shell/rancher-components/Form/Checkbox/Checkbox.vue';
import YamlEditor from '@shell/components/YamlEditor.vue';
import { HetznerCloud, HetznerOption } from '../hcloud';

interface Props {
  uuid: string;
  cluster?: Object;
  value: any;
  credentialId: string;
  provider: string;
  disabled?: boolean;
  busy?: boolean;
}

interface ServerConfiguration {
  disablePublicNetwork?: boolean;
  disablePublicIpv4?: boolean;
  disablePublicIpv6?: boolean;
  usePrivateNetwork?: boolean;

  sshKeyId?: number;
  firewallIds?: number[];
  networkIds?: number[];
  placementGroupId?: number;

  serverImage?: number;
  serverType?: string;
  serverLocation?: string;

  additionalUserData?: string;

  serverLabels?: Record<string, string>;
}

interface HetznerOptions {
  locations: HetznerOption[];
  serverTypes: HetznerOption[];
  serverImages?: HetznerOption[];
  sshKeys?: HetznerOption[];
  firewalls?: HetznerOption[];
  networks?: HetznerOption[];
  placementGroups?: HetznerOption[];
}

const props = withDefaults(defineProps<Props>(), {
  cluster: () => ({}),
  disabled: false,
  busy: false,
});

const emit = defineEmits(['validationChanged']);

const hetznerOptions = ref<HetznerOptions>({
  locations: [],
  serverTypes: [],
  serverImages: [],
  sshKeys: [],
  firewalls: [],
  networks: [],
  placementGroups: [],
});

const serverConfiguration = reactive<ServerConfiguration>({
  disablePublicNetwork: false,
  disablePublicIpv4: false,
  disablePublicIpv6: false,
  usePrivateNetwork: false,
  sshKeyId: undefined,
  firewallIds: [],
  networkIds: [],
  placementGroupId: undefined,
  serverImage: undefined,
  serverType: undefined,
  serverLocation: undefined,
  additionalUserData: undefined,
  serverLabels: {},
});
const loadingData = ref<boolean>(true);
const initialLoad = ref<boolean>(true);
const hcloud = ref<HetznerCloud | null>(null);
const isValid = ref<boolean>(false);

const syncingToProps = ref<boolean>(false);
const syncingFromProps = ref<boolean>(false);

const isLoading = computed(() => loadingData.value || props.busy);

async function updateValue() {
  if (isValid.value) {
    // Apply values
    syncingToProps.value = true;
    props.value.serverType = serverConfiguration.serverType?.toString();
    props.value.serverLocation = serverConfiguration.serverLocation?.toString();
    props.value.imageId = serverConfiguration.serverImage?.toString();
    props.value.placementGroup =
      serverConfiguration.placementGroupId !== undefined &&
      serverConfiguration.placementGroupId !== null
        ? serverConfiguration.placementGroupId.toString()
        : undefined;

    props.value.networks =
      serverConfiguration.networkIds?.map((id) => id?.toString()) || [];
    props.value.firewalls =
      serverConfiguration.firewallIds?.map((id) => id?.toString()) || [];
    props.value.existingKeyId =
      serverConfiguration.sshKeyId !== undefined &&
      serverConfiguration.sshKeyId !== null
        ? serverConfiguration.sshKeyId.toString()
        : undefined;

    props.value.usePrivateNetwork = serverConfiguration.usePrivateNetwork;
    if (serverConfiguration.disablePublicNetwork) {
      props.value.disablePublic = true;
      props.value.disablePublicIpv4 = false;
      props.value.disablePublicIpv6 = false;
    } else {
      props.value.disablePublic = false;
      props.value.disablePublicIpv4 = serverConfiguration.disablePublicIpv4;
      props.value.disablePublicIpv6 = serverConfiguration.disablePublicIpv6;
    }

    props.value.additionalUserData = serverConfiguration.additionalUserData;
    props.value.userDataFromFile = true; // Always true, to activate loading Rancher-injected user data

    props.value.serverLabel = serverConfiguration.serverLabels
      ? Object.entries(serverConfiguration.serverLabels).map(
          ([key, value]) => `${key}=${value}`,
        )
      : [];

    await nextTick();
    syncingToProps.value = false;
  }
}

watch(
  () => props.value,
  async (newValue) => {
    if (syncingToProps.value) return;

    // Update local configuration from props value
    syncingFromProps.value = true;
    serverConfiguration.serverType =
      newValue.serverType !== undefined && newValue.serverType !== null
        ? newValue.serverType.toString()
        : undefined;

    serverConfiguration.serverLocation =
      newValue.serverLocation !== undefined && newValue.serverLocation !== null
        ? newValue.serverLocation.toString()
        : undefined;

    serverConfiguration.serverImage =
      newValue.imageId !== undefined && newValue.imageId !== null
        ? typeof newValue.imageId === 'string'
          ? Number(newValue.imageId)
          : newValue.imageId
        : undefined;

    serverConfiguration.placementGroupId =
      newValue.placementGroup !== undefined && newValue.placementGroup !== null
        ? typeof newValue.placementGroup === 'string'
          ? Number(newValue.placementGroup)
          : newValue.placementGroup
        : undefined;

    serverConfiguration.networkIds = Array.isArray(newValue.networks)
      ? newValue.networks.map((id: any) =>
          typeof id === 'string' ? Number(id) : id,
        )
      : [];

    serverConfiguration.firewallIds = Array.isArray(newValue.firewalls)
      ? newValue.firewalls.map((id: any) =>
          typeof id === 'string' ? Number(id) : id,
        )
      : [];
    serverConfiguration.sshKeyId =
      newValue.existingKeyId !== undefined && newValue.existingKeyId !== null
        ? Number(newValue.existingKeyId)
        : undefined;

    serverConfiguration.usePrivateNetwork = newValue.usePrivateNetwork;
    serverConfiguration.disablePublicNetwork = newValue.disablePublic;
    serverConfiguration.disablePublicIpv4 = newValue.disablePublicIpv4;
    serverConfiguration.disablePublicIpv6 = newValue.disablePublicIpv6;

    serverConfiguration.additionalUserData = newValue.additionalUserData || '';
    serverConfiguration.serverLabels = Object.fromEntries(
      (newValue.serverLabel || []).map((label: string) => label.split('=')),
    );

    await nextTick();
    syncingFromProps.value = false;
  },
  { immediate: true, deep: true },
);

watch(
  serverConfiguration,
  async (newValue) => {
    let valid = true;
    if (
      !newValue.serverImage ||
      !newValue.serverType ||
      !newValue.serverLocation
    ) {
      valid = false;
    }
    if (
      (newValue.disablePublicNetwork ||
        newValue.disablePublicIpv4 ||
        newValue.disablePublicIpv6) &&
      !newValue.usePrivateNetwork
    ) {
      valid = false;
    }
    if (newValue.usePrivateNetwork && !newValue.networkIds?.length) {
      valid = false;
    }
    isValid.value = valid;
    emit('validationChanged', valid);
    if (valid && !syncingFromProps.value) {
      await updateValue();
    }
  },
  { immediate: true, deep: true },
);

watch(
  () => serverConfiguration.serverLocation,
  async (newLocation) => {
    if (hcloud.value) {
      loadingData.value = true;
      try {
        hetznerOptions.value.serverTypes = await hcloud.value.getServerTypes(
          newLocation,
        );

        if (
          !hetznerOptions.value.serverTypes.some(
            (type) => type.value === serverConfiguration.serverType,
          )
        ) {
          serverConfiguration.serverType = undefined;
        }
      } catch (error: any) {
        (window as any).app?.$store?.dispatch('growl/error', {
          title: 'Error',
          message: 'Failed to load server types for selected location',
          timeout: 3000,
        });
      } finally {
        loadingData.value = false;
      }
    }
  },
);

onMounted(async () => {
  if (!props.credentialId) {
    loadingData.value = false;
    initialLoad.value = false;
    return;
  }

  hcloud.value = new HetznerCloud(props.credentialId);

  try {
    const [
      locations,
      serverTypes,
      serverImages,
      placementGroups,
      networks,
      sshKeys,
      firewalls,
    ] = await Promise.all([
      hcloud.value.getLocations(),
      hcloud.value.getServerTypes(),
      hcloud.value.getImages(),
      hcloud.value.getPlacementGroups(),
      hcloud.value.getNetworks(),
      hcloud.value.getSshKeys(),
      hcloud.value.getFirewalls(),
    ]);

    hetznerOptions.value.locations = locations;
    hetznerOptions.value.serverTypes = serverTypes;
    hetznerOptions.value.serverImages = serverImages;
    hetznerOptions.value.placementGroups = placementGroups;
    hetznerOptions.value.networks = networks;
    hetznerOptions.value.sshKeys = sshKeys;
    hetznerOptions.value.firewalls = firewalls;

    if (locations.length === 0) {
      (window as any).app.$store.dispatch('growl/warning', {
        title: 'Warning',
        message:
          'Unable to load Hetzner locations. Please check your API credentials.',
        timeout: 5000,
      });
    }
  } catch (error: any) {
    (window as any).app.$store.dispatch('growl/error', {
      title: 'Error',
      message: error.message || 'Failed to load Hetzner resources',
      timeout: 5000,
    });

    hetznerOptions.value.locations = [];
    hetznerOptions.value.serverTypes = [];
    hetznerOptions.value.serverImages = [];
  }

  loadingData.value = false;
  initialLoad.value = false;
});
</script>

<script lang="ts">
import CreateEditView from '@shell/mixins/create-edit-view';
import { defineComponent } from 'vue';

export default defineComponent({
  mixins: [CreateEditView],
  methods: {
    showError(message: string) {
      this.$store.dispatch('growl/error', {
        title: 'Error',
        message,
        timeout: 5000,
      });
    },
    showSuccess(message: string) {
      this.$store.dispatch('growl/success', {
        title: 'Success',
        message,
        timeout: 3000,
      });
    },
  },
});
</script>

<template>
  <div>
    <Loading v-if="initialLoad" :delayed="true" />
    <div class="hetzner-config">
      <h2 class="mt-20 mb-20">
        {{ t('driver.hetzner.machine.server.title') }}
      </h2>
      <div class="row mt-10">
        <div class="col span-12">
          <LabeledSelect
            v-model:value="serverConfiguration.serverLocation"
            :options="hetznerOptions.locations"
            required
            :disabled="isLoading"
            :loading="isLoading"
            :placeholder="
              t('driver.hetzner.machine.server.location.placeholder')
            "
            :label="t('driver.hetzner.machine.server.location.label')"
          />
        </div>
      </div>
      <div class="row mt-10">
        <div class="col span-6">
          <LabeledSelect
            v-model:value="serverConfiguration.serverType"
            :options="hetznerOptions.serverTypes"
            required
            :disabled="isLoading"
            :loading="isLoading"
            :placeholder="t('driver.hetzner.machine.server.type.placeholder')"
            :label="t('driver.hetzner.machine.server.type.label')"
          />
        </div>
        <div class="col span-6">
          <LabeledSelect
            v-model:value="serverConfiguration.serverImage"
            :options="hetznerOptions.serverImages"
            required
            :disabled="isLoading"
            :loading="isLoading"
            :placeholder="t('driver.hetzner.machine.server.image.placeholder')"
            :label="t('driver.hetzner.machine.server.image.label')"
          />
        </div>
      </div>
      <div class="row mt-10">
        <div class="col span-12">
          <LabeledSelect
            v-model:value="serverConfiguration.placementGroupId"
            :options="hetznerOptions.placementGroups"
            clearable
            :disabled="isLoading"
            :loading="isLoading"
            :placeholder="
              t('driver.hetzner.machine.server.placementGroup.placeholder')
            "
            :label="t('driver.hetzner.machine.server.placementGroup.label')"
          />
        </div>
      </div>
      <h2 class="mt-30 mb-20">
        {{ t('driver.hetzner.machine.network.title') }}
      </h2>
      <div class="row mt-10 vcenter">
        <div class="col span-6">
          <LabeledSelect
            v-model:value="serverConfiguration.networkIds"
            :options="hetznerOptions.networks"
            multiple
            :disabled="isLoading"
            :loading="isLoading"
            :placeholder="
              t('driver.hetzner.machine.network.networks.placeholder')
            "
            :label="t('driver.hetzner.machine.network.networks.label')"
          />
        </div>
        <div class="col span-6">
          <Checkbox
            v-model:value="serverConfiguration.usePrivateNetwork"
            :disabled="isLoading"
            :label="t('driver.hetzner.machine.network.private.label')"
            :description="
              t('driver.hetzner.machine.network.private.description')
            "
          />
        </div>
      </div>
      <div class="row mt-20">
        <div class="col span-4">
          <Checkbox
            v-model:value="serverConfiguration.disablePublicNetwork"
            :disabled="isLoading || !serverConfiguration.networkIds?.length"
            :label="t('driver.hetzner.machine.network.disablePublic.label')"
            :description="
              t('driver.hetzner.machine.network.disablePublic.description')
            "
          />
        </div>
        <div class="col span-4">
          <Checkbox
            v-model:value="serverConfiguration.disablePublicIpv4"
            :disabled="isLoading || serverConfiguration.disablePublicNetwork"
            :label="t('driver.hetzner.machine.network.disableIPv4.label')"
            :description="
              t('driver.hetzner.machine.network.disableIPv4.description')
            "
          />
        </div>
        <div class="col span-4">
          <Checkbox
            v-model:value="serverConfiguration.disablePublicIpv6"
            :disabled="isLoading || serverConfiguration.disablePublicNetwork"
            :label="t('driver.hetzner.machine.network.disableIPv6.label')"
            :description="
              t('driver.hetzner.machine.network.disableIPv6.description')
            "
          />
        </div>
      </div>
      <div class="row mt-20 vcenter">
        <div class="col span-6">
          <LabeledSelect
            v-model:value="serverConfiguration.firewallIds"
            :options="hetznerOptions.firewalls"
            multiple
            :disabled="isLoading"
            :loading="isLoading"
            :placeholder="
              t('driver.hetzner.machine.network.firewalls.placeholder')
            "
            :label="t('driver.hetzner.machine.network.firewalls.label')"
          />
        </div>
        <div class="col span-6">
          <LabeledSelect
            v-model:value="serverConfiguration.sshKeyId"
            :options="hetznerOptions.sshKeys"
            clearable
            :disabled="isLoading"
            :loading="isLoading"
            :placeholder="
              t('driver.hetzner.machine.network.sshKey.placeholder')
            "
            :label="t('driver.hetzner.machine.network.sshKey.label')"
          />
        </div>
      </div>
      <h2 class="mt-30 mb-20">
        {{ t('driver.hetzner.machine.additionalConfig.title') }}
      </h2>
      <div class="row mt-10">
        <div class="col span-12">
          <h3 class="mb-5">
            {{ t('driver.hetzner.machine.additionalConfig.userData.label') }}
          </h3>
          <div class="description mb-10">
            {{
              t('driver.hetzner.machine.additionalConfig.userData.description')
            }}
          </div>
          <YamlEditor
            v-model:value="serverConfiguration.additionalUserData"
            :disabled="isLoading"
            :placeholder="
              t('driver.hetzner.machine.additionalConfig.userData.placeholder')
            "
            :label="t('driver.hetzner.machine.additionalConfig.userData.label')"
            :showCodeEditor="true"
            :scrolling="true"
          />
        </div>
      </div>
      <div class="row mt-10">
        <div class="col span-12">
          <KeyValue
            v-model:value="serverConfiguration.serverLabels"
            :valueCanBeEmpty="true"
            :disabled="isLoading"
            :loading="isLoading"
            :title="t('driver.hetzner.machine.additionalConfig.labels.label')"
            :three-columns="false"
            :titleProtip="
              t('driver.hetzner.machine.additionalConfig.labels.description')
            "
          />
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
.hetzner-config {
  .row.vcenter {
    align-items: center;
  }

  .description {
    font-size: 0.9rem;
    color: var(--input-label);
  }

  // Checkbox grid styles
  .location-checkbox-group,
  .type-checkbox-group {
    .text-label {
      display: block;
      margin-bottom: 10px;
      color: var(--input-label);
      font-weight: 500;
    }

    .location-zones-container {
      border: 1px solid var(--border);
      border-radius: 4px;
      background: var(--body-bg);
      padding: 10px;
      max-height: 500px;
      overflow-y: auto;
    }

    .location-zone {
      margin-bottom: 20px;

      &:last-child {
        margin-bottom: 0;
      }

      .zone-label {
        font-size: 1rem;
        font-weight: 600;
        color: var(--primary);
        margin-bottom: 10px;
        padding: 5px 10px;
        background: var(--sortable-table-top-divider);
        border-radius: 4px;
      }
    }

    .checkbox-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
      gap: 10px;
      padding: 10px;
    }

    .checkbox-grid-scrollable {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
      gap: 10px;
      padding: 15px;
      border: 1px solid var(--border);
      border-radius: 4px;
      background: var(--body-bg);
      max-height: 300px;
      overflow-y: auto;
    }

    .location-checkbox-item,
    .type-checkbox-item {
      .checkbox-label {
        display: flex;
        align-items: center;
        cursor: pointer;
        padding: 10px;
        border: 2px solid var(--border);
        border-radius: 6px;
        transition: all 0.2s ease;
        background: var(--body-bg);

        &:hover {
          background: var(--sortable-table-hover-bg);
          border-color: var(--primary);
          transform: translateY(-2px);
          box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
        }

        &.selected {
          background: var(--primary-light-bg, var(--sortable-table-hover-bg));
          border-color: var(--primary);
          box-shadow: 0 0 0 1px var(--primary);
        }

        input[type='radio'] {
          margin-right: 10px;
          cursor: pointer;
          flex-shrink: 0;
        }

        .location-info {
          display: flex;
          flex-direction: column;
          gap: 2px;

          .location-code {
            font-weight: 600;
            font-size: 1rem;
            color: var(--body-text);
          }

          .location-city {
            font-size: 0.9rem;
            color: var(--body-text);
          }

          .location-country {
            font-size: 0.85rem;
            color: var(--input-label);
          }
        }

        .checkbox-text {
          font-size: 0.95rem;
          color: var(--body-text);
        }
      }
    }

    .error-text {
      color: var(--error);
      font-size: 0.85rem;
    }
  }
}
</style>
