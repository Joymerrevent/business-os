// lint-staged の設定。lint-staged は絶対パスを渡すため、markdownlint-cli2 の ignores（相対 glob）が
// 効かない。changesets のファイルはここで明示的に外す。
const quote = (file) => JSON.stringify(file);
const isChangeset = (file) =>
  file.includes("/.changeset/") || file.startsWith(".changeset/");

export default {
  "*.{ts,mts,cts,js,mjs,cjs}": ["eslint --fix", "prettier --write"],
  "*.{json,jsonc,yml,yaml}": ["prettier --write"],
  "*.md": (files) => {
    const lintable = files.filter((file) => !isChangeset(file));
    return lintable.length > 0
      ? [`markdownlint-cli2 --fix ${lintable.map(quote).join(" ")}`]
      : [];
  },
};
