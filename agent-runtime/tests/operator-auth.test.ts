import assert from "node:assert/strict";
import test from "node:test";
import { operatorAccess } from "../agent/lib/operator-auth.ts";

function request(password: string, username = "tavren") {
  return new Request("https://tavren.example/eve/v1/info", {
    headers: { authorization: `Basic ${Buffer.from(`${username}:${password}`).toString("base64")}` },
  });
}

test("operator authentication rejects unset and empty secrets", async () => {
  for (const value of [undefined, ""]) {
    assert.equal(await operatorAccess(() => value)(request("")), null);
  }
});

test("operator authentication rejects missing or incorrect credentials", async () => {
  const auth = operatorAccess(() => "test-operator-password");
  assert.equal(await auth(new Request("https://tavren.example/eve/v1/info")), null);
  assert.equal(await auth(request("wrong")), null);
  assert.equal(await auth(request("test-operator-password", "other-user")), null);
});

test("operator authentication accepts the configured credential", async () => {
  const result = await operatorAccess(() => "test-operator-password")(request("test-operator-password"));
  assert.ok(result?.principalId);
});
