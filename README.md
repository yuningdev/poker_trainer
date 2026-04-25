# Poker Trainer

德州撲克遊戲，支援兩種遊玩模式：
- **終端機模式** — 純 Python，在 terminal 直接遊玩
- **網頁模式** — React 前端 + FastAPI WebSocket 後端，在瀏覽器遊玩

---

## Preconditions 環境需求

### Python 後端：只需安裝 `uv`

`uv` 會自動管理 Python 3.12 與所有後端套件，**不需要事先安裝 Python**。

**macOS / Linux:**
```bash
curl -LsSf https://astral.sh/uv/install.sh | sh
source $HOME/.local/bin/env
```

**Windows (PowerShell):**
```powershell
powershell -ExecutionPolicy ByPass -c "irm https://astral.sh/uv/install.ps1 | iex"
$env:Path = [System.Environment]::GetEnvironmentVariable("Path","User")
```

### React 前端：需要 Node.js ≥ 20.19

```bash
# 確認版本
node --version   # 需要 v20.19.0 以上

# 若尚未安裝，建議用 nvm：
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
nvm install 20
nvm use 20
```

> 只想玩**終端機模式**的話，不需要 Node.js。

---

## Quick Start

### 終端機模式

```bash
git clone git@github.com:yuningdev/poker_trainer.git
cd poker_trainer
uv sync
uv run poker
```

### 網頁模式

```bash
# Terminal 1 — 後端
uv sync
uv run uvicorn backend.main:app --reload --port 8000

# Terminal 2 — 前端
cd frontend
npm install
npm run dev
```

開啟瀏覽器 → `http://localhost:5173`

---

## Quick Reference

| 指令 | 說明 |
|------|------|
| `uv run poker` | 終端機模式遊玩 |
| `uv run uvicorn backend.main:app --reload --port 8000` | 啟動 WebSocket 後端 |
| `cd frontend && npm run dev` | 啟動 React 前端（開發模式） |
| `cd frontend && npm run build` | 建構前端生產版本 |
| `uv run pytest -v` | 執行後端測試 |
| `uv run python simulate.py` | 執行 AI 模擬並產生報告 |
| `uv sync` | 重新安裝後端套件 |

---

## Players & Strategies

可在 `poker_trainer/__main__.py`（終端機）或 `frontend/src/App.tsx`（網頁）調整玩家設定：

| 類型 | 說明 |
|------|------|
| `human` | 你（終端機讀取輸入 / 網頁讀取按鈕） |
| `aggressive` | 加注 75%，大幅加注（2× 至全押） |
| `passive` | 跟注/過牌 75%，小額加注 |
| `random` | 隨機均勻選擇所有合法行動 |

---

## Project Structure

```
poker_trainer/
├── pyproject.toml               ← uv 套件設定（rich, fastapi, uvicorn）
├── .python-version              ← Python 3.12
├── simulate.py                  ← AI 模擬腳本
│
├── poker_trainer/               ← 核心遊戲引擎（Python）
│   ├── cards/                   ← Card, Deck, HandEvaluator
│   ├── players/                 ← BasePlayer, HumanPlayer, BotPlayer
│   │   └── ws_human_player.py   ← WebSocket 版人類玩家
│   ├── strategies/              ← Random / Passive / Aggressive
│   ├── engine/                  ← Dealer, Pot, Table, Game
│   └── ui/                      ← Renderer（終端機輸出）
│
├── backend/                     ← FastAPI WebSocket 伺服器
│   ├── main.py                  ← /ws endpoint
│   ├── session.py               ← GameSession（執行緒橋接）
│   ├── serializer.py            ← 引擎物件 → JSON
│   └── ws_renderer.py           ← Renderer → asyncio.Queue
│
├── frontend/                    ← React + Vite + Tailwind
│   └── src/
│       ├── types.ts             ← WS 協定型別定義
│       ├── store/gameStore.ts   ← Zustand 狀態管理
│       ├── hooks/usePokerSocket.ts
│       └── components/          ← GameTable, PlayerSeat, Card, ActionPanel…
│
├── .claude/agents/
│   ├── frontend-engineer.md     ← React 前端 Agent 指令
│   └── backend-engineer.md      ← Python 後端 Agent 指令
│
└── tests/                       ← pytest 測試套件
```

---

## Design Patterns

| 模式 | 說明 |
|------|------|
| **Strategy** | `BotPlayer` 委派決策給可替換的 `BettingStrategy` |
| **Factory** | `PlayerFactory.create(type, name, chips)` 解耦設定與實作 |
| **Template Method** | `Game._play_hand()` 定義固定手牌骨架，各階段可覆寫 |
| **Value Object** | `Card`、`GameState` 為 frozen dataclass，策略無法竄改狀態 |
| **Thread Bridge** | `WsHumanPlayer` 用 `threading.Event` 讓同步引擎與 asyncio 共存 |

---

## Running Tests

```bash
uv run pytest -v
```

---

## Adding a New AI Strategy

1. 建立 `poker_trainer/strategies/my_strategy.py`，繼承 `BettingStrategy`
2. 在 `poker_trainer/players/player_factory.py` 的 `_STRATEGY_MAP` 加一行
3. 在 `__main__.py` 或 `frontend/src/App.tsx` 的設定中使用新類型名稱

---

## Troubleshooting

**`uv: command not found`**
```bash
source $HOME/.local/bin/env  # macOS/Linux
```

**`Permission denied` on macOS**
```bash
chmod +x $HOME/.local/bin/uv
```

**前端出現 `Cannot find native binding`（Node 版本過舊）**
```bash
nvm install 20 && nvm use 20
cd frontend && rm -rf node_modules && npm install
```

**WebSocket 連不上後端**
確認後端已啟動在 port 8000，且 `frontend/vite.config.ts` 的 proxy 設定正確。
