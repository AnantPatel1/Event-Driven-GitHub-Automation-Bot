interface GitHubRepoApiItem {
  id: number;
  name: string;
  full_name: string;
  private: boolean;
  description: string | null;
  default_branch: string;
  owner: {
    login: string;
  };
  permissions?: {
    admin: boolean;
    push: boolean;
    pull: boolean;
  };
}

export class GitHubService {
  /**
   * Fetch repositories accessible by the user via GitHub REST API
   */
  static async getUserRepositories(
    accessToken: string,
    username: string
  ): Promise<GitHubRepoApiItem[]> {
    if (accessToken.startsWith('gho_mock_')) {
      return [
        {
          id: 101001,
          name: 'project-a',
          full_name: `${username}/project-a`,
          private: false,
          description: 'Production core microservice repository',
          default_branch: 'main',
          owner: { login: username },
          permissions: { admin: true, push: true, pull: true },
        },
        {
          id: 101002,
          name: 'project-b',
          full_name: `${username}/project-b`,
          private: true,
          description: 'Frontend client web application',
          default_branch: 'main',
          owner: { login: username },
          permissions: { admin: true, push: true, pull: true },
        },
        {
          id: 101003,
          name: 'automation-sandbox',
          full_name: `${username}/automation-sandbox`,
          private: false,
          description: 'Sandbox repository for testing GitHub bots & event triggers',
          default_branch: 'main',
          owner: { login: username },
          permissions: { admin: true, push: true, pull: true },
        },
      ];
    }

    const response = await fetch('https://api.github.com/user/repos?per_page=100&sort=updated', {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: 'application/vnd.github+json',
        'User-Agent': 'GitHub-Automation-Bot',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`GitHub API error (${response.status}): ${errorText}`);
    }

    return (await response.json()) as GitHubRepoApiItem[];
  }

  /**
   * Fetch a single repository and verify user has admin or push access
   */
  static async getAndVerifyRepository(
    accessToken: string,
    repoIdOrFullName: string,
    username: string
  ): Promise<GitHubRepoApiItem> {
    if (accessToken.startsWith('gho_mock_')) {
      const repos = await this.getUserRepositories(accessToken, username);
      const matched = repos.find(
        (r) => String(r.id) === repoIdOrFullName || r.full_name.toLowerCase() === repoIdOrFullName.toLowerCase()
      );
      if (!matched) {
        throw new Error('Repository not found or access denied in authenticated user scope.');
      }
      return matched;
    }

    const isNumericId = /^\d+$/.test(repoIdOrFullName);
    const endpoint = isNumericId
      ? `https://api.github.com/repositories/${repoIdOrFullName}`
      : `https://api.github.com/repos/${repoIdOrFullName}`;

    const response = await fetch(endpoint, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: 'application/vnd.github+json',
        'User-Agent': 'GitHub-Automation-Bot',
      },
    });

    if (response.status === 404) {
      throw new Error('Repository not found on GitHub or access token does not have permission.');
    }

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`GitHub API error (${response.status}): ${errorText}`);
    }

    const repo = (await response.json()) as GitHubRepoApiItem;

    if (repo.permissions && !repo.permissions.admin && !repo.permissions.push) {
      throw new Error('User does not have admin/push permissions to manage webhooks for this repository.');
    }

    return repo;
  }

  /**
   * Register a webhook on the GitHub repository
   */
  static async createWebhook(
    accessToken: string,
    owner: string,
    repo: string,
    webhookUrl: string,
    secret: string
  ): Promise<string> {
    if (accessToken.startsWith('gho_mock_')) {
      return `mock_wh_${Date.now()}`;
    }

    const response = await fetch(`https://api.github.com/repos/${owner}/${repo}/hooks`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: 'application/vnd.github+json',
        'Content-Type': 'application/json',
        'User-Agent': 'GitHub-Automation-Bot',
      },
      body: JSON.stringify({
        name: 'web',
        active: true,
        events: ['issues', 'pull_request'],
        config: {
          url: webhookUrl,
          content_type: 'json',
          secret: secret,
          insecure_ssl: '0',
        },
      }),
    });

    if (response.status === 422) {
      const listResponse = await fetch(`https://api.github.com/repos/${owner}/${repo}/hooks`, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: 'application/vnd.github+json',
          'User-Agent': 'GitHub-Automation-Bot',
        },
      });

      if (listResponse.ok) {
        const hooks = (await listResponse.json()) as Array<{ id: number; config?: { url?: string } }>;
        const existingHook = hooks.find((h) => h.config?.url === webhookUrl);
        if (existingHook) {
          return String(existingHook.id);
        }
      }
    }

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to create GitHub webhook (${response.status}): ${errorText}`);
    }

    const data = (await response.json()) as { id: number };
    return String(data.id);
  }

  /**
   * Delete a webhook from the GitHub repository
   */
  static async deleteWebhook(
    accessToken: string,
    owner: string,
    repo: string,
    webhookId: string
  ): Promise<void> {
    if (accessToken.startsWith('gho_mock_') || webhookId.startsWith('mock_wh_')) {
      return;
    }

    const response = await fetch(`https://api.github.com/repos/${owner}/${repo}/hooks/${webhookId}`, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: 'application/vnd.github+json',
        'User-Agent': 'GitHub-Automation-Bot',
      },
    });

    if (!response.ok && response.status !== 404) {
      const errorText = await response.text();
      throw new Error(`Failed to delete GitHub webhook (${response.status}): ${errorText}`);
    }
  }
}
