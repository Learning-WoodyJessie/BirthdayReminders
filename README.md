# BirthdayReminders

Never forget a birthday or anniversary again. Runs daily via GitHub Actions, uses Claude to write personalised messages, and delivers via WhatsApp.

## How it works

1. You maintain `data/people.yaml` with names, dates, and notes
2. GitHub Actions runs every morning and sends you a WhatsApp digest of upcoming events (7 days, 3 days, day-of)
3. On the actual day, it also sends a direct message to the person and/or posts to WhatsApp groups

---

## Setup

### 1. Fork / clone this repo
```bash
git clone https://github.com/PBAILearning/BirthdayReminders.git
cd BirthdayReminders
pip install -r requirements.txt
```

### 2. WhatsApp Cloud API (Meta)

1. Go to [developers.facebook.com](https://developers.facebook.com) → Create App → Business
2. Add the **WhatsApp** product
3. Under *WhatsApp > API Setup*, note your:
   - **Phone Number ID**
   - **Temporary access token** (generate a permanent one for production — see [Meta docs](https://developers.facebook.com/docs/whatsapp/business-management-api/get-started))
4. Add your own number as a test recipient

**To get WhatsApp Group IDs:**
```bash
curl -X GET \
  "https://graph.facebook.com/v19.0/{PHONE_NUMBER_ID}/groups" \
  -H "Authorization: Bearer {ACCESS_TOKEN}"
```
Copy the group IDs into `data/people.yaml` under `groups:`.

### 3. OpenAI API key
Get one at [platform.openai.com/api-keys](https://platform.openai.com/api-keys).

### 4. GitHub Secrets
In your repo → *Settings → Secrets and variables → Actions*, add:

| Secret | Value |
|---|---|
| `OPENAI_API_KEY` | Your OpenAI key |
| `WHATSAPP_ACCESS_TOKEN` | Meta permanent access token |
| `WHATSAPP_PHONE_NUMBER_ID` | From Meta API Setup |
| `MY_WHATSAPP` | Your number e.g. `+14155552671` |

### 5. Add your contacts
```bash
python scripts/add_person.py
```
Or edit `data/people.yaml` directly.

### 6. Preview upcoming events (no messages sent)
```bash
python scripts/list_upcoming.py        # next 30 days
python scripts/list_upcoming.py 90     # next 90 days
```

### 7. Test locally
```bash
export ANTHROPIC_API_KEY=...
export WHATSAPP_ACCESS_TOKEN=...
export WHATSAPP_PHONE_NUMBER_ID=...
export MY_WHATSAPP=+1...
python scripts/check_reminders.py
```

---

## Adjust reminder timing

Edit `config.yaml`:
```yaml
reminder_days: [7, 3, 0]   # 7 days out, 3 days out, day-of
```

## Adjust cron schedule

Edit `.github/workflows/daily_reminder.yml`:
```yaml
cron: "0 8 * * *"   # 8:00 AM UTC — change to your preferred time
```
Use [crontab.guru](https://crontab.guru) to find your timezone offset.

---

## Project structure
```
BirthdayReminders/
├── CLAUDE.md                        # AI context for maintenance
├── data/
│   └── people.yaml                  # Your contacts
├── scripts/
│   ├── check_reminders.py           # Daily runner
│   ├── add_person.py                # Add a new person (interactive)
│   └── list_upcoming.py             # Preview upcoming events
├── config.yaml                      # Reminder windows
├── requirements.txt
└── .github/workflows/
    └── daily_reminder.yml           # GitHub Actions cron
```
