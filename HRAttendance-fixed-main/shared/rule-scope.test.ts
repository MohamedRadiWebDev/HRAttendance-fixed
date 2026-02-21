import assert from "node:assert/strict";
import { buildEmpScope, parseRuleScope } from "./rule-scope";

(() => {
  const scope = parseRuleScope("emp:289,31,515,723,780,806");
  assert.equal(scope.type, "emp");
  assert.ok(scope.values.includes("31"));
  assert.ok(scope.values.includes("806"));
  assert.equal(scope.values.includes("659"), false);
})();

(() => {
  const scope = parseRuleScope("emp:289, 31 , 515");
  assert.equal(scope.type, "emp");
  assert.deepEqual(scope.values, ["289", "31", "515"]);
})();

(() => {
  const scope = parseRuleScope("emp:19");
  assert.equal(scope.type, "emp");
  assert.deepEqual(scope.values, ["19"]);
})();

(() => {
  const scope = parseRuleScope("all");
  assert.equal(scope.type, "all");
})();

(() => {
  const scope = buildEmpScope(["289", " 31 ", "515"]);
  assert.equal(scope, "emp:289,31,515");
})();

console.log("rule-scope tests passed");
