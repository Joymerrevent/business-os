// 重い点検（scripts/check.ts）のテスト。フィクスチャの複製に対して点検し、判定と終了コードを確かめる。
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  runCompanyChecks,
  skillUsage,
  type CheckOptions,
} from "../../scripts/lib/company-checks.ts";
import { makeCompany, repoRoot, setState } from "../helpers.ts";

const options: CheckOptions = {
  today: "2026-10-01",
  sandboxProbe: false,
  pluginValidate: false,
};

let root = "";
let cleanup = (): void => {};
beforeEach(() => ({ root, cleanup } = makeCompany()));
afterEach(() => cleanup());

const failsOf = (results: ReturnType<typeof runCompanyChecks>) =>
  results.filter((r) => r.level === "fail");

const runCli = (...args: string[]) =>
  spawnSync(
    process.execPath,
    [
      join(repoRoot, "scripts", "check.ts"),
      "--company",
      root,
      "--today",
      options.today,
      "--no-sandbox-probe",
      "--no-plugin-validate",
      ...args,
    ],
    { encoding: "utf8" },
  );

describe("フィクスチャ（導入直後の company）", () => {
  it("fail が無い", () => {
    expect(failsOf(runCompanyChecks(root, options))).toEqual([]);
  });

  it("防衛の発火を全て pass にする", () => {
    const firing = runCompanyChecks(root, options).filter(
      (r) =>
        r.category === "防衛の発火" &&
        r.name !== "sandbox が憲章への書き込みを止める",
    );
    expect(firing.length).toBeGreaterThanOrEqual(5);
    expect(firing.every((r) => r.level === "pass")).toBe(true);
  });

  it("CLI は終了コード 0 でレポートを書く", () => {
    const run = runCli();
    expect(run.status).toBe(0);
    const report = join(root, "docs/operations/reviews/check-20261001.md");
    expect(existsSync(report)).toBe(true);
    expect(readFileSync(report, "utf8")).toContain("type: review");
  });

  it("雛形の置き場（docs/_templates/）の置き換え記号は fail にしない", () => {
    mkdirSync(join(root, "docs/_templates"), { recursive: true });
    writeFileSync(
      join(root, "docs/_templates/daily-note.md"),
      "---\ntype: daily\ncreated: {{date:YYYY-MM-DD}}\n---\n[壊れたリンク](nowhere.md)\n",
    );
    expect(failsOf(runCompanyChecks(root, options))).toEqual([]);
  });

  it("点検が憲章やプローブのファイルを残さない", () => {
    runCli();
    expect(
      existsSync(join(root, "docs/charter/__business-os-check-probe__.md")),
    ).toBe(false);
    expect(
      existsSync(join(root, "docs/knowledge/__business-os-check-probe__.md")),
    ).toBe(false);
  });
});

