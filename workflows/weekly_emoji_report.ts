import { DefineWorkflow, Schema } from "deno-slack-sdk/mod.ts";
import { FindNewEmojisFunctionDefinition } from "../functions/find_new_emojis.ts";

const WeeklyEmojiReportWorkflow = DefineWorkflow({
  callback_id: "weekly_emoji_report",
  title: "Weekly Emoji Report",
  description: "Finds new custom emojis added this week and posts a summary",
  input_parameters: {
    properties: {
      channel_id: {
        type: Schema.slack.types.channel_id,
      },
    },
    required: ["channel_id"],
  },
});

WeeklyEmojiReportWorkflow.addStep(FindNewEmojisFunctionDefinition, {
  channel_id: WeeklyEmojiReportWorkflow.inputs.channel_id,
});

export default WeeklyEmojiReportWorkflow;
