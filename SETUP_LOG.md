# Cogito Setup Log

**Цель:** Документировать путь от `git clone` до полностью работающей системы.
**Зачем:** Чтобы в будущем сделать "всё работает из коробки".

---

## Базовая установка

### 1. Клонирование репозитория
```bash
git clone https://github.com/AskMeAgain/clawdbot ~/projects/cogito-by-clawdbot-
cd ~/projects/cogito-by-clawdbot-
pnpm install
pnpm build
```

### 2. Создание конфига
```bash
mkdir -p ~/.clawdbot
# Создать ~/.clawdbot/clawdbot.json (см. шаблон ниже)
```

### 3. Настройка Bedrock Proxy
**Зачем:** Anthropic API → AWS Bedrock (экономия, свой аккаунт)

```bash
# AWS профиль
aws configure --profile bedrock-clawdis

# Запуск proxy
pnpm tsx src/infra/bedrock-proxy.ts
# Порт: 18794
```

### 4. Запуск Gateway
```bash
source ~/.zshenv  # Для Twitter credentials
pnpm clawdbot gateway --bind tailnet
```

---

## Кастомизации

### 2026-01-13: Начальная настройка

#### Bedrock вместо Anthropic OAuth
**Проблема:** Rate limits на Anthropic OAuth
**Решение:** Локальный Bedrock proxy

```json
// ~/.clawdbot/clawdbot.json
{
  "models": {
    "providers": {
      "bedrock": {
        "baseUrl": "http://127.0.0.1:18794",
        "apiKey": "dummy",
        "api": "anthropic-messages"
      }
    }
  },
  "agents": {
    "defaults": {
      "model": { "primary": "bedrock/claude-sonnet-4-5" }
    }
  }
}
```

#### Gateway bind для Tailscale
**Проблема:** Cron tool не мог подключиться к gateway (ошибка 1006)
**Причина:** CLI запускался с `--bind tailnet`, но конфиг не имел `bind`
**Решение:** Добавить в конфиг

```json
"gateway": {
  "bind": "tailnet"  // ВАЖНО: должен совпадать с --bind флагом!
}
```

#### Bird (Twitter) skill
**Проблема:** Бот не использовал bird CLI для Twitter ссылок
**Причина:** Описание скилла слишком общее
**Решение:** Добавить инструкции в AGENTS.md

```markdown
## URL Handling Rules
### Twitter/X Links
When user sends Twitter/X URL → run `bird read <url>`
```

**Требуется:** env vars `AUTH_TOKEN` и `CT0` (Twitter cookies в ~/.zshenv)

#### Obsidian skill
**Настройка:**
```json
"skills": {
  "entries": {
    "obsidian": {
      "enabled": true,
      "vaultPath": "/Users/mac-mini-server/obsidian_cogito_main"
    }
  }
}
```

#### AGENTS.md — кастомные инструкции
**Файл:** `~/.clawdbot/agents/main/workspace/AGENTS.md`

Добавлено:
- Twitter URL handling rules
- Cron job examples и формат
- Obsidian paths
- Skills quick reference

#### Cron jobs документация
**Проблема:** Бот не знал формат cron tool
**Решение:** Добавить примеры в AGENTS.md с полным JSON форматом

#### WhatsApp History (whatsapp-mcp)
**Зачем:** Читать историю WhatsApp групп, делать сводки
**Решение:** Интеграция whatsapp-mcp (Go bridge + SQLite)

**Установка:**
```bash
# 1. Установить Go
brew install go

# 2. Клонировать и собрать (используем PR #139 с фиксами)
cd ~/projects
git clone https://github.com/lharries/whatsapp-mcp.git
cd whatsapp-mcp
git fetch origin pull/139/head:pr-139
git checkout pr-139
cd whatsapp-bridge
go build -o whatsapp-bridge .

# 3. Запустить и отсканировать QR
./whatsapp-bridge
# WhatsApp → Settings → Linked Devices → Link a Device
```

**Файлы:**
- Service: `~/services/whatsapp-bridge/whatsapp-bridge`
- База: `~/services/whatsapp-bridge/store/messages.db`
- Логи: `~/services/whatsapp-bridge/stdout.log`
- Skill: `~/.clawdbot/skills/whatsapp-history/SKILL.md`
- Launchd: `~/Library/LaunchAgents/com.cogito.whatsapp-bridge.plist`

