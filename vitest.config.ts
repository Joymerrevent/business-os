import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["test/**/*.test.ts"],
    // hook を別プロセスで起動するテストが多いため、既定より長めにとる
    testTimeout: 20_000,
    // beforeEach で一時フォルダへコピーするテストが、Windows の CI では既定の 10 秒を超えることがある
    hookTimeout: 20_000,
  },
});
