import { describe, expect, it } from "vitest";
import { formatGreeting, fullName, joinNames } from "./greeting";

describe("greetings", () => {
  it('greets the acceptance-test household as "Welcome, John & Sarah."', () => {
    expect(
      formatGreeting([
        { first_name: "John", last_name: "Smith" },
        { first_name: "Sarah", last_name: "Smith" },
      ]),
    ).toBe("Welcome, John & Sarah.");
  });

  it("prefers display names", () => {
    expect(formatGreeting([{ first_name: "Jonathan", display_name: "Jon" }])).toBe("Welcome, Jon.");
  });

  it("joins one, two, and many names naturally", () => {
    expect(joinNames(["A"])).toBe("A");
    expect(joinNames(["A", "B"])).toBe("A & B");
    expect(joinNames(["A", "B", "C"])).toBe("A, B & C");
    expect(joinNames([])).toBe("");
  });

  it("formats admin-facing full names", () => {
    expect(fullName({ first_name: "John", last_name: "Smith", display_name: "Johnny" })).toBe("John Smith");
    expect(fullName({ first_name: "Cher", last_name: null })).toBe("Cher");
  });
});
