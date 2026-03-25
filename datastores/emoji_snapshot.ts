import { DefineDatastore, Schema } from "deno-slack-sdk/mod.ts";

const EmojiSnapshotDatastore = DefineDatastore({
  name: "EmojiSnapshots",
  primary_key: "id",
  attributes: {
    id: {
      type: Schema.types.string,
    },
    emoji_names_json: {
      type: Schema.types.string,
    },
    updated_at: {
      type: Schema.types.string,
    },
  },
});

export default EmojiSnapshotDatastore;
