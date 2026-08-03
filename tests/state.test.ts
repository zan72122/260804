import { describe, expect, it } from "vitest";
import {
  advance, chooseFromComplete, DARK_PHASES, nextPhase, passOf, Phase
} from "../src/statemachine";

describe("state machine", () => {
  it("walks the full inspection loop from title to complete", () => {
    const expected: Phase[] = [
      "title", "arrive", "clean", "yoke", "magnetize", "fluid", "curtain",
      "uv", "record", "rotate", "magnetize2", "fluid2", "curtain2",
      "uv2", "record2", "demag", "complete"
    ];
    let p: Phase = "title";
    const walked: Phase[] = [p];
    while (nextPhase(p) !== null) {
      p = advance(p);
      walked.push(p);
    }
    expect(walked).toEqual(expected);
  });

  it("complete has no automatic successor (explicit choice required)", () => {
    expect(nextPhase("complete")).toBeNull();
    expect(() => advance("complete")).toThrow();
  });

  it("replay choices restart the loop, free scan stays a side room", () => {
    expect(chooseFromComplete("again")).toBe("arrive");
    expect(chooseFromComplete("newPart")).toBe("arrive");
    expect(chooseFromComplete("free")).toBe("free");
  });

  it("assigns pass 1 work before the rotation and pass 2 after", () => {
    expect(passOf("fluid")).toBe(1);
    expect(passOf("uv")).toBe(1);
    expect(passOf("record")).toBe(1);
    expect(passOf("rotate")).toBe(2);
    expect(passOf("fluid2")).toBe(2);
    expect(passOf("uv2")).toBe(2);
    expect(passOf("clean")).toBe(0);
    expect(passOf("demag")).toBe(0);
  });

  it("UV-meaningful phases are exactly the dark ones", () => {
    for (const p of ["uv", "uv2", "record", "record2", "free"] as Phase[]) {
      expect(DARK_PHASES.has(p)).toBe(true);
    }
    for (const p of ["clean", "fluid", "rotate", "demag", "complete"] as Phase[]) {
      expect(DARK_PHASES.has(p)).toBe(false);
    }
  });
});
