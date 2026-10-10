import { describe, it } from "vitest";
import {
  propAccessNotDelegationAndChildExpiry,
  propDenyByDefault,
  propNoEscalation,
  propRevokePropagates,
} from "../properties.js";

describe("properties", () => {
  it("prop_denyByDefault: empty grants never allow", () => {
    propDenyByDefault();
  });

  it("prop_noEscalation: intersect never widens", () => {
    propNoEscalation();
  });

  it("prop_accessNotDelegation + childExpiryLEParent", async () => {
    await propAccessNotDelegationAndChildExpiry();
  });

  it("prop_revokePropagates: cascade denies descendants", async () => {
    await propRevokePropagates();
  });
});