describe("壊れた company", () => {
  it("フロントマターの欠落・updated < created・id の不一致を fail にする", () => {
    writeFileSync(join(root, "docs/operations/risks.md"), "# リスク\n");
    const state = join(root, "docs/operations/state/biz-a.md");
    writeFileSync(
      state,
      readFileSync(state, "utf8").replace(
        "updated: 2026-09-28",
        "updated: 2026-09-01",
      ),
    );
    const proposal = join(
      root,
      "docs/proposals/20260928-02-proposed-decision-rules.md",
    );
    writeFileSync(
      proposal,
      readFileSync(proposal, "utf8").replace(
        "id: 20260928-02",
        "id: 20260928-09",
      ),
    );
    const fails = failsOf(runCompanyChecks(root, options)).map((r) => r.name);
    expect(fails).toContain("docs/operations/risks.md");
    expect(fails).toContain("docs/operations/state/biz-a.md");
    expect(fails).toContain(
      "docs/proposals/20260928-02-proposed-decision-rules.md",
    );
    expect(runCli().status).toBe(1);
  });

  it("月次レビューの as_of が n/a なら fail", () => {
    mkdirSync(join(root, "docs/operations/reviews"), { recursive: true });
    writeFileSync(
      join(root, "docs/operations/reviews/monthly-2026-09.md"),
      "---\ntype: review\nbusiness: portfolio\nstatus: active\ncreated: 2026-10-01\nupdated: 2026-10-01\nas_of: n/a\nverified: n/a\n---\n",
    );
    expect(
      failsOf(runCompanyChecks(root, options)).map((r) => r.name),
    ).toContain("docs/operations/reviews/monthly-2026-09.md");
  });

  it("settings.json の必須規則の欠落を fail にする", () => {
    writeFileSync(join(root, ".claude/settings.json"), "{}");
    const fails = failsOf(runCompanyChecks(root, options));
    expect(fails.map((r) => r.category)).toContain("設定の一致");
  });

  it("settings.local.json による sandbox の上書きを fail にする", () => {
    writeFileSync(
      join(root, ".claude/settings.local.json"),
      JSON.stringify({ sandbox: { allowUnsandboxedCommands: true } }),
    );
    const fails = failsOf(runCompanyChecks(root, options));
    expect(fails.map((r) => r.detail).join("")).toContain(
      "settings.local.json",
    );
  });

  it("settings.local.json の広い緩めを warn にし、許したソケットを示す", () => {
    writeFileSync(
      join(root, ".claude/settings.local.json"),
      JSON.stringify({
        sandbox: {
          network: {
            allowAllUnixSockets: true,
            allowUnixSockets: ["~/agent.sock"],
          },
        },
      }),
    );
    const results = runCompanyChecks(root, options);
    expect(failsOf(results)).toEqual([]);
    const warned = results.find(
      (r) => r.name === "settings.local.json が sandbox を広く緩めていない",
    );
    expect(warned?.level).toBe("warn");
    const sockets = results.find(
      (r) => r.name === "sandbox の中から接続できる Unix ソケット",
    );
    expect(sockets?.detail).toBe("~/agent.sock");
  });

  it("MCP の確認の予備の規則の欠落を warn にする（fail にしない）", () => {
    const path = join(root, ".claude/settings.json");
    const settings = JSON.parse(readFileSync(path, "utf8")) as {
      permissions: { ask: string[] };
    };
    settings.permissions.ask = settings.permissions.ask.filter(
      (rule) => rule !== "mcp__*__forward*",
    );
    writeFileSync(path, JSON.stringify(settings));
    const results = runCompanyChecks(root, options);
    expect(failsOf(results)).toEqual([]);
    const warned = results.find(
      (r) =>
        r.name ===
        "settings.json が外部のツール（MCP）の確認の予備の規則を含む",
    );
    expect(warned?.level).toBe("warn");
    expect(warned?.detail).toContain("mcp__*__forward*");
  });

  it("リンク切れを fail にする", () => {
    const path = join(root, "docs/charter/company.md");
    writeFileSync(path, `${readFileSync(path, "utf8")}\n[無い](nowhere.md)\n`);
    expect(
      failsOf(runCompanyChecks(root, options)).map((r) => r.category),
    ).toContain("リンク");
  });

  it("壊れた .business-os.json を fail にする", () => {
    writeFileSync(join(root, ".business-os.json"), "{broken");
    expect(failsOf(runCompanyChecks(root, options))).toHaveLength(1);
  });

  it("初期化中は憲章への書き込みが ask になることを確かめる", () => {
    setState(root, "initializing");
    const firing = runCompanyChecks(root, options).filter(
      (r) => r.category === "防衛の発火",
    );
    expect(firing.filter((r) => r.level === "fail")).toEqual([]);
  });
});

describe("鮮度", () => {
  it("期限を超えた文書を warn にする", () => {
    const results = runCompanyChecks(root, { ...options, today: "2027-06-01" });
    const warns = results
      .filter((r) => r.category === "鮮度" && r.level === "warn")
      .map((r) => r.name);
    expect(warns).toContain("docs/charter/company.md");
    expect(warns).toContain("docs/operations/state/biz-a.md");
    expect(warns).toContain("docs/proposals/20260928-01-approving-company.md");
  });
});

describe("利用統計", () => {
  it("過去 7 日の日報の実行記録を数える", () => {
    mkdirSync(join(root, "docs/operations/daily"), { recursive: true });
    writeFileSync(
      join(root, "docs/operations/daily/2026-09-30.md"),
      "- 09:00 /morning — x\n- 10:00 /business-os:check — y\n",
    );
    writeFileSync(
      join(root, "docs/operations/daily/2026-09-01.md"),
      "- 09:00 /morning — 古い\n",
    );
    const usage = skillUsage(root, options);
    expect(usage.get("morning")).toBe(1);
    expect(usage.get("check")).toBe(1);
  });
});
