# Emojiboard

<img src="assets/default_new_app_icon.png" width="128" alt="Emojiboard icon">

Every Friday, Emojiboard posts the week's new custom emojis to a Slack channel. Never miss a new emoji again!

---

## How it works

Emojiboard runs as a [Slack Platform](https://api.slack.com/automation) app (Deno/TypeScript) directly in Slack's cloud. No self-hosting required.

1. Every Friday, all custom emojis are fetched via `emoji.list`
2. The list is compared with last week's snapshot
3. New emojis are posted to the channel
4. If no new emojis exist, the message is skipped

### Example message

> **Veckans nya emojis!**
>
> :partyparrot: `:partyparrot:`
> :shipit: `:shipit:`
> :lgtm: `:lgtm:`
>
> _Totalt antal custom emojis: 3096_

---

## Installation

### Prerequisites

- [Slack CLI](https://api.slack.com/automation/cli/install) (`brew install slack-cli`)
- [Deno](https://deno.land/) (`brew install deno` or `curl -fsSL https://deno.land/install.sh | sh`)
- A Slack workspace with a paid plan

### Steps

**1. Clone the repo**

```bash
git clone https://github.com/gunnarr/slack-emojiboard.git
cd slack-emojiboard
```

**2. Log in**

```bash
slack login
```

**3. Find your channel ID**

In Slack: right-click the channel > "View channel details" > Channel ID is at the bottom.

**4. Update channel ID in trigger files**

Replace `YOUR_CHANNEL_ID` in both files:

- `triggers/weekly_friday_trigger.ts`
- `triggers/manual_trigger.ts`

**5. Test locally**

```bash
slack run
```

Select "Create a new app" and your workspace. Create the manual trigger when prompted.

Invite the app to the channel:

```
/invite @Emojiboard
```

Paste the shortcut link in the channel and click "Start Workflow" to test.

**6. Deploy**

```bash
slack deploy
```

Select `triggers/weekly_friday_trigger.ts` when prompted for a trigger.

Invite the app to the channel:

```
/invite @Emojiboard
```

---

## Configuration

### Change time or day

Edit `triggers/weekly_friday_trigger.ts`:

```typescript
schedule: {
  start_time: "2026-03-27T15:00:00Z",  // Must be a future date
  timezone: "Europe/Stockholm",
  frequency: {
    type: "weekly",
    repeats_every: 1,
    on_days: ["Friday"],  // Change day here
  },
},
```

Then update the trigger:

```bash
slack trigger update --trigger-id YOUR_TRIGGER_ID --trigger-def triggers/weekly_friday_trigger.ts
```

### Change channel

Update `value` in the trigger file with the new channel ID and run `slack trigger update`.

---

## Development

### Run tests

```bash
deno task test
```

### Project structure

```
slack-emojiboard/
├── manifest.ts               # App manifest
├── deno.jsonc                 # Deno config
├── datastores/
│   └── emoji_snapshot.ts      # Datastore for emoji snapshots
├── functions/
│   ├── find_new_emojis.ts     # Core logic
│   └── find_new_emojis_test.ts
├── workflows/
│   └── weekly_emoji_report.ts # Workflow definition
└── triggers/
    ├── weekly_friday_trigger.ts  # Friday schedule
    └── manual_trigger.ts         # Manual testing
```

---

## License

MIT
