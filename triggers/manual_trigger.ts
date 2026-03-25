import type { Trigger } from "deno-slack-sdk/types.ts";
import { TriggerTypes } from "deno-slack-api/mod.ts";
import WeeklyEmojiReportWorkflow from "../workflows/weekly_emoji_report.ts";

const manualTrigger: Trigger<typeof WeeklyEmojiReportWorkflow.definition> = {
  type: TriggerTypes.Shortcut,
  name: "Check new emojis now",
  description: "Manually trigger the emoji report for testing",
  workflow: `#/workflows/${WeeklyEmojiReportWorkflow.definition.callback_id}`,
  inputs: {
    channel_id: {
      // Replace with your channel ID
      value: "YOUR_CHANNEL_ID",
    },
  },
};

export default manualTrigger;
