import { SlackFunctionTester } from "deno-slack-sdk/mod.ts";
import { assertEquals } from "@std/assert";
import { stub } from "@std/testing/mock";
import handler from "./find_new_emojis.ts";
import { FindNewEmojisFunctionDefinition } from "./find_new_emojis.ts";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const { createContext } = SlackFunctionTester(FindNewEmojisFunctionDefinition);
const TEST_CHANNEL = "C0123TEST";

interface ApiResponses {
  "emoji.list": Record<string, unknown>;
  "apps.datastore.get": Record<string, unknown>;
  "apps.datastore.put"?: Record<string, unknown>;
  "chat.postMessage"?: Record<string, unknown>;
}

/**
 * Records all fetch calls made by the SDK client so tests can assert
 * which APIs were called and with what payloads.
 */
interface FetchCall {
  url: string;
  body: Record<string, unknown>;
}

function stubFetch(responses: ApiResponses) {
  const calls: FetchCall[] = [];

  const fetchStub = stub(
    globalThis,
    "fetch",
    async (url: string | URL | Request, options?: RequestInit) => {
      const req = url instanceof Request ? url : new Request(url, options);
      const bodyText = await req.text();
      let body: Record<string, unknown> = {};
      try {
        body = JSON.parse(bodyText);
      } catch {
        // Some requests may use form encoding -- parse as URLSearchParams
        const params = new URLSearchParams(bodyText);
        body = Object.fromEntries(params.entries());
      }

      // Extract the API method from the URL
      // e.g. https://slack.com/api/emoji.list -> emoji.list
      const method = req.url.replace("https://slack.com/api/", "");

      calls.push({ url: method, body });

      if (method === "emoji.list") {
        return new Response(JSON.stringify(responses["emoji.list"]), {
          status: 200,
        });
      }
      if (method === "apps.datastore.get") {
        return new Response(JSON.stringify(responses["apps.datastore.get"]), {
          status: 200,
        });
      }
      if (method === "apps.datastore.put") {
        return new Response(
          JSON.stringify(responses["apps.datastore.put"] ?? { ok: true }),
          { status: 200 },
        );
      }
      if (method === "chat.postMessage") {
        return new Response(
          JSON.stringify(
            responses["chat.postMessage"] ?? { ok: true, ts: "1111.2222" },
          ),
          { status: 200 },
        );
      }

      throw new Error(`Unstubbed API method: ${method}`);
    },
  );

  return { fetchStub, calls };
}

/**
 * The SDK client JSON-stringifies nested objects like `item` when sending
 * datastore requests. This helper parses the item back into an object.
 */
