// 自作のスキーマ解釈器（hooks/lib/schema.ts）が、ajv と同じ結論を出すことを確かめる。
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { Ajv2020 } from "ajv/dist/2020.js";
import { describe, expect, it } from "vitest";
import { parse } from "yaml";
import { parseFrontmatter } from "../../hooks/lib/frontmatter.ts";
import { frontmatterSchema } from "../../hooks/lib/plugin.ts";
import { validate } from "../../hooks/lib/schema.ts";
import { fixtureCompany, repoRoot } from "../helpers.ts";

const schema = frontmatterSchema();
const ajvValidate = new Ajv2020({ allErrors: true, strict: true }).compile(
  schema,
);
const ours = (value: unknown): boolean =>
  validate(schema, schema, value).length === 0;

const walk = (dir: string): string[] =>
  readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return walk(path);
    return path.endsWith(".md") ? [path] : [];
  });

const base = {
  type: "knowledge",
  business: "portfolio",
  status: "active",
  created: "2026-10-01",
  updated: "2026-10-01",
  as_of: "n/a",
  verified: "n/a",
};

const TYPES = [
  "charter",
  "proposal",
  "decision",
  "daily",
  "review",
  "state",
  "ledger",
  "knowledge",
  "inbox",
  "memo",
];
const STATUSES = [
  "active",
  "superseded",
  "proposed",
  "approving",
  "approved",
  "rejected",
  "accepted",
  "paused",
  "closed",
  "draft",
  "archived",
  "unsorted",
  "x",
];
const DATES = [
  "2026-10-01",
  "n/a",
  "",
  "昨日",
  "2026-13-01",
  "2026-10-32",
  "2026/10/01",
  "26-10-01",
];

describe("ajv との一致", () => {
  it("type × status の全組み合わせ", () => {
    for (const type of TYPES) {
      for (const status of STATUSES) {
        const value = {
          ...base,
          type,
          status,
          verified: "2026-10-01",
          id: "20261001-01",
          target: "docs/charter/company.md",
        };
        expect(ours(value), `${type}/${status}`).toBe(ajvValidate(value));
      }
    }
  });

  it("日付欄のあらゆる値", () => {
    for (const field of ["created", "updated", "as_of", "verified"]) {
      for (const date of DATES) {
        for (const type of ["knowledge", "charter"]) {
          const value = { ...base, type, [field]: date };
          expect(ours(value), `${type}.${field}=${date}`).toBe(
            ajvValidate(value),
          );
        }
      }
    }
  });

  it("欄の欠落", () => {
    for (const field of Object.keys(base)) {
      const value: Record<string, string> = { ...base };
      delete value[field];
      expect(ours(value), field).toBe(ajvValidate(value));
    }
  });

  it("business・id・target", () => {
    const cases: Record<string, string>[] = [
      { business: "biz-a" },
      { business: "BizA" },
      { business: "n/a" },
      { business: "" },
      {
        type: "proposal",
        status: "proposed",
        id: "20261001-01",
        target: "docs/x.md",
      },
      {
        type: "proposal",
        status: "proposed",
        id: "2026-10-01",
        target: "docs/x.md",
      },
      {
        type: "proposal",
        status: "proposed",
        id: "20261001-01",
        target: "/etc/passwd",
      },
      {
        type: "proposal",
        status: "proposed",
        id: "20261001-01",
        target: "../x.md",
      },
      { type: "proposal", status: "proposed", id: "20261001-01", target: "" },
      { type: "proposal", status: "proposed", id: "20261001-01" },
      { type: "decision", status: "accepted" },
    ];
    for (const extra of cases) {
      const value = { ...base, ...extra };
      expect(ours(value), JSON.stringify(extra)).toBe(ajvValidate(value));
    }
  });

  it("器の文書とフィクスチャのフロントマター（ajv は YAML を文字列のまま読む）", () => {
    const files = [
      ...walk(join(repoRoot, "docs")),
      ...walk(join(fixtureCompany, "docs")),
    ];
    expect(files.length).toBeGreaterThan(0);
    for (const file of files) {
      const text = readFileSync(file, "utf8");
      const fm = parseFrontmatter(text);
      expect(fm, file).toBeDefined();
      const yamlBlock = /^---\n([\s\S]*?)\n---/.exec(text)?.[1] ?? "";
      const reference: unknown = parse(yamlBlock, { schema: "failsafe" });
      expect(fm?.data, file).toEqual(reference);
      expect(ours(fm?.data), file).toBe(true);
      expect(ajvValidate(reference), file).toBe(true);
    }
  });
});

describe("未対応のキーワード", () => {
  it("例外にする（黙って通さない）", () => {
    expect(() => validate({}, { format: "date" }, "x")).toThrow("未対応");
  });
});