**Автозапуск (launchd):**
```bash
# Проверить статус
launchctl list | grep whatsapp

# Перезапустить
launchctl stop com.cogito.whatsapp-bridge
launchctl start com.cogito.whatsapp-bridge

# Отключить автозапуск
launchctl unload ~/Library/LaunchAgents/com.cogito.whatsapp-bridge.plist
```

**Конфиг:**
```json
"skills": {
  "entries": {
    "whatsapp-history": { "enabled": true }
  }
}
```

**Использование:**
```bash
# Список групп
sqlite3 ~/services/whatsapp-bridge/store/messages.db \
  "SELECT jid, name FROM chats WHERE jid LIKE '%@g.us';"

# Сообщения из группы
sqlite3 ~/services/whatsapp-bridge/store/messages.db \
  "SELECT datetime(timestamp), sender, content FROM messages WHERE chat_jid = 'GROUP_JID' ORDER BY timestamp DESC LIMIT 50;"
```

**Важно:** Bridge запускается автоматически при загрузке системы.

#### Telegram Groups
**Зачем:** Бот участвует в Telegram группах, отвечает на @mentions

**Настройка BotFather (ОБЯЗАТЕЛЬНО!):**
1. Открыть @BotFather в Telegram
2. `/mybots` → выбрать бота (@sleoagent_bot)
3. **Bot Settings** → **Group Privacy** → **Turn off**

**ВАЖНО:** Без отключения Privacy Mode бот НЕ видит сообщения в группах!

**Конфиг:**
```json
"telegram": {
  "groupPolicy": "allowlist",
  "groupAllowFrom": [48983],
  "groups": {
    "*": {
      "requireMention": true
    }
  }
},
"messages": {
  "groupChat": {
    "mentionPatterns": [
      "\\bcogito\\b",
      "\\bкогита\\b"
    ]
  }
},
"agents": {
  "defaults": {
    "identity": {
      "name": "Cogito"
    }
  }
}
```

**Параметры:**
- `groupAllowFrom` — ID пользователей, которые могут триггерить бота
- `requireMention: true` — бот отвечает только на @mention
- `mentionPatterns` — regex паттерны для альтернативных имён

**Использование:**
- `@sleoagent_bot привет` — прямое упоминание
- `Cogito, что нового?` — по имени (из mentionPatterns)
- **Reply на сообщение бота** — без @mention, бот поймёт что это ему!

**Код изменён:** `src/telegram/bot.ts` — добавлена проверка `isReplyToBot`:
```typescript
const botId = primaryCtx.me?.id;
const isReplyToBot = Boolean(
  botId && msg.reply_to_message?.from?.id === botId,
);
```

#### Отправка сообщений в группу из личного диалога
**Зачем:** Настраивать бота из DM, а он отправляет в группу (например, cron briefings)

**Как работает:**
- Бот использует tool `telegram` с action `sendMessage` и параметром `to` = chat_id
- Это работает из ЛЮБОЙ сессии (DM, группа, cron job)

**ВАЖНО: Формат chat_id для групп:**
```
Личные чаты:  48983          (положительные числа)
Группы:      -5168685645     (отрицательные числа, с минусом!)
Supergroups: -1001234567890  (начинаются с -100)
```

**Gotcha:** При копировании ID из Telegram интерфейса минус НЕ копируется!
- Скопировал: `5168685645`
- Нужно: `-5168685645`

**Cron job пример (отправка в группу):**
```json
{
  "payload": {
    "kind": "agentTurn",
    "message": "Сделай утренний брифинг",
    "deliver": true,
    "provider": "telegram",
    "to": "-5168685645"
  }
}
```

**Как узнать правильный chat_id группы:**
1. Остановить бота: `pkill -f "gateway --bind tailnet"`
2. Написать что-то в группу
3. Получить updates:
```bash
curl -s "https://api.telegram.org/bot<TOKEN>/getUpdates" | python3 -c "
import json, sys
for u in json.load(sys.stdin).get('result', []):
    chat = (u.get('message') or {}).get('chat', {})
    if chat: print(f\"{chat.get('id')} | {chat.get('type')} | {chat.get('title', 'DM')}\")
"
```
4. Запустить бота обратно

