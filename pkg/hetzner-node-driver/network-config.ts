const CIDR_PATTERN = /^\d{1,3}(\.\d{1,3}){3}\/\d{1,2}$/;

export interface NetworkValue {
  id: string;
  ipRange?: string;
}

export function parseNetworkValue(value: string): NetworkValue {
  const idx = value.lastIndexOf(':');
  if (idx > 0) {
    const ipRange = value.slice(idx + 1);
    if (CIDR_PATTERN.test(ipRange)) {
      return { id: value.slice(0, idx), ipRange };
    }
  }
  return { id: value };
}

export function formatNetworkValue(id: string, ipRange?: string): string {
  return ipRange ? `${id}:${ipRange}` : id;
}
