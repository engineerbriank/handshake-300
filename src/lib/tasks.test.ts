import { describe, it, expect } from "vitest";
import { hourlyEquivalent, coveredSlots, budgetFor, taskState, scoreTask, recommendTasks } from "./tasks";

const now = new Date("2026-11-14T12:00:00Z");
const base = { id: "a", status: "published", paused: false, deadline: "2026-11-20T00:00:00Z", slots: 40, slots_claimed: 0, publish_at: null, category: "writing", required_skills: ["writing"], eligible_countries: [], pay_usd: 2, estimated_minutes: 60, difficulty: "standard" };

describe("task pay rules", () => {
  it("$2.00 for 60 minutes is $2.00/hour equivalent", () => expect(hourlyEquivalent(2, 60)).toBe(2));
  it("$2.50 for 30 minutes is $5.00/hour equivalent", () => expect(hourlyEquivalent(2.5, 30)).toBe(5));
  it("$100 reserved at $2.50 covers exactly 40 slots", () => expect(coveredSlots(100, 2.5)).toBe(40));
  it("$100 reserved does not cover 100 slots at $2.50", () => expect(coveredSlots(100, 2.5)).toBeLessThan(100));
  it("40 slots at $2.00 need $80", () => expect(budgetFor(2, 40)).toBe(80));
  it("$0.80 slots do not round up past available funds", () => expect(coveredSlots(2.39, 0.8)).toBe(2));
});

describe("task availability", () => {
  it("unfunded drafts are never open", () => expect(taskState({ ...base, status: "draft" }, now)).toBe("draft"));
  it("all slots claimed means fully claimed", () => expect(taskState({ ...base, slots_claimed: 40 }, now)).toBe("full"));
  it("past deadline means expired", () => expect(taskState({ ...base, deadline: "2026-11-13T00:00:00Z" }, now)).toBe("expired"));
  it("future publish date means scheduled", () => expect(taskState({ ...base, publish_at: "2026-11-15T00:00:00Z" }, now)).toBe("scheduled"));
  it("paused tasks are not open", () => expect(taskState({ ...base, paused: true }, now)).toBe("paused"));
});

describe("recommendations", () => {
  const profile = { skills: ["writing"], country: "Kenya", completedCategories: {} };
  it("excludes tasks the user's country cannot take", () => expect(scoreTask({ ...base, eligible_countries: ["Ghana"] }, profile, now)).toBe(-1));
  it("ranks skill matches above non-matches", () => {
    const other = { ...base, id: "b", required_skills: ["figma"], category: "graphic_design" };
    expect(recommendTasks([other, base], profile, now).map((t) => t.id)).toEqual(["a", "b"]);
  });
  it("excludes full tasks", () => expect(recommendTasks([{ ...base, slots_claimed: 40 }], profile, now)).toHaveLength(0));
});
