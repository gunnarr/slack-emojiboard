import { DefineFunction, Schema, SlackFunction } from "deno-slack-sdk/mod.ts";

export const FindNewEmojisFunctionDefinition = DefineFunction({
  callback_id: "find_new_emojis",
  title: "Find new emojis",
  description:
    "Compares current custom emojis against the stored snapshot to find newly added ones",
  source_file: "functions/find_new_emojis.ts",
  input_parameters: {
    properties: {
      channel_id: {
        type: Schema.slack.types.channel_id,
      },
    },
    required: ["channel_id"],
  },
  output_parameters: {
    properties: {},
    required: [],
  },
});

export default SlackFunction(
  FindNewEmojisFunctionDefinition,
  async ({ inputs, client }) => {
    // Step 1: Fetch all custom emojis
    const emojiResponse = await client.apiCall("emoji.list");

    if (!emojiResponse.ok) {
      return { error: `Failed to fetch emoji list: ${emojiResponse.error}` };
    }

    const allEmojis: Record<string, string> = emojiResponse.emoji ?? {};

    // Step 2: Filter out aliases (values starting with "alias:")
    const currentEmojiNames = Object.keys(allEmojis)
      .filter((name) => !allEmojis[name].startsWith("alias:"))
      .sort();

    // Step 3: Read previous snapshot from datastore
    const getResponse = await client.apps.datastore.get({
      datastore: "EmojiSnapshots",
      id: "latest",
    });

    if (!getResponse.ok && getResponse.error !== "datastore_item_not_found") {
      return {
        error: `Failed to read emoji snapshot: ${getResponse.error}`,
      };
    }

    const isFirstRun = !getResponse.item?.emoji_names_json;

    // Step 4: Compute new emojis
    let newEmojiNames: string[] = [];
    if (!isFirstRun) {
      const previousNames: string[] = JSON.parse(
        getResponse.item.emoji_names_json,
      );
      const previousSet = new Set(previousNames);
      newEmojiNames = currentEmojiNames.filter(
        (name) => !previousSet.has(name),
      );
    }

    // Step 5: Post message (or skip)
    if (isFirstRun) {
      const postResponse = await client.chat.postMessage({
        channel: inputs.channel_id,
        text:
          `:clipboard: *Emoji-tracking aktiverad!*\n\nJag har nu koll på alla custom emojis i denna workspace. Just nu finns det *${currentEmojiNames.length}* stycken.\n\nJag rapporterar nya emojis nästa fredag! :eyes:`,
      });

      if (!postResponse.ok) {
        return {
          error: `Failed to post message: ${postResponse.error}`,
        };
      }
    } else if (newEmojiNames.length > 0) {
      const emojiList = newEmojiNames
        .map((name) => `:${name}:  \`:${name}:\``)
        .join("\n");

      const count = newEmojiNames.length;
      const message = `:tada: *Veckans nya emojis!*\n\n*${count}* ny${
        count === 1 ? "" : "a"
      } custom emoji${
        count === 1 ? "" : "s"
      } den här veckan:\n\n${emojiList}\n\n_Totalt antal custom emojis: ${currentEmojiNames.length}_`;

      const postResponse = await client.chat.postMessage({
        channel: inputs.channel_id,
        text: message,
      });

      if (!postResponse.ok) {
        return {
          error: `Failed to post message: ${postResponse.error}`,
        };
      }
    }

    // Step 6: Save snapshot AFTER successful post
    const putResponse = await client.apps.datastore.put({
      datastore: "EmojiSnapshots",
      item: {
        id: "latest",
        emoji_names_json: JSON.stringify(currentEmojiNames),
        updated_at: new Date().toISOString(),
      },
    });

    if (!putResponse.ok) {
      return { error: `Failed to save emoji snapshot: ${putResponse.error}` };
    }

    return { outputs: {} };
  },
);
