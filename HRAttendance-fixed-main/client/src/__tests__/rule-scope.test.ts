import { describe, expect, it } from "vitest";
import { buildEmpScope, normalizeEmpCode, parseRuleScope } from "@shared/rule-scope";

describe("rule scope parsing", () => {
  it("normalizes numeric employee codes and trims spaces", () => {
    const parsed = parseRuleScope("emp: 001, 31 , 00042");
    expect(parsed.type).toBe("emp");
    expect(parsed.values).toEqual(["1", "31", "42"]);
  });

  it("keeps non-numeric employee codes", () => {
    const parsed = parseRuleScope("emp:HR-01, abc");
    expect(parsed.values).toEqual(["HR-01", "abc"]);
  });

  it("normalizes codes through buildEmpScope", () => {
    const scope = buildEmpScope(["001", "31", "00031"]);
    expect(scope).toBe("emp:1,31");
  });

  it("normalizes helper for numeric codes", () => {
    expect(normalizeEmpCode("0007")).toBe("7");
    expect(normalizeEmpCode("A07")).toBe("A07");
  });
});
