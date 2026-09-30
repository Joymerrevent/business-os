// JSON Schema の小さな解釈器。templates/frontmatter.schema.json が使うキーワードだけを扱う。
// 配布物は外部の依存を持てないため自作する。知らないキーワードが来たら例外にして、
// スキーマの変更に解釈器が追いついていないことを黙って通さない（fail-closed）。
// 正しさは test/lib/schema.test.ts で ajv と突き合わせて確かめる。

type SchemaObject = { [key: string]: unknown };
type Schema = SchemaObject | boolean;

const ANNOTATIONS = new Set([
  "$schema",
  "$id",
  "$defs",
  "title",
  "description",
]);
const SUPPORTED = new Set([
  "$ref",
  "type",
  "required",
  "properties",
  "enum",
  "const",
  "pattern",
  "minLength",
  "not",
  "allOf",
  "anyOf",
  "if",
  "then",
  "else",
]);

const isObject = (value: unknown): value is SchemaObject =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const resolveRef = (root: SchemaObject, ref: string): Schema => {
  if (!ref.startsWith("#/")) throw new Error(`未対応の $ref です: ${ref}`);
  let node: unknown = root;
  for (const part of ref.slice(2).split("/")) {
    if (!isObject(node)) throw new Error(`$ref を解決できません: ${ref}`);
    node = node[part];
  }
  if (!isObject(node) && typeof node !== "boolean") {
    throw new Error(`$ref を解決できません: ${ref}`);
  }
  return node;
};

const typeMatches = (type: unknown, value: unknown): boolean => {
  switch (type) {
    case "object":
      return isObject(value);
    case "string":
      return typeof value === "string";
    default:
      throw new Error(`未対応の type です: ${String(type)}`);
  }
};

/** value を schema で検査し、違反の説明を返す（空なら適合） */
export const validate = (
  root: SchemaObject,
  schema: Schema,
  value: unknown,
  path = "",
): string[] => {
  if (schema === true) return [];
  if (schema === false) return [`${path || "/"}: 許可されない値です`];
  const errors: string[] = [];
  for (const key of Object.keys(schema)) {
    if (!ANNOTATIONS.has(key) && !SUPPORTED.has(key)) {
      throw new Error(`未対応のキーワードです: ${key}`);
    }
  }
  const at = path || "/";

  const ref = schema["$ref"];
  if (typeof ref === "string") {
    errors.push(...validate(root, resolveRef(root, ref), value, path));
  }
  if ("type" in schema && !typeMatches(schema["type"], value)) {
    return [...errors, `${at}: 型が ${String(schema["type"])} ではありません`];
  }
  if (Array.isArray(schema["enum"]) && !schema["enum"].includes(value)) {
    errors.push(
      `${at}: ${JSON.stringify(value)} は ${schema["enum"].join(" / ")} のどれでもありません`,
    );
  }
  if ("const" in schema && value !== schema["const"]) {
    errors.push(
      `${at}: ${JSON.stringify(schema["const"])} である必要があります`,
    );
  }
  if (typeof schema["pattern"] === "string" && typeof value === "string") {
    if (!new RegExp(schema["pattern"], "u").test(value)) {
      errors.push(`${at}: ${JSON.stringify(value)} は書式に合いません`);
    }
  }
  if (typeof schema["minLength"] === "number" && typeof value === "string") {
    if ([...value].length < schema["minLength"]) {
      errors.push(`${at}: 短すぎます`);
    }
  }
  if (isObject(value)) {
    if (Array.isArray(schema["required"])) {
      for (const key of schema["required"]) {
        if (typeof key === "string" && !(key in value)) {
          errors.push(`${at}: ${key} がありません`);
        }
      }
    }
    const properties = schema["properties"];
    if (isObject(properties)) {
      for (const [key, sub] of Object.entries(properties)) {
        if (key in value) {
          errors.push(
            ...validate(root, sub as Schema, value[key], `${path}/${key}`),
          );
        }
      }
    }
  }
  if ("not" in schema) {
    if (validate(root, schema["not"] as Schema, value, path).length === 0) {
      errors.push(`${at}: 許可されない値です`);
    }
  }
  if (Array.isArray(schema["allOf"])) {
    for (const sub of schema["allOf"]) {
      errors.push(...validate(root, sub as Schema, value, path));
    }
  }
  if (Array.isArray(schema["anyOf"])) {
    const results = schema["anyOf"].map((sub) =>
      validate(root, sub as Schema, value, path),
    );
    if (!results.some((result) => result.length === 0)) {
      errors.push(...(results[0] ?? [`${at}: どの形にも合いません`]));
    }
  }
  if ("if" in schema) {
    const matched =
      validate(root, schema["if"] as Schema, value, path).length === 0;
    const branch = matched ? schema["then"] : schema["else"];
    if (branch !== undefined) {
      errors.push(...validate(root, branch as Schema, value, path));
    }
  }
  return errors;
};