### 2026-01-14: PDF/Image Tools

**Зачем:** nano-pdf и другие skills требуют CLI утилиты для работы с PDF/изображениями

**Установка:**
```bash
brew install imagemagick ghostscript poppler
pip3 install Pillow
```

**Проверка:**
```bash
which pdftotext convert gs  # Должны все найтись
pip3 show Pillow
```

**Компоненты:**
| Пакет | Команды | Назначение |
|-------|---------|------------|
| poppler | `pdftotext`, `pdfinfo`, `pdftoppm` | PDF → текст/изображения |
| ImageMagick | `magick`, `convert` | Манипуляции с изображениями |
| Ghostscript | `gs` | PDF рендеринг для ImageMagick |
| Pillow | Python PIL | Image processing в Python |

### 2026-01-14: Telegram deleteMessage (PR создан!)

**Зачем:** Бот не мог удалять сообщения в группах

**PR:** https://github.com/clawdbot/clawdbot/pull/903

**Изменения (7 файлов):**
1. `src/telegram/send.ts` — функция `deleteMessageTelegram()`
2. `src/agents/tools/telegram-schema.ts` — схема `deleteMessage` action
3. `src/agents/tools/telegram-actions.ts` — handler для `telegram` tool
4. `src/agents/tools/telegram-tool.ts` — обновлено описание tool
5. `src/config/types.ts` — тип `deleteMessage?: boolean`
6. `src/providers/plugins/actions/telegram.ts` — **handler для `message` tool** (это был ключевой файл!)
7. `src/agents/tools/message-tool.ts` — обновлено описание чтобы модель знала про delete

**Важно:** Бот использует generic `message` tool, а не прямой `telegram` tool!
Поэтому нужно было добавить handler в `telegramMessageActions` plugin adapter.

**Использование ботом:**
```json
{
  "tool": "message",
  "action": "delete",
  "chatId": "-1003582966739",
  "messageId": "12345"
}
```

**Конфиг для включения:**
```json
"telegram": {
  "actions": {
    "deleteMessage": true
  }
}
```

**Примечание:** По умолчанию deleteMessage включён (action gate возвращает true для незаданных actions).

**Ограничения Telegram API:**
- Бот удаляет свои сообщения в любом чате
- Чужие сообщения — только если бот админ с правом "Delete Messages"
- Сообщения старше 48ч в группах могут не удаляться

### 2026-01-14: Whisper small model

**Зачем:** Лучшее качество транскрипции, особенно для русского языка

**Файл:** `~/.clawdbot/transcribe.sh`

**Изменение:**
```bash
# Было:
/opt/homebrew/bin/whisper-cli -m ~/.whisper/ggml-base.bin ...

# Стало:
/opt/homebrew/bin/whisper-cli -m ~/.whisper/ggml-small.bin ...
```

**Размеры моделей:**
| Модель | Параметры | Размер | Качество |
|--------|-----------|--------|----------|
| base | 74M | 141MB | Базовое |
| small | 244M | 465MB | Хорошее (русский!) |
| medium | 769M | 1.5GB | Отличное |

### 2026-01-14: Opus 4.5 с fallback на Sonnet

**Зачем:** Opus умнее, глубже рассуждает — лучше для персонального ассистента.
При недоступности Opus (rate limit, 503) автоматически переключается на Sonnet.

**Конфиг:**
```json
"agents": {
  "defaults": {
    "model": {
      "primary": "bedrock/claude-opus-4-5",
      "fallbacks": ["bedrock/claude-sonnet-4-5"]
    },
    "models": {
      "bedrock/claude-opus-4-5": { "alias": "Opus" },
      "bedrock/claude-sonnet-4-5": { "alias": "Sonnet" }
    }
  }
}
```

**Bedrock proxy: динамический выбор модели**

Proxy теперь читает модель из запроса (не хардкодит):

```typescript
// src/infra/bedrock-proxy.ts
const MODEL_MAP: Record<string, string> = {
  "claude-opus-4-5": "us.anthropic.claude-opus-4-5-20251101-v1:0",
  "claude-sonnet-4-5": "us.anthropic.claude-sonnet-4-5-20251022-v1:0",
  "claude-sonnet-4": "us.anthropic.claude-sonnet-4-20250514-v1:0",
  "claude-haiku-4-5": "us.anthropic.claude-haiku-4-5-20251015-v1:0",
};
```

