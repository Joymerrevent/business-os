// Conventional Commits を強制する（commit-msg フックと CI で検査）。
export default {
  extends: ["@commitlint/config-conventional"],
  // Dependabot は件名を "Bump …"（大文字始まり）で生成し subject-case に反する。
  // prefix は dependabot.yml の ci / chore(deps) / chore(deps-dev)。これらの自動 PR の件名だけ検査から除く。
  ignores: [(msg) => /^(ci|chore\(deps(-dev)?\)): Bump /.test(msg)],
};
