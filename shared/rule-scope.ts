import { normalizeEmployeeCode } from "./employee-code";
export type RuleScope =
  | { type: "all"; values: [] }
  | { type: "emp" | "dept" | "sector"; values: string[] };

const normalizeScopeValue = (value: string) => value.trim();
export const normalizeEmpCode = (value: string) => {
  const normalized = normalizeEmployeeCode(normalizeScopeValue(value));
  if (!normalized) return "";
  if (/^\d+$/.test(normalized)) return String(Number(normalized));
  return normalized;
};

const splitScopeValues = (raw: string) =>
  raw
    .split(",")
    .map((value) => normalizeScopeValue(value))
    .filter(Boolean);

export const parseRuleScope = (scope: string): RuleScope => {
  if (!scope || scope === "all") return { type: "all", values: [] };
  if (scope.startsWith("emp:")) {
    return {
      type: "emp",
      values: splitScopeValues(scope.slice("emp:".length)).map((value) => normalizeEmpCode(value)).filter(Boolean),
    };
  }
  if (scope.startsWith("dept:")) {
    return { type: "dept", values: splitScopeValues(scope.slice("dept:".length)) };
  }
  if (scope.startsWith("sector:")) {
    return { type: "sector", values: splitScopeValues(scope.slice("sector:".length)) };
  }
  return { type: "all", values: [] };
};

export const buildEmpScope = (values: string[]) => {
  const normalized = values.map((value) => normalizeEmpCode(value)).filter(Boolean);
  const deduped: string[] = [];
  normalized.forEach((value) => {
    if (!deduped.includes(value)) deduped.push(value);
  });
  return `emp:${deduped.join(",")}`;
};