**Как работает fallback (src/agents/model-fallback.ts):**
1. Пробует primary модель
2. При failover-ошибках (rate limit, 503) → следующая из fallbacks
3. При других ошибках (invalid request) → бросает исключение

**Сравнение:**
| | Sonnet 4.5 | Opus 4.5 |
|---|---|---|
| Скорость | Быстрее | Медленнее |
| Качество | Хорошее | Отличное |
| Цена | ~$3/1M input | ~$15/1M input |
| Для | Продакшн, API | Персональный ассистент |

### 2026-01-14: Группа без requireMention

**Зачем:** Бот должен видеть все сообщения в группе, не только @mentions

**Конфиг:**
```json
"channels": {
  "telegram": {
    "groups": {
      "-1003582966739": {
        "requireMention": false
      },
      "*": {
        "requireMention": true
      }
    }
  }
}
```

**Поведение:**
- `requireMention: false` — бот видит ВСЕ сообщения в группе
- Но отвечает только когда:
  - Упоминают по имени (mentionPatterns: "cogito", "когито")
  - Reply на его сообщение
  - Прямой @mention
- Это позволяет боту "слушать" контекст разговора

### 2026-01-14: Forwarded Messages

**Зачем:** Бот не знал откуда пересланное сообщение

**Проблема:**
Когда кто-то пересылает сообщение боту, он видел только текст, но не знал:
- Кто отправил оригинал
- Из какого чата/канала
- Когда было оригинальное сообщение

**Решение (локальные изменения в форке):**

1. **Новая функция** `describeForwardOrigin()` в `src/telegram/bot/helpers.ts`:
   - Поддержка нового API (`forward_origin`)
   - Поддержка legacy API (`forward_from`, `forward_from_chat`)
   - Извлекает: источник, время

2. **Обновлён** `src/telegram/bot-message-context.ts`:
   - Forward info добавляется в начало сообщения
   - Новые поля в payload: `ForwardedFrom`, `ForwardedDate`

**Как выглядит для бота:**
```
[Forwarded from Иван Петров (@ivanpetrov) at 2026-01-14T10:30:00.000Z]
Текст пересланного сообщения здесь
```

**Context payload:**
```json
{
  "ForwardedFrom": "Иван Петров (@ivanpetrov)",
  "ForwardedDate": 1736849400000
}
```

### 2026-01-14: PR #906 — Group Migration Handler

**Зачем:** Когда обычная группа становится supergroup, chat_id меняется

**Проблема:**
- Telegram мигрирует группу при включении топиков или при большом количестве участников
- Старый ID (например `-5168685645`) становится недействительным
- Новый ID имеет формат `-100XXXXXXXXXX`

**Решение (PR в upstream):**

Добавлен handler в `src/telegram/bot-handlers.ts`:
```typescript
bot.on("message:migrate_to_chat_id", async (ctx) => {
  const oldChatId = String(ctx.message.chat.id);
  const newChatId = String(ctx.message.migrate_to_chat_id);
  // Автоматически обновляет конфиг
});
```

**Что делает:**
1. Слушает событие `migrate_to_chat_id`
2. Находит старый ID в `channels.telegram.groups`
3. Переносит конфиг на новый ID
4. Сохраняет конфиг автоматически

**PR:** https://github.com/clawdbot/clawdbot/pull/906

### 2026-01-14: Fix Cron Job Group ID

**Проблема:** Cron job "Morning Briefing" падал с ошибкой "chat not found"

**Причина:**
В `~/.clawdbot/cron/jobs.json` было:
```json
{
  "message": "...Отправь в Telegram группу -5168685645",
  "to": "-1003582966739"
}
```
Бот извлекал ID из текста сообщения (старый), игнорируя поле `to` (правильный)!

**Решение:**
```json
{
  "message": "...Отправь результат в Telegram.",
  "to": "-1003582966739"
}
```

**Урок:** Не включать конкретные ID в текст промпта для агента.

### 2026-01-15: Browser + Google Places (local-places + goplaces)

