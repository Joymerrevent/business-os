// 報告の下書き（scripts/report.ts）のテスト。事業データが混ざったら下書きを作らず、
// 確かめた後に中身が変わったら送らないこと（安全側へ倒れること）を確かめる。
import { spawnSync } from "node:child_process";
import {
  existsSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { homedir, tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  buildBody,
  buildIssueUrl,
  differingKeys,
  findLeaks,
  parseDraft,
  replaceHome,
  sha256,
} from "../../scripts/lib/report.ts";
import { kindFromLine } from "../../scripts/lib/report-forms.ts";
import { makeCompany, repoRoot } from "../helpers.ts";

describe("下書きの部品", () => {
  it("本文は種類の行から始まり、フォームの順に見出しを並べ、空の項目を省く", () => {
    const body = buildBody({
      kind: "improvement",
      title: "題",
      fields: {
        proposal: "こうしたい",
        problem: "困っている",
        alternatives: "",
      },
    });
    const lines = body.split("\n");
    expect(kindFromLine(lines[0] ?? "")).toBe("improvement");
    expect(body.indexOf("### 困っていること")).toBeLessThan(
      body.indexOf("### 提案"),
    );
    expect(body).not.toContain("考えたほかの方法");
  });

  it("題と本文をファイルの形から読み戻せる", () => {
    expect(parseDraft("# 題：テスト\n\n本文\n")).toEqual({
      title: "テスト",
      body: "本文",
    });
    expect(parseDraft("題が無い\n")).toBeUndefined();
  });

  it("ホームのパスを ~ に置き換える", () => {
    expect(replaceHome("/Users/someone/work/x", "/Users/someone")).toBe(
      "~/work/x",
    );
  });

  it("事業データの型・辞書の語・利用者の名前を見つけ、語そのものは返さない", () => {
    const leaks = findLeaks(
      "連絡は a@example.co.jp へ\n事業 Sakura の件\nsomeone の作業場所",
      ["sakura"],
      "someone",
    );
    expect(leaks.map((l) => l.name)).toEqual([
      "メールアドレス",
      "固有名詞の辞書の語",
      "利用者の名前",
    ]);
    expect(JSON.stringify(leaks)).not.toContain("sakura");
  });

  it("許可しているドメインとメールアドレスは見つけない", () => {
    expect(
      findLeaks("https://github.com/x/y と noreply@anthropic.com", [], ""),
    ).toEqual([]);
  });

  it("URL には事前に入力できる項目だけを入れ、長すぎれば長い項目から外す", () => {
    const input = {
      kind: "skill-add" as const,
      title: "題",
      fields: {
        work: "短い",
        category: "共通業務 Skill",
        usage: "あ".repeat(200),
      },
    };
    const short = buildIssueUrl("o/r", input);
    expect(short.url).toContain("template=skill-add.yml");
    expect(short.url).not.toContain("category=");
    expect(short.omitted).toEqual(["category"]);
    const limited = buildIssueUrl("o/r", input, 500);
    expect(limited.omitted).toContain("usage");
    expect(Buffer.byteLength(limited.url, "utf8")).toBeLessThanOrEqual(500);
  });

  it("雛形と違う設定はキーの名前だけを返し、model は除く", () => {
    expect(
      differingKeys(
        { model: "opus", env: { A: "x" }, sandbox: { enabled: true } },
        {
          model: "{{ main_model }}",
          env: { A: "1" },
          sandbox: { enabled: true },
        },
      ),
    ).toEqual(["env.A"]);
  });
});

describe("node scripts/report.ts", () => {
  let company = "";
  let cleanup = (): void => {};
  let temp = "";

  const run = (args: string[], input = "") =>
    spawnSync(
      process.execPath,
      [join(repoRoot, "scripts", "report.ts"), ...args],
      {
        input,
        encoding: "utf8",
        // 一時フォルダは macOS / Linux では TMPDIR、Windows では TEMP / TMP で決まる
        env: { ...process.env, TMPDIR: temp, TEMP: temp, TMP: temp },
      },
    );
  const draft = (fields: Record<string, string>, kind = "improvement") =>
    run(
      ["draft", "--company", company],
      JSON.stringify({ kind, title: "報告の題", fields }),
    );
  const drafts = () =>
    readdirSync(temp).filter((f) => f.startsWith("business-os-report-"));

  beforeEach(() => {
    ({ root: company, cleanup } = makeCompany());
    temp = mkdtempSync(join(tmpdir(), "business-os-report-test-"));
    writeFileSync(
      join(company, ".leak-dict.json"),
      JSON.stringify({ terms: ["サクラ商店"] }),
    );
  });
  afterEach(() => {
    cleanup();
    rmSync(temp, { recursive: true, force: true });
  });

  it("下書きを一時フォルダに書き、ファイルの場所と要約値を返す", () => {
    const result = draft({ problem: "確認が多い", proposal: "減らしたい" });
    expect(result.status).toBe(0);
    const out = JSON.parse(result.stdout) as { file: string; sha256: string };
    expect(out.file.startsWith(temp)).toBe(true);
    expect(readFileSync(out.file, "utf8")).toContain("### 困っていること");
  });

  it("不具合の報告には環境の情報と設定の差（キーの名前だけ）を足す", () => {
    const result = draft(
      { what: "落ちた", expected: "動く", repro: "/morning" },
      "bug-report",
    );
    expect(result.status).toBe(0);
    const out = JSON.parse(result.stdout) as { file: string };
    const text = readFileSync(out.file, "utf8");
    expect(text).toContain("### business-os のバージョン");
    expect(text).toContain("### Node.js のバージョン");
    expect(text).toContain(process.version);
  });

  it("辞書の語が混ざっていれば下書きを作らない（終了コード 1）", () => {
    const result = draft({
      problem: "サクラ商店の請求で困った",
      proposal: "x",
    });
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("固有名詞の辞書の語");
    expect(result.stderr).not.toContain("サクラ商店");
    expect(drafts()).toEqual([]);
  });

  it("辞書が無ければ検査できないので下書きを作らない", () => {
    rmSync(join(company, ".leak-dict.json"));
    const result = draft({ problem: "x", proposal: "y" });
    expect(result.status).toBe(1);
    expect(drafts()).toEqual([]);
  });

  it("安全装置の不具合（防衛の発火）は非公開の経路を示して止める（終了コード 3）", () => {
    const result = draft(
      {
        what: "x",
        expected: "y",
        repro: "z",
        check: "[fail] 防衛の発火：hook",
      },
      "bug-report",
    );
    expect(result.status).toBe(3);
    expect(result.stderr).toContain("/security/advisories/new");
    expect(drafts()).toEqual([]);
  });

  it("ホームのパスは ~ に置き換えて書く", () => {
    const result = draft({ problem: `${homedir()}/x で失敗`, proposal: "y" });
    expect(result.status).toBe(0);
    const out = JSON.parse(result.stdout) as { file: string };
    expect(readFileSync(out.file, "utf8")).not.toContain(homedir());
  });

  it("確かめた中身のままなら、送る題・本文・URL を返す", () => {
    const out = JSON.parse(
      draft({ problem: "困った", proposal: "直したい" }).stdout,
    ) as { file: string; sha256: string };
    const result = run([
      "verify",
      "--company",
      company,
      "--file",
      out.file,
      "--sha256",
      out.sha256,
    ]);
    expect(result.status).toBe(0);
    const sent = JSON.parse(result.stdout) as {
      owner: string;
      repo: string;
      title: string;
      body: string;
      url: string;
    };
    expect(sent.title).toBe("報告の題");
    expect(sent.body.startsWith("報告の種類：改善の提案（improvement）")).toBe(
      true,
    );
    expect(sent.url).toContain("problem=");
    expect(`${sent.owner}/${sent.repo}`).toBe("Joymerrevent/business-os");
  });

  it("確かめた後に中身が変わっていれば送らない（終了コード 1）", () => {
    const out = JSON.parse(
      draft({ problem: "困った", proposal: "直したい" }).stdout,
    ) as { file: string; sha256: string };
    writeFileSync(out.file, `${readFileSync(out.file, "utf8")}\n追記`);
    const result = run([
      "verify",
      "--company",
      company,
      "--file",
      out.file,
      "--sha256",
      out.sha256,
    ]);
    expect(result.status).toBe(1);
    expect(result.stdout).toBe("");
  });

  it("人が直した下書きは inspect で検査し直し、新しい要約値で verify を通る", () => {
    const out = JSON.parse(
      draft({ problem: "困った", proposal: "直したい" }).stdout,
    ) as { file: string; sha256: string };
    writeFileSync(out.file, `${readFileSync(out.file, "utf8")}\n補足を書いた`);
    const inspected = run([
      "inspect",
      "--company",
      company,
      "--file",
      out.file,
    ]);
    expect(inspected.status).toBe(0);
    const again = JSON.parse(inspected.stdout) as { sha256: string };
    expect(again.sha256).not.toBe(out.sha256);
    const result = run([
      "verify",
      "--company",
      company,
      "--file",
      out.file,
      "--sha256",
      again.sha256,
    ]);
    expect(result.status).toBe(0);
  });

  it("人が直した下書きに辞書の語が入っていれば、inspect が止める", () => {
    const out = JSON.parse(
      draft({ problem: "困った", proposal: "直したい" }).stdout,
    ) as { file: string };
    writeFileSync(out.file, `${readFileSync(out.file, "utf8")}\nサクラ商店`);
    const result = run(["inspect", "--company", company, "--file", out.file]);
    expect(result.status).toBe(1);
    expect(result.stdout).toBe("");
  });

  it("人が直したファイルに辞書の語が入っていれば、要約値が合っても送らない", () => {
    const out = JSON.parse(
      draft({ problem: "困った", proposal: "直したい" }).stdout,
    ) as { file: string; sha256: string };
    const changed = `${readFileSync(out.file, "utf8")}\nサクラ商店`;
    writeFileSync(out.file, changed);
    const hash = sha256(changed);
    const result = run([
      "verify",
      "--company",
      company,
      "--file",
      out.file,
      "--sha256",
      hash,
    ]);
    expect(result.status).toBe(1);
    expect(existsSync(out.file)).toBe(true);
  });
});
