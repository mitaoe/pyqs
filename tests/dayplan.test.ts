import { describe, expect, it } from "vitest";

import { splitDayPlan } from "../src/components/assistant/AnswerView";

describe("splitDayPlan", () => {
  it("splits bolded Day headers without stray asterisks or duplicated titles", () => {
    const plan = splitDayPlan(
      "Start with the heavy hitters.\n\n**Day 1: Arrays & Hashing**\n- Revise hash collisions\n- Solve two past questions\n\n**Day 2: Trees**\n- B+ tree constructions",
    );
    expect(plan).not.toBeNull();
    expect(plan!.intro).toBe("Start with the heavy hitters.");
    expect(plan!.days.map((d) => d.label)).toEqual(["Day 1", "Day 2"]);
    expect(plan!.days[0].body).toBe(
      "**Arrays & Hashing**\n- Revise hash collisions\n- Solve two past questions",
    );
    // no unbalanced ** anywhere and no "Day 1" duplicated into the body
    for (const d of plan!.days) {
      expect((d.body.match(/\*\*/g) ?? []).length % 2).toBe(0);
      expect(d.body).not.toMatch(/^Day\s+\d/i);
      expect(d.body).not.toMatch(/^\s*:/);
    }
  });

  it("handles list-item and plain Day lines", () => {
    const plan = splitDayPlan(
      "- **Day 1** — Sorting basics\ncontent A\nDay 2 (2 hours): revision\ncontent B",
    );
    expect(plan).not.toBeNull();
    expect(plan!.days[0].body).toBe("**Sorting basics**\ncontent A");
    expect(plan!.days[1].body).toBe("**(2 hours): revision**\ncontent B");
  });

  it("returns null when there is no multi-day structure", () => {
    expect(splitDayPlan("Just study hashing first, then trees.")).toBeNull();
    expect(splitDayPlan("Day 1: everything")).toBeNull();
  });
});
