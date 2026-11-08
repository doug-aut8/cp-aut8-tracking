/// <reference types="node" />
import { describe, it } from "node:test";
import { strictEqual, deepStrictEqual } from "node:assert";
import { parseStoreMode, resolveStoreOperation } from "./storeOperation";
describe("Manual store operation", () => {
  it("opens outside normal hours when manually opened", () => {
    strictEqual(resolveStoreOperation("aberta", { isOpen: false, label: "Fechado" }).isOpen, true);
  });
  it("closes during normal hours when manually closed", () => {
    strictEqual(resolveStoreOperation("fechada", { isOpen: true, label: "Aberto" }).isOpen, false);
  });
  it("restores scheduled open and closed states in automatic mode", () => {
    for (const isOpen of [true, false]) {
      const scheduled = { isOpen, label: "Horário normal" };
      deepStrictEqual(resolveStoreOperation("automatico", scheduled), scheduled);
    }
  });
  it("defaults missing or unknown configuration to automatic", () => {
    strictEqual(parseStoreMode(null), "automatico");
    strictEqual(parseStoreMode("invalid"), "automatico");
    strictEqual(parseStoreMode("aberta"), "aberta");
    strictEqual(parseStoreMode("fechada"), "fechada");
  });
});