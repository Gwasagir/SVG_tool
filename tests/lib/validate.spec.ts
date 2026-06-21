import { describe, expect, it } from "vitest";
import type { SvgNode } from "../../src/lib/types";
import { type ValidationError, type ValidationResult, validate } from "../../src/lib/validate";

describe("validate", () => {
  it("accepts a well-formed minimal svg", () => {
    const tree: SvgNode = {
      tag: "svg",
      attrs: { width: 64, height: 64, viewBox: "0 0 100 100" },
      children: [{ tag: "rect", attrs: { x: 0, y: 0, width: 100, height: 100, fill: "#0f0" } }],
    };
    expect(validate(tree).valid).toBe(true);
  });

  it("rejects a disallowed tag (script)", () => {
    const tree: SvgNode = {
      tag: "svg",
      children: [{ tag: "script" as SvgNode["tag"], attrs: {} }],
    };
    const r = validate(tree);
    expect(r.valid).toBe(false);
    expect(r.errors.some((e) => e.message.includes("script"))).toBe(true);
  });

  it("rejects event handler attributes", () => {
    const tree: SvgNode = {
      tag: "svg",
      children: [{ tag: "rect", attrs: { onclick: "alert(1)", fill: "#000" } }],
    };
    const r = validate(tree);
    expect(r.valid).toBe(false);
    expect(r.errors.some((e) => /onclick/i.test(e.message))).toBe(true);
  });

  it("rejects href/xlink:href", () => {
    const tree: SvgNode = {
      tag: "svg",
      children: [{ tag: "use", attrs: { href: "https://evil.com/x.svg#a" } }],
    };
    const r = validate(tree);
    expect(r.valid).toBe(false);
    expect(r.errors.some((e) => e.message.includes("href"))).toBe(true);
  });

  it("rejects javascript: URLs in attribute values", () => {
    const tree: SvgNode = {
      tag: "svg",
      children: [{ tag: "rect", attrs: { fill: "javascript:alert(1)" } }],
    };
    const r = validate(tree);
    expect(r.valid).toBe(false);
    expect(r.errors.some((e) => e.message.includes("Unsafe attribute value"))).toBe(true);
  });

  it("rejects remote url() references in fill", () => {
    const tree: SvgNode = {
      tag: "svg",
      children: [{ tag: "rect", attrs: { fill: "url(https://evil.com/g)" } }],
    };
    const r = validate(tree);
    expect(r.valid).toBe(false);
  });

  it("reports errors from nested children", () => {
    const tree: SvgNode = {
      tag: "svg",
      children: [{ tag: "g", children: [{ tag: "script" as SvgNode["tag"], attrs: {} }] }],
    };
    const r = validate(tree);
    expect(r.valid).toBe(false);
    expect(r.errors.length).toBeGreaterThanOrEqual(1);
  });

  it("accepts gradients and defs", () => {
    const tree: SvgNode = {
      tag: "svg",
      children: [
        {
          tag: "defs",
          children: [
            {
              tag: "linearGradient",
              attrs: { id: "g" },
              children: [{ tag: "stop", attrs: { offset: "0%", "stop-color": "#fff" } }],
            },
          ],
        },
        { tag: "rect", attrs: { fill: "url(#g)", width: 10, height: 10 } },
      ],
    };
    expect(validate(tree).valid).toBe(true);
  });
});
