/**
 * Linear inspection flow as an explicit state machine.
 * Pure data + pure functions so it can be unit tested and survives
 * orientation changes (all progress lives outside the DOM).
 */

export type Phase =
  | "title"
  | "arrive"      // part slides onto the table
  | "clean"       // wipe the surface
  | "yoke"        // drag the U-yoke onto the part
  | "magnetize"   // press the big button (pass 1)
  | "fluid"       // pour fluorescent particle bath (pass 1)
  | "curtain"     // swipe the hood down
  | "uv"          // UV-A sweep reveals crack A
  | "record"      // tap near the glowing line to photograph it
  | "rotate"      // rotate the yoke ~90 degrees
  | "magnetize2"  // press the button again (pass 2)
  | "fluid2"      // pour again
  | "curtain2"    // close the hood again
  | "uv2"         // UV-A sweep reveals crack B
  | "record2"     // photograph crack B
  | "demag"       // pull the part through the demag ring
  | "complete"    // album + replay choices
  | "free";       // free UV scanning, entered from complete

const NEXT: Record<Phase, Phase | null> = {
  title: "arrive",
  arrive: "clean",
  clean: "yoke",
  yoke: "magnetize",
  magnetize: "fluid",
  fluid: "curtain",
  curtain: "uv",
  uv: "record",
  record: "rotate",
  rotate: "magnetize2",
  magnetize2: "fluid2",
  fluid2: "curtain2",
  curtain2: "uv2",
  uv2: "record2",
  record2: "demag",
  demag: "complete",
  complete: null,
  free: null
};

/** Phases where the hood is closed (dark ambient, UV meaningful). */
export const DARK_PHASES: ReadonlySet<Phase> = new Set([
  "uv", "record", "uv2", "record2", "free"
]);

/** Which crack pass a phase is working on (0 = none). */
export function passOf(phase: Phase): 0 | 1 | 2 {
  switch (phase) {
    case "magnetize": case "fluid": case "curtain": case "uv": case "record":
      return 1;
    case "rotate": case "magnetize2": case "fluid2": case "curtain2":
    case "uv2": case "record2":
      return 2;
    default:
      return 0;
  }
}

export function nextPhase(p: Phase): Phase | null {
  return NEXT[p];
}

/** Advance one step along the main loop; complete/free need explicit choices. */
export function advance(p: Phase): Phase {
  const n = NEXT[p];
  if (n === null) {
    throw new Error(`phase ${p} has no automatic successor`);
  }
  return n;
}

/** Choices available on the complete screen. */
export type CompleteChoice = "again" | "newPart" | "free";

export function chooseFromComplete(c: CompleteChoice): Phase {
  return c === "free" ? "free" : "arrive";
}
