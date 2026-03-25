import { Manifest } from "deno-slack-sdk/mod.ts";
import WeeklyEmojiReportWorkflow from "./workflows/weekly_emoji_report.ts";
import EmojiSnapshotDatastore from "./datastores/emoji_snapshot.ts";

export default Manifest({
  name: "Emojiboard",
  description:
    "Varje fredag postar jag veckans nya custom emojis. Aldrig missa en ny emoji igen!",
  icon: "assets/default_new_app_icon.png",
  workflows: [WeeklyEmojiReportWorkflow],
  outgoingDomains: [],
  datastores: [EmojiSnapshotDatastore],
  botScopes: [
    "commands",
    "chat:write",
    "chat:write.public",
    "datastore:read",
    "datastore:write",
    "emoji:read",
  ],
});
