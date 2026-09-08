export interface PluginSkillDir {
  pluginName: string;
  version: string;
  parentDir: string;
}

export interface PluginDiscovery {
  dirs: PluginSkillDir[];
  staleVersions: number;
}
