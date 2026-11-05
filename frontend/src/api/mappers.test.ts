import { test } from "node:test";
import assert from "node:assert/strict";
import { fullName, groupByModule, initials, type Permission } from "./mappers.ts";

const permission = (key: Permission["key"]): Permission => {
  const [module, action] = key.split(".");
  return { id: key, key, module, action, description: null };
};

test("groups the catalogue by module in navigation order, keeping each module's actions", () => {
  const modules = groupByModule([
    permission("activity_logs.read"),
    permission("users.read"),
    permission("users.create"),
    permission("dashboard.read"),
  ]);
  assert.deepEqual(
    modules.map((m) => [m.module, m.permissions.map((p) => p.action)]),
    [["dashboard", ["read"]], ["users", ["read", "create"]], ["activity_logs", ["read"]]],
  );
});

test("builds names and initials for display", () => {
  assert.equal(fullName({ first_name: "Awa", last_name: "Hounsa" }), "Awa Hounsa");
  assert.equal(initials({ first_name: "élodie", last_name: "dossou" }), "ÉD");
  assert.equal(initials({ first_name: "", last_name: "" }), "");
});
