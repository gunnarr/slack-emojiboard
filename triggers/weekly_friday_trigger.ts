import type { Trigger } from "deno-slack-sdk/types.ts";
import { TriggerTypes } from "deno-slack-api/mod.ts";
import WeeklyEmojiReportWorkflow from "../workflows/weekly_emoji_report.ts";

const weeklyFridayTrigger: Trigger<
  typeof WeeklyEmojiReportWorkflow.definition
> = {
  type: TriggerTypes.Scheduled,
  name: "Weekly emoji report",
  description: "Posts new custom emojis every Friday afternoon",
  workflow: `#/workflows/${WeeklyEmojiReportWorkflow.definition.callback_id}`,
  inputs: {
    channel_id: {
      // Replace with your channel ID
      value: "YOUR_CHANNEL_ID",
    },
  },
  schedule: {
    start_time: "2026-03-27T15:00:00Z",
    timezone: "Europe/Stockholm",
    frequency: {
      type: "weekly",
      repeats_every: 1,
      on_days: ["Friday"],
    },
  },
};

export default weeklyFridayTrigger;