**Браузер (Chrome/CDP):**
- Установлен Google Chrome, браузерный control server поднят.
- В конфиге добавлено:
```json
"browser": {
  "enabled": true,
  "executablePath": "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
}
```

**Google Places (оба варианта):**
- Установлен `goplaces` (CLI).
- Установлен `local-places` (FastAPI на localhost).
- В конфиге добавлено:
```json
"skills": {
  "entries": {
    "local-places": { "enabled": true, "apiKey": "<GOOGLE_PLACES_API_KEY>" },
    "goplaces": { "enabled": true, "apiKey": "<GOOGLE_PLACES_API_KEY>" }
  }
}
```
**Env vars (global):**
```json
"env": {
  "vars": { "GOOGLE_PLACES_API_KEY": "<GOOGLE_PLACES_API_KEY>" }
}
```

**Автозапуск local-places:**
- LaunchAgent: `~/Library/LaunchAgents/com.cogito.local-places.plist`
- Логи: `~/.clawdbot/skills/local-places/local-places.launchd.log`

---

## Текущая конфигурация

### Файлы

| Файл | Назначение |
|------|------------|
| `~/.clawdbot/clawdbot.json` | Главный конфиг |
| `~/.clawdbot/agents/main/workspace/AGENTS.md` | Кастомные инструкции |
| `~/.clawdbot/agents/main/workspace/HEARTBEAT.md` | Ритуалы по расписанию |
| `~/.clawdbot/cron/jobs.json` | Cron задачи |
| `~/.zshenv` | Twitter credentials |

### Включённые skills
- [x] bird (Twitter)
- [x] obsidian
- [x] apple-reminders
- [x] whatsapp-history (SQLite queries)
- [x] nano-banana-pro (Gemini image generation, платный ключ)
- [x] nano-pdf (PDF editing, использует Gemini)
- [x] sonoscli (управление Sonos колонками)
- [x] spotify-player

### Порты
- 18789 — Gateway
- 18794 — Bedrock Proxy

### Tailscale IPs
- Mac Mini: 100.111.22.79
- MacBook: 100.67.52.93

---

## TODO: Сделать "из коробки"

- [ ] Скрипт первоначальной настройки (`setup.sh`)
- [ ] Шаблон clawdbot.json с комментариями
- [ ] Автозапуск bedrock-proxy и gateway (launchd)
- [ ] Документация по получению Twitter cookies
- [ ] Health check endpoint

---

## Логи изменений

| Дата | Что сделано | Почему |
|------|-------------|--------|
| 2026-01-13 | Bedrock proxy setup | Rate limits на OAuth |
| 2026-01-13 | Gateway bind: tailnet | Cron не работал |
| 2026-01-13 | AGENTS.md: Twitter rules | Bird не срабатывал |
| 2026-01-13 | AGENTS.md: Cron examples | Бот не знал формат |
| 2026-01-13 | Obsidian skill config | Vault path |
| 2026-01-13 | WhatsApp History skill | Читать историю групп |
| 2026-01-13 | Telegram Groups | Бот в группах по @mention |
| 2026-01-13 | Reply-to-bot detection | Reply без @mention работает |
| 2026-01-14 | Timezone: Asia/Jerusalem | Бот показывал неправильное время |
| 2026-01-14 | Group chat_id fix | Минус в ID группы не копировался из Telegram |
| 2026-01-14 | Документация: chat_id формат | Gotcha про минус в group IDs |
| 2026-01-14 | Whisper: base → small | Лучшее качество транскрипции (особенно русский) |
| 2026-01-14 | groupAllowFrom: +жена | Добавлен user ID 3790902 |
| 2026-01-14 | ImageMagick + Ghostscript | PDF/image манипуляции для nano-pdf |
| 2026-01-14 | Gemini API key: paid | Исправлена квота для image generation |
| 2026-01-14 | **Telegram deleteMessage** | PR #903 создан в upstream! |
| 2026-01-14 | message tool: delete action | Ключевой handler в plugins/actions/telegram.ts |
| 2026-01-14 | Bedrock proxy: dynamic models | Модель читается из запроса, не хардкодится |
| 2026-01-14 | Model fallback system | Opus → Sonnet при недоступности |
| 2026-01-14 | Model: Sonnet → Opus 4.5 | Умнее для персонального ассистента |
| 2026-01-14 | Group chat_id migration | -5168685645 → -1003582966739 (supergroup) |
| 2026-01-14 | requireMention: false | Группа -1003582966739 слушает весь чат |
| 2026-01-14 | **Forwarded messages** | Локальная фича: бот видит источник пересланных |
| 2026-01-14 | PR #906: Group migration | PR в upstream: авто-обновление ID при миграции |
| 2026-01-15 | Browser tool (Chrome/CDP) | Включен clawd browser через Google Chrome |
| 2026-01-15 | Google Places (local-places + goplaces) | Поиск мест через API и CLI |
| 2026-01-15 | LaunchAgent: local-places | Автостарт FastAPI сервера |
| 2026-01-15 | **MEMORY.md persistence** | Исправлена проблема с повторными поздравлениями |

