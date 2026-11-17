import { ConvertToHexAARRGGBB } from '../convert-color';

type Config = Record<string, any>;

const replacePrefix = (data: Config, index = 1): Config => {
  return Object.entries(data).reduce((result: Config, [key, value]) => {
    const parts = key.split('_');
    const prefixIndex = Math.min(index, parts.length - 1);
    result[parts.slice(prefixIndex).join('_')] = value;
    return result;
  }, {});
};

const pickConfig = (config: Config, keys: string[]): Config => {
  return keys.reduce((picked: Config, key: string) => {
    if (key in config) {
      picked[key] = config[key];
      delete config[key];
    }
    return picked;
  }, {});
};

const parseUdpPorts = (udpPorts: string | undefined): number[] | null => {
  if (!udpPorts) return null;
  return udpPorts.split(',').map((value) => parseInt(value, 10));
};

const parseAuthConfig = (config: Config): Config => {
  const auth = replacePrefix(pickConfig(config, ['auth_password', 'auth_username', 'auth_v2ray_uuid']));
  auth.username = auth.username || null;
  auth.password = auth.password || null;
  return auth;
};

const parseCommonConfig = (config: Config): void => {
  config.cdns = null;
  config.proxy = replacePrefix(pickConfig(config, ['proxy_host', 'proxy_port']));
  config.server = replacePrefix(pickConfig(config, ['server_host', 'server_port']));
  config.dns_server = replacePrefix(pickConfig(config, ['dns_server_dns1', 'dns_server_dns2']), 2);
  config.config_payload = replacePrefix(pickConfig(config, ['config_payload_payload', 'config_payload_sni']), 2);
  config.udp_ports = parseUdpPorts(config.udp_ports);
};

export function AppConfigParser(config: Config): Config {
  if (config.category) {
    config.category.color = ConvertToHexAARRGGBB(config.category.color);
  }

  config.auth = parseAuthConfig(config);
  parseCommonConfig(config);

  return config;
}

export function AppConfigParserApi(config: Config): Config {
  const dnsServers = [config.dns_server_dns1, config.dns_server_dns2].filter(
    (dns) => typeof dns === 'string' && dns.length > 0
  );
  const udpServers = typeof config.udp_ports === 'string'
    ? config.udp_ports.split(',').map((port: string) => port.trim()).filter(Boolean)
    : [];
  const tlsVersion = config.tls_version || (config.mode === 'SSH_HCR' ? 'NONE' : 'TLSv1.3');

  // DTunnelMod 4.5.7 reads profile metadata at the root and transport data
  // from vpnConfig. Keep this conversion limited to the mobile update API;
  // the panel's configs_list endpoint continues to use AppConfigParser.
  return {
    id: config.id,
    categoryId: config.category_id ?? 0,
    name: config.name,
    description: config.description ?? '',
    mode: config.mode,
    status: config.status === 'ACTIVE' ? 1 : 0,
    iconUrl: config.icon ?? '',
    isCustom: false,
    sorter: config.sorter ?? 0,
    requiresUsername: null,
    requiresPassword: null,
    requiresUuid: null,
    checkUserUrl: config.url_check_user ?? '',
    vpnConfig: {
      name: config.name,
      mode: config.mode,
      payload: config.config_payload_payload ?? '',
      sni: config.config_payload_sni ?? '',
      username: config.auth_username ?? '',
      password: config.auth_password ?? '',
      uuid: config.auth_v2ray_uuid ?? '',
      proxyHost: config.proxy_host ?? '',
      proxyPort: config.proxy_port ?? null,
      serverHost: config.server_host ?? '',
      serverPort: config.server_port ?? null,
      dnsServers,
      udpServers,
      tlsVersion,
      hyInsecure: config.hy_insecure ?? true,
      tunnelIpv6: false,
      socksliteAuth: true,
      dnsttKey: config.dnstt_key ?? '',
      dnsttNameServer: config.dnstt_name_server ?? '',
      dnsttServer: config.dnstt_server ?? '',
      dnsttType: 'UDP',
      dnsttResolvers: [],
      dnsttConcurrency: 4,
      sshAuthType: 'PASSWORD',
      sshKey: '',
      vtProtocol: 'TCP',
      vtPort: '22',
      xrayConfig: config.config_v2ray ?? '',
      bhttpConfig: undefined,
      xhttpConfig: undefined,
    },
  };
}
