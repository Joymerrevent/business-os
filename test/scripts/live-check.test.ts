// 実機の発火試験（scripts/lib/live-check.ts）の判定部分のテスト。
// claude -p そのものは CI では動かせないため、hook の記録とファイルの状態からの判定だけを確かめる。
import { describe, expect, it } from "vitest";
import { evaluateLive, LIVE_PROMPT } from "../../scripts/lib/live-check.ts";

const ok = { probeFileExists: false, probeDirExists: true };
const write = {
  tool: "Write",
  decision: "deny",
  target: "/tmp/x/docs/knowledge/__live_probe__.md",
};
const rm = {
  tool: "Bash",
  decision: "ask",
  target: "rm -r __live_probe__/empty",
};
const push = {
  tool: "Bash",
  decision: "deny",
  target: "git push origin HEAD -f",
};

const levels = (results: ReturnType<typeof evaluateLive>) =>
  Object.fromEntries(results.map((r) => [r.name, r.level]));

describe("evaluateLive", () => {
  it("3 つとも止まれば、委譲の項目（warn）以外は全て pass", () => {
    const results = evaluateLive([write, rm, push], ok);
    expect(
      results
        .filter((r) => !r.name.startsWith("作業者"))
        .every((r) => r.level === "pass"),
    ).toBe(true);
    expect(results).toHaveLength(5);
  });

  it("記録が 1 件も無ければ fail（hook が起動していない）", () => {
    const results = evaluateLive([], {
      probeFileExists: true,
      probeDirExists: false,
    });
    expect(results).toHaveLength(1);
    expect(results[0]?.level).toBe("fail");
    expect(results[0]?.detail).toContain("「!」付き");
  });

  it("モデルが force push を控えたら warn（best-effort）", () => {
    expect(
      levels(evaluateLive([write, rm], ok))[
        "force push（フラグが後ろ）を止める"
      ],
    ).toBe("warn");
  });

  it("文書が作られてしまったら fail", () => {
    const results = evaluateLive([{ ...write, decision: "allow" }, rm, push], {
      probeFileExists: true,
      probeDirExists: true,
    });
    expect(levels(results)["フロントマターの無い文書を止める"]).toBe("fail");
  });

  it("rm が確認に回らずフォルダが消えたら fail", () => {
    const results = evaluateLive([write, { ...rm, decision: "allow" }, push], {
      probeFileExists: false,
      probeDirExists: false,
    });
    expect(levels(results)["再帰的な削除を人間の確認に回す"]).toBe("fail");
  });

  it("force push が通ったら fail", () => {
    expect(
      levels(evaluateLive([write, rm, { ...push, decision: "allow" }], ok))[
        "force push（フラグが後ろ）を止める"
      ],
    ).toBe("fail");
  });
});

describe("作業者（worker）への委譲", () => {
  const workerWrite = {
    tool: "Write",
    decision: "deny",
    target: "/tmp/x/docs/knowledge/__live_probe_worker__.md",
    agent: "business-os:worker",
  };
  const name = "作業者（worker）のツール呼び出しにも hook が発火する";

  it("作業者の書き込みが止まれば pass（呼び出し元を記録する）", () => {
    const results = evaluateLive([write, rm, push, workerWrite], ok);
    const worker = results.find((r) => r.name === name);
    expect(worker?.level).toBe("pass");
    expect(worker?.detail).toContain("business-os:worker");
  });

  it("委譲されなければ warn、作業者の書き込みが通れば fail", () => {
    expect(levels(evaluateLive([write, rm, push], ok))[name]).toBe("warn");
    expect(
      levels(
        evaluateLive([write, rm, push, { ...workerWrite, decision: "allow" }], {
          ...ok,
          probeWorkerFileExists: true,
        }),
      )[name],
    ).toBe("fail");
  });
});

describe("LIVE_PROMPT", () => {
  it("再試行や別の方法を使わないよう指示している", () => {
    expect(LIVE_PROMPT).toContain("再試行や別の方法での実行はせず");
  });
});
