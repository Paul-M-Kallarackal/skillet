export interface PluginSkillDir {
  pluginName: string;
  version: string;
  parentDir: string;
}

/** An installed Claude Code plugin, enabled or not. */
export interface PluginInfo {
  /** Claude Code's id, `name@marketplace`. */
  key: string;
  name: string;
  marketplace: string;
  version: string;
  enabled: boolean;
  installPath: string;
  /** Skill folder names inside the plugin, so disabled plugins still list what they hold. */
  skillNames: string[];
}

/** A cached plugin version that no installed plugin points at any more. */
export interface StaleCache {
  path: string;
  plugin: string;
  marketplace: string;
  version: string;
  bytes: number;
}

export interface PluginDiscovery {
  dirs: PluginSkillDir[];
  plugins: PluginInfo[];
  staleCaches: StaleCache[];
}
