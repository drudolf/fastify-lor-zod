// @ts-check

/** @param {string} commit @param {string} repo */
const commitLink = (commit, repo) => {
  const short = commit.slice(0, 7);
  return `[\`${short}\`](https://github.com/${repo}/commit/${short})`;
};

/** @type {import('@changesets/types').ChangelogFunctions} */
module.exports = {
  async getReleaseLine(changeset, _type, options) {
    const [firstLine, ...rest] = changeset.summary.split('\n').map((l) => l.trimEnd());

    const prefix =
      changeset.commit && options?.repo ? `${commitLink(changeset.commit, options.repo)} ` : '';

    let line = `- ${prefix}${firstLine}`;

    if (rest.length > 0) {
      line += `\n${rest.map((l) => `  ${l}`).join('\n')}`;
    }

    return line;
  },

  async getDependencyReleaseLine(changesets, dependenciesUpdated, options) {
    if (dependenciesUpdated.length === 0) return '';

    const links = changesets.map((changeset) => {
      const suffix =
        changeset.commit && options?.repo ? ` ${commitLink(changeset.commit, options.repo)}` : '';
      return `- Updated dependencies${suffix}`;
    });

    const deps = dependenciesUpdated.map((dep) => `  - ${dep.name}@${dep.newVersion}`);

    return [...links, ...deps].join('\n');
  },
};
