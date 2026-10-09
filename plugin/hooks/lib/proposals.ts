// 提案（docs/proposals/）の読み取り。
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { normalizeTarget } from "./company.ts";
import { parseFrontmatter } from "./frontmatter.ts";

export type Proposal = {
  file: string;
  id: string;
  status: string;
  target: string;
  updated: string;
};

/** docs/proposals/ の提案を読む。フロントマターが壊れた提案があれば例外（fail-closed） */
export const readProposals = (root: string): Proposal[] => {
  const dir = join(root, "docs", "proposals");
  if (!existsSync(dir)) return [];
  const proposals: Proposal[] = [];
  for (const name of readdirSync(dir)) {
    if (!name.endsWith(".md") || name.startsWith("_")) continue;
    const fm = parseFrontmatter(readFileSync(join(dir, name), "utf8"));
    if (fm === undefined) continue;
    proposals.push({
      file: name,
      id: fm.data["id"] ?? "",
      status: fm.data["status"] ?? "",
      target: fm.data["target"] ?? "",
      updated: fm.data["updated"] ?? "",
    });
  }
  return proposals;
};

/** key（比較用の相対パス）を target にした approving の提案があるか */
export const hasApprovingProposal = (root: string, key: string): boolean =>
  readProposals(root).some(
    (proposal) =>
      proposal.status === "approving" &&
      proposal.target !== "" &&
      normalizeTarget(proposal.target) === key,
  );
