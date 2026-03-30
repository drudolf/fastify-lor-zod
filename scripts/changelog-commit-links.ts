import type {
  ChangelogFunctions,
  ModCompWithPackage,
  NewChangesetWithCommit,
  VersionType,
} from '@changesets/types';

type Options = { repo: string };

const commitLink = (commit: string, repo: string) => {
  const short = commit.slice(0, 7);
  return `[\`${short}\`](https://github.com/${repo}/commit/${short})`;
};

const getReleaseLine = async (
  changeset: NewChangesetWithCommit,
  _type: VersionType,
  options: Options | null,
): Promise<string> => {
  const [firstLine, ...rest] = changeset.summary.split('\n').map((l) => l.trimEnd());

  const prefix =
    changeset.commit && options?.repo ? `${commitLink(changeset.commit, options.repo)} ` : '';

  let line = `- ${prefix}${firstLine}`;

  if (rest.length > 0) {
    line += `\n${rest.map((l) => `  ${l}`).join('\n')}`;
  }

  return line;
};

const getDependencyReleaseLine = async (
  changesets: NewChangesetWithCommit[],
  dependenciesUpdated: ModCompWithPackage[],
  options: Options | null,
): Promise<string> => {
  if (dependenciesUpdated.length === 0) return '';

  const links = changesets.map((changeset) => {
    const suffix =
      changeset.commit && options?.repo ? ` ${commitLink(changeset.commit, options.repo)}` : '';
    return `- Updated dependencies${suffix}`;
  });

  const deps = dependenciesUpdated.map((dep) => `  - ${dep.name}@${dep.newVersion}`);

  return [...links, ...deps].join('\n');
};

export default { getReleaseLine, getDependencyReleaseLine } satisfies ChangelogFunctions;