function parsePutItem(
  putCall: FetchCall,
): Record<string, string> {
  const rawItem = putCall.body.item;
  if (typeof rawItem === "string") {
    return JSON.parse(rawItem);
  }
  return rawItem as Record<string, string>;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

Deno.test("first run -- no existing snapshot -- posts tracking-activated message", async () => {
  const { fetchStub, calls } = stubFetch({
    "emoji.list": {
      ok: true,
      emoji: {
        parrot: "https://emoji.example/parrot.png",
        shipit: "https://emoji.example/shipit.png",
        parrot_alias: "alias:parrot",
      },
    },
    "apps.datastore.get": {
      ok: true,
      item: {},
    },
  });

  try {
    const ctx = createContext({
      inputs: { channel_id: TEST_CHANNEL },
    });
    const result = await handler(ctx);

    // Should complete without error
    assertEquals(result.error, undefined);

    // Should have saved a snapshot with the two non-alias emojis
    const putCall = calls.find((c) => c.url === "apps.datastore.put");
    assertEquals(putCall !== undefined, true);
    const item = parsePutItem(putCall!);
    const savedNames: string[] = JSON.parse(item.emoji_names_json);
    assertEquals(savedNames, ["parrot", "shipit"]);

    // Should have posted the "tracking aktiverad" message
    const postCall = calls.find((c) => c.url === "chat.postMessage");
    assertEquals(postCall !== undefined, true);
    assertEquals(postCall!.body.channel, TEST_CHANNEL);
    const text = postCall!.body.text as string;
    assertEquals(text.includes("Emoji-tracking aktiverad"), true);
    assertEquals(text.includes("*2*"), true);
  } finally {
    fetchStub.restore();
  }
});

Deno.test("new emojis found -- posts weekly summary with correct emoji list", async () => {
  const previousNames = ["parrot", "shipit"];

  const { fetchStub, calls } = stubFetch({
    "emoji.list": {
      ok: true,
      emoji: {
        parrot: "https://emoji.example/parrot.png",
        shipit: "https://emoji.example/shipit.png",
        tada_custom: "https://emoji.example/tada.gif",
        wave_custom: "https://emoji.example/wave.png",
        shipit_alias: "alias:shipit",
      },
    },
    "apps.datastore.get": {
      ok: true,
      item: {
        id: "latest",
        emoji_names_json: JSON.stringify(previousNames),
        updated_at: "2026-03-18T10:00:00.000Z",
      },
    },
  });

  try {
    const result = await handler(
      createContext({ inputs: { channel_id: TEST_CHANNEL } }),
    );

    assertEquals(result.error, undefined);

    // Should post a message listing the 2 new emojis
    const postCall = calls.find((c) => c.url === "chat.postMessage");
    assertEquals(postCall !== undefined, true);
    const text = postCall!.body.text as string;
    assertEquals(text.includes("Veckans nya emojis"), true);
    assertEquals(text.includes(":tada_custom:"), true);
    assertEquals(text.includes(":wave_custom:"), true);
    assertEquals(text.includes("*2*"), true);
    // Total count: 4 non-alias emojis
    assertEquals(text.includes("4"), true);

    // Should have saved updated snapshot with all 4 emoji names
    const putCall = calls.find((c) => c.url === "apps.datastore.put");
    const item = parsePutItem(putCall!);
    const savedNames: string[] = JSON.parse(item.emoji_names_json);
    assertEquals(savedNames.length, 4);
    assertEquals(savedNames.includes("tada_custom"), true);
    assertEquals(savedNames.includes("wave_custom"), true);
  } finally {
    fetchStub.restore();
  }
});

Deno.test("single new emoji -- uses singular grammar", async () => {
  const previousNames = ["parrot"];

  const { fetchStub, calls } = stubFetch({
    "emoji.list": {
      ok: true,
      emoji: {
        parrot: "https://emoji.example/parrot.png",
        rocket: "https://emoji.example/rocket.png",
      },
    },
    "apps.datastore.get": {
      ok: true,
      item: {
        id: "latest",
        emoji_names_json: JSON.stringify(previousNames),
        updated_at: "2026-03-18T10:00:00.000Z",
      },
    },
  });

  try {
    const result = await handler(
      createContext({ inputs: { channel_id: TEST_CHANNEL } }),
    );

    assertEquals(result.error, undefined);

    const postCall = calls.find((c) => c.url === "chat.postMessage");
    const text = postCall!.body.text as string;
    // Singular: "1 ny custom emoji" (not "nya" or "emojis")
    assertEquals(text.includes("*1* ny custom emoji "), true);
  } finally {
    fetchStub.restore();
  }
});

Deno.test("no new emojis -- does not post any message", async () => {
  const currentNames = ["parrot", "shipit"];

  const { fetchStub, calls } = stubFetch({
    "emoji.list": {
      ok: true,
      emoji: {
        parrot: "https://emoji.example/parrot.png",
        shipit: "https://emoji.example/shipit.png",
        shipit_alias: "alias:shipit",
      },
    },
    "apps.datastore.get": {
      ok: true,
      item: {
        id: "latest",
        emoji_names_json: JSON.stringify(currentNames),
        updated_at: "2026-03-18T10:00:00.000Z",
      },
    },
  });

  try {
    const result = await handler(
      createContext({ inputs: { channel_id: TEST_CHANNEL } }),
    );

    assertEquals(result.error, undefined);

    // Should NOT have called chat.postMessage
    const postCalls = calls.filter((c) => c.url === "chat.postMessage");
    assertEquals(postCalls.length, 0);

    // Should still save updated snapshot
    const putCall = calls.find((c) => c.url === "apps.datastore.put");
    assertEquals(putCall !== undefined, true);
  } finally {
    fetchStub.restore();
  }
});

Deno.test("emoji.list API failure -- returns error without saving or posting", async () => {
  const { fetchStub, calls } = stubFetch({
    "emoji.list": {
      ok: false,
      error: "token_revoked",
    },
    "apps.datastore.get": {
      ok: true,
      item: {},
    },
  });

  try {
    const result = await handler(
      createContext({ inputs: { channel_id: TEST_CHANNEL } }),
    );

    assertEquals(typeof result.error, "string");
    assertEquals(
      (result.error as string).includes("Failed to fetch emoji list"),
      true,
    );
    assertEquals((result.error as string).includes("token_revoked"), true);

    // Should NOT have called datastore or chat
    const datastorePutCalls = calls.filter(
      (c) => c.url === "apps.datastore.put",
    );
    assertEquals(datastorePutCalls.length, 0);

    const postCalls = calls.filter((c) => c.url === "chat.postMessage");
    assertEquals(postCalls.length, 0);
  } finally {
    fetchStub.restore();
  }
});

Deno.test("datastore get failure -- returns error instead of treating as first run", async () => {
  const { fetchStub, calls } = stubFetch({
    "emoji.list": {
      ok: true,
      emoji: {
        parrot: "https://emoji.example/parrot.png",
      },
    },
    "apps.datastore.get": {
      ok: false,
      error: "internal_error",
    },
  });

  try {
    const result = await handler(
      createContext({ inputs: { channel_id: TEST_CHANNEL } }),
    );

    assertEquals(typeof result.error, "string");
    assertEquals(
      (result.error as string).includes("Failed to read emoji snapshot"),
      true,
    );

    // Should NOT have saved or posted anything
    const putCalls = calls.filter((c) => c.url === "apps.datastore.put");
    assertEquals(putCalls.length, 0);
    const postCalls = calls.filter((c) => c.url === "chat.postMessage");
    assertEquals(postCalls.length, 0);
  } finally {
    fetchStub.restore();
  }
});

Deno.test("chat.postMessage failure -- returns error without saving snapshot", async () => {
  const { fetchStub, calls } = stubFetch({
    "emoji.list": {
      ok: true,
      emoji: {
        parrot: "https://emoji.example/parrot.png",
      },
    },
    "apps.datastore.get": {
      ok: true,
      item: {},
    },
    "chat.postMessage": {
      ok: false,
      error: "channel_not_found",
    },
  });

  try {
    const result = await handler(
      createContext({ inputs: { channel_id: TEST_CHANNEL } }),
    );

    assertEquals(typeof result.error, "string");
    assertEquals(
      (result.error as string).includes("Failed to post message"),
      true,
    );

    // Should NOT have saved the snapshot
    const putCalls = calls.filter((c) => c.url === "apps.datastore.put");
    assertEquals(putCalls.length, 0);
  } finally {
    fetchStub.restore();
  }
});

Deno.test("datastore put failure -- returns error", async () => {
  const { fetchStub } = stubFetch({
    "emoji.list": {
      ok: true,
      emoji: {
        parrot: "https://emoji.example/parrot.png",
      },
    },
    "apps.datastore.get": {
      ok: true,
      item: {},
    },
    "apps.datastore.put": {
      ok: false,
      error: "datastore_error",
    },
  });

  try {
    const result = await handler(
      createContext({ inputs: { channel_id: TEST_CHANNEL } }),
    );

    assertEquals(typeof result.error, "string");
    assertEquals(
      (result.error as string).includes("Failed to save emoji snapshot"),
      true,
    );
    assertEquals(
      (result.error as string).includes("datastore_error"),
      true,
    );
  } finally {
    fetchStub.restore();
  }
});

Deno.test("aliases are filtered out -- only real emojis are tracked", async () => {
  const { fetchStub, calls } = stubFetch({
    "emoji.list": {
      ok: true,
      emoji: {
        parrot: "https://emoji.example/parrot.png",
        parrot2: "alias:parrot",
        parrot3: "alias:parrot",
        shipit: "https://emoji.example/shipit.png",
        ship: "alias:shipit",
      },
    },
    "apps.datastore.get": {
      ok: true,
      item: {},
    },
  });

  try {
    const result = await handler(
      createContext({ inputs: { channel_id: TEST_CHANNEL } }),
    );

    assertEquals(result.error, undefined);

    // Snapshot should only contain the 2 real emojis, not the 3 aliases
    const putCall = calls.find((c) => c.url === "apps.datastore.put");
    const item = parsePutItem(putCall!);
    const savedNames: string[] = JSON.parse(item.emoji_names_json);
    assertEquals(savedNames, ["parrot", "shipit"]);
  } finally {
    fetchStub.restore();
  }
});

Deno.test("emoji names are sorted alphabetically in snapshot", async () => {
  const { fetchStub, calls } = stubFetch({
    "emoji.list": {
      ok: true,
      emoji: {
        zebra: "https://emoji.example/zebra.png",
        alpha: "https://emoji.example/alpha.png",
        middle: "https://emoji.example/middle.png",
      },
    },
    "apps.datastore.get": {
      ok: true,
      item: {},
    },
  });

  try {
    await handler(
      createContext({ inputs: { channel_id: TEST_CHANNEL } }),
    );

    const putCall = calls.find((c) => c.url === "apps.datastore.put");
    const item = parsePutItem(putCall!);
    const savedNames: string[] = JSON.parse(item.emoji_names_json);
    assertEquals(savedNames, ["alpha", "middle", "zebra"]);
  } finally {
    fetchStub.restore();
  }
});

Deno.test("removed emojis are not reported as new on next run", async () => {
  // Previous snapshot had 3 emojis, current has 2 (one removed, none added)
  const previousNames = ["alpha", "beta", "gamma"];

  const { fetchStub, calls } = stubFetch({
    "emoji.list": {
      ok: true,
      emoji: {
        alpha: "https://emoji.example/alpha.png",
        gamma: "https://emoji.example/gamma.png",
      },
    },
    "apps.datastore.get": {
      ok: true,
      item: {
        id: "latest",
        emoji_names_json: JSON.stringify(previousNames),
        updated_at: "2026-03-18T10:00:00.000Z",
      },
    },
  });

  try {
    const result = await handler(
      createContext({ inputs: { channel_id: TEST_CHANNEL } }),
    );

    assertEquals(result.error, undefined);

    // No new emojis, so no message should be posted
    const postCalls = calls.filter((c) => c.url === "chat.postMessage");
    assertEquals(postCalls.length, 0);
  } finally {
    fetchStub.restore();
  }
});