### 2026-01-15: MEMORY.md — Persistent Agent Memory

**Проблема:** Бот поздравил с днём рождения 7+ раз за день.

**Причина:**
- Каждый heartbeat создаёт НОВУЮ изолированную сессию
- Сессии НЕ видят историю друг друга
- Файл MEMORY.md не существовал (ENOENT в логах)
- `memory_search` tool — это отдельный инструмент, не связанный с файлом

**Решение:**
1. Создан `MEMORY.md` в workspace агента
2. Добавлена инструкция в AGENTS.md: **ОБЯЗАТЕЛЬНО** читать MEMORY.md при старте каждой сессии
3. После выполнения одноразовых действий — сразу записывать в MEMORY.md

**Файлы:**
- `~/.clawdbot/agents/main/workspace/MEMORY.md` — персистентная память
- `~/.clawdbot/agents/main/workspace/AGENTS.md` — добавлена секция "Session Startup (CRITICAL!)"

**Логика:**
```
Heartbeat → Читать MEMORY.md → Проверить дату →
→ Если событие уже выполнено сегодня → НЕ повторять
→ Если событие новое → Выполнить → Записать в MEMORY.md
```

**Урок:** clawdbot не имеет встроенной системы персистентной памяти о событиях.
Каждая сессия начинается "с чистого листа". Нужно явно использовать файлы в workspace.

---

## Шаблон конфига

<details>
<summary>~/.clawdbot/clawdbot.json (полный)</summary>

```json
{
  "models": {
    "mode": "merge",
    "providers": {
      "bedrock": {
        "baseUrl": "http://127.0.0.1:18794",
        "apiKey": "dummy",
        "api": "anthropic-messages",
        "authHeader": false,
        "models": [
          {
            "id": "claude-opus-4-5",
            "name": "Claude Opus 4.5 (Bedrock)",
            "contextWindow": 200000,
            "maxTokens": 16384
          },
          {
            "id": "claude-sonnet-4-5",
            "name": "Claude Sonnet 4.5 (Bedrock)",
            "contextWindow": 200000,
            "maxTokens": 16384
          }
        ]
      }
    }
  },
  "agents": {
    "defaults": {
      "workspace": "~/.clawdbot/agents/main/workspace",
      "model": {
        "primary": "bedrock/claude-opus-4-5",
        "fallbacks": ["bedrock/claude-sonnet-4-5"]
      },
      "models": {
        "bedrock/claude-opus-4-5": { "alias": "Opus" },
        "bedrock/claude-sonnet-4-5": { "alias": "Sonnet" }
      },
      "userTimezone": "Asia/Jerusalem"
    }
  },
  "gateway": {
    "mode": "local",
    "bind": "auto",
    "auth": {
      "token": "<generate-random-token>",
      "allowTailscale": true
    }
  },
  "channels": {
    "telegram": {
      "enabled": true,
      "botToken": "<your-bot-token>",
      "dmPolicy": "pairing",
      "groupPolicy": "open",
      "groups": {
        "-1003582966739": { "requireMention": false },
        "*": { "requireMention": true }
      }
    }
  },
  "talk": {
    "modelId": "eleven_v3",
    "apiKey": "<elevenlabs-api-key>"
  },
  "skills": {
    "entries": {
      "bird": { "enabled": true },
      "obsidian": {
        "enabled": true,
        "vaultPath": "/path/to/vault"
      }
    }
  }
}
```

</details>
