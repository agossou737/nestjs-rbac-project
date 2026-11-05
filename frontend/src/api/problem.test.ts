import { test } from "node:test";
import assert from "node:assert/strict";
import { AxiosError, AxiosHeaders } from "axios";
import { applyFieldErrors, problemMessage, toProblem } from "./problem.ts";

function apiError(status: number, data: unknown) {
  const config = { headers: new AxiosHeaders() };
  return new AxiosError("failed", "ERR", config, null, { status, statusText: "x", data, headers: {}, config });
}

const t = (key: string) => `t:${key}`;

test("reads an RFC 9457 body, and turns a network failure into status 0", () => {
  const problem = toProblem(apiError(400, { title: "Bad Request", detail: "invalid", errors: [{ field: "email", rule: "isEmail", message: "m" }] }));
  assert.deepEqual(problem, { status: 400, title: "Bad Request", detail: "invalid", errors: [{ field: "email", rule: "isEmail", message: "m" }] });
  assert.equal(toProblem(new Error("offline")).status, 0);
  assert.deepEqual(toProblem(apiError(502, "<html>bad gateway</html>")).errors, []);
});

test("picks a screen override first, then the status message, then the unknown message", () => {
  assert.equal(problemMessage(t, apiError(409, {}), { 409: "users.errors.email_taken" }), "t:users.errors.email_taken");
  assert.equal(problemMessage(t, apiError(403, {})), "t:errors.http.403");
  assert.equal(problemMessage(t, new Error("offline")), "t:errors.http.0");
  assert.equal(problemMessage(t, apiError(418, {})), "t:errors.http.unknown");
});

test("attaches only the server errors of fields the form owns", () => {
  const set: string[] = [];
  const setError = (field: string) => set.push(field);
  const error = apiError(400, { errors: [{ field: "email", rule: "isEmail", message: "m" }, { field: "is_admin", rule: "whitelist", message: "m" }] });
  assert.equal(applyFieldErrors(error, setError, ["email", "first_name"]), true);
  assert.deepEqual(set, ["email"]);
  assert.equal(applyFieldErrors(apiError(409, {}), setError, ["email"]), false);
});
