export interface Repo {
  id: string;
  name: string;
  label: string;
  gitRoot: string;
  branch: string;
  isWorktree: boolean;
  mainCheckout: string;
  dirty: boolean;
  worktreeIds: string[];
}
