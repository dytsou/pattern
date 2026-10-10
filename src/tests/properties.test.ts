import { describe, expect, it } from "vitest";
import {
  propAccessNotDelegationAndChildExpiry,
  propDenyByDefault,
  propNoEscalation,
  propRevokePropagates,
} from "../properties.js";

describe("properties", () => {
  it("prop_denyByDefault: empty grants never allow", () => {
    expect(() => propDenyByDefault()).not.toThrow();
  });

  it("prop_noEscalation: intersect never widens", () => {
    expect(() => propNoEscalation()).not.toThrow();
  });

  it("prop_accessNotDelegation + childExpiryLEParent", async () => {
    await expect(
      propAccessNotDelegationAndChildExpiry(),
    ).resolves.toBeUndefined();
  });

  it("prop_revokePropagates: cascade denies descendants", async () => {
    await expect(propRevokePropagates()).resolves.toBeUndefined();
  });
});
