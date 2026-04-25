# Poker Trainer 程式碼架構解析

> 德州撲克遊戲，包含終端機模式與 React + FastAPI 網頁模式，從設計模式到模組分工，完整說明。

---

## 目錄

1. [專案總覽](#1-專案總覽)
2. [資料夾結構](#2-資料夾結構)
3. [核心設計模式](#3-核心設計模式)
4. [模組逐層解析](#4-模組逐層解析)
   - [utils — 共用常數](#41-utils--共用常數)
   - [cards — 牌組與牌型判定](#42-cards--牌組與牌型判定)
   - [players — 玩家層級體系](#43-players--玩家層級體系)
   - [strategies — 下注策略](#44-strategies--下注策略)
   - [engine — 遊戲引擎](#45-engine--遊戲引擎)
   - [ui — 終端機介面](#46-ui--終端機介面)
5. [Web 層架構](#5-web-層架構)
   - [Thread Bridge 模式](#51-thread-bridge-模式)
   - [backend — FastAPI WebSocket](#52-backend--fastapi-websocket)
   - [frontend — React 應用程式](#53-frontend--react-應用程式)
   - [WebSocket 訊息協定](#54-websocket-訊息協定)
6. [資料流與呼叫鏈](#6-資料流與呼叫鏈)
7. [關鍵設計決策](#7-關鍵設計決策)
8. [擴充性說明](#8-擴充性說明)

---

## 1. 專案總覽

Poker Trainer 是一個德州撲克（Texas Hold'em）遊戲，支援兩種遊玩模式：

- **終端機模式** — 純 Python，使用 `rich` 渲染，以 stdin 互動
- **網頁模式** — React 前端透過 WebSocket 與 FastAPI 後端即時溝通

整個專案的三個設計目標：

- **可擴充** — 新增 AI 策略只需寫一個 Class，不需動其他程式碼
- **關注點分離** — 遊戲引擎、渲染介面、玩家決策三者互不耦合
- **可測試** — 核心模組完全不依賴 I/O，可直接單元測試

**核心原則：引擎永遠不變。** 無論終端機模式還是網頁模式，`Game`、`Dealer`、`Table`、`Pot` 這些類別的程式碼一行都沒有改動。所有擴充都透過繼承或替換外層包裝完成。

---

## 2. 資料夾結構

```
poker_trainer/                    ← 專案根目錄
│
├── pyproject.toml                ← uv 套件設定（rich, fastapi, uvicorn）
├── .python-version               ← Python 版本鎖定（3.12）
├── README.md
├── USER_GUIDE.md                 ← 中英文使用手冊
├── ARCHITECTURE.md               ← 本文件
├── simulate.py                   ← 模擬腳本（產生 markdown 報告）
│
├── poker_trainer/                ← 核心遊戲引擎套件（終端機 + 網頁共用）
│   ├── __init__.py
│   ├── __main__.py               ← 終端機進入點（uv run poker）
│   │
│   ├── utils/
│   │   └── constants.py          ← 所有 Enum：Suit, Rank, Action, Phase, HandRank
│   │
│   ├── cards/
│   │   ├── card.py               ← Card 值物件（frozen dataclass）
│   │   ├── deck.py               ← Deck 牌組（shuffle/deal/burn）
│   │   └── hand_evaluator.py     ← 最佳 5 of 7 牌型判定器
│   │
│   ├── players/
│   │   ├── base_player.py        ← 抽象基底類別
│   │   ├── human_player.py       ← stdin 版人類玩家（終端機模式）
│   │   ├── ws_human_player.py    ← WebSocket 版人類玩家（網頁模式）
│   │   ├── bot_player.py         ← AI 玩家（委派 BettingStrategy）
│   │   └── player_factory.py     ← 工廠方法
│   │
│   ├── strategies/
│   │   ├── base_strategy.py      ← BettingStrategy ABC + GameState frozen dataclass
│   │   ├── random_strategy.py    ← 隨機策略
│   │   ├── passive_strategy.py   ← 保守策略
│   │   └── aggressive_strategy.py← 激進策略
│   │
│   ├── engine/
│   │   ├── dealer.py             ← 發牌者（唯一能碰牌組的物件）
│   │   ├── pot.py                ← 底池 + 邊池計算
│   │   ├── table.py              ← 牌桌狀態（座位、盲注、公共牌）
│   │   └── game.py               ← 遊戲主迴圈（Template Method）
│   │
│   └── ui/
│       └── renderer.py           ← 終端機渲染（rich）；所有 show_* 方法定義於此
│
├── backend/                      ← FastAPI WebSocket 伺服器
│   ├── __init__.py
│   ├── main.py                   ← FastAPI app + /ws endpoint
│   ├── session.py                ← GameSession（執行緒橋接 + 事件泵）
│   ├── serializer.py             ← 引擎物件 → JSON dict（無副作用）
│   └── ws_renderer.py            ← WsRenderer：show_* → asyncio.Queue
│
├── frontend/                     ← React + Vite + Tailwind CSS
│   ├── vite.config.ts            ← dev server proxy /ws → localhost:8000
│   └── src/
│       ├── types.ts              ← 完整 WS 協定 TypeScript 型別
│       ├── store/
│       │   └── gameStore.ts      ← Zustand store（單一狀態來源）
│       ├── hooks/
│       │   └── usePokerSocket.ts ← WebSocket 連線管理
│       └── components/
│           ├── App.tsx
│           ├── GameTable.tsx     ← 主佈局
│           ├── CommunityCards.tsx
│           ├── PlayerSeat.tsx
│           ├── Card.tsx          ← 單張牌元件
│           ├── ActionPanel.tsx   ← fold/check/call/raise 按鈕
│           ├── RaiseSlider.tsx   ← 加注金額滑桿
│           ├── ActionLog.tsx     ← 右側行動記錄
│           └── HandResultOverlay.tsx
│
├── .claude/agents/
│   ├── frontend-engineer.md      ← React 前端 Agent 指令
│   └── backend-engineer.md       ← Python 後端 Agent 指令
│
└── tests/
    ├── test_card.py
    ├── test_deck.py
    ├── test_hand_evaluator.py
    ├── test_strategies.py
    └── test_game.py
```

---

## 3. 核心設計模式

本專案共使用五種設計模式，每一種都對應一個具體的問題：

### 策略模式（Strategy Pattern）

**問題：** 不同 AI 玩家有截然不同的下注風格，若寫死在 `if/else` 裡，每次新增策略都需要修改玩家類別。

**解法：** 將「如何決策」抽取成獨立的 `BettingStrategy` 介面，`BotPlayer` 只持有策略的引用，決策時全權委派。

```
BotPlayer
  └── strategy: BettingStrategy   ← 注入於建構時
        ├── RandomStrategy
        ├── PassiveStrategy
        └── AggressiveStrategy
```

新增策略時，完全不需要動 `BotPlayer` 的程式碼。

---

### 工廠模式（Factory Pattern）

**問題：** 設定檔（`__main__.py` / `App.tsx`）需要根據字串（如 `"aggressive"`）建立玩家，若直接 `import` 具體類別，設定與實作就耦合在一起。

**解法：** `PlayerFactory.create("aggressive", "Alice", 1000)` 統一管理映射關係。

```python
_STRATEGY_MAP = {
    "random":     RandomStrategy,
    "passive":    PassiveStrategy,
    "aggressive": AggressiveStrategy,
}
```

---

### 樣板方法模式（Template Method Pattern）

**問題：** 每手牌的流程是固定的（盲注→發牌→翻牌前下注→翻牌→…→攤牌），但各階段的細節需要可替換。

**解法：** `Game._play_hand()` 定義不可更改的骨架，各階段實作可在子類別中覆寫。

```
Game._play_hand()
  ├── _post_blinds()
  ├── dealer.deal_hole_cards()
  ├── _betting_round()       ← 可被子類別覆寫
  ├── dealer.deal_flop/turn/river()
  └── _award_pot()
```

`simulate.py` 的 `ObservableGame` 就是繼承 `Game` 並覆寫 `_play_hand()`，在不動原始引擎的前提下插入錄製邏輯。

---

### 值物件模式（Value Object）

**問題：** 策略在決策時需要讀取遊戲狀態，但可變物件可能被有 bug 的策略意外篡改。

**解法：** `Card` 與 `GameState` 都是 `@dataclass(frozen=True)`，建立後完全不可變。

```python
@dataclass(frozen=True)
class GameState:
    community_cards: tuple
    pot_total: int
    current_bet: int
    legal_actions: tuple   # 由引擎預先計算，策略只能選擇，不能篡改
```

---

### Thread Bridge 模式（執行緒橋接）

**問題：** `Game.run()` 是同步阻塞迴圈，`HumanPlayer.decide()` 必須等待瀏覽器回應；但 FastAPI 跑在 asyncio，不能在 async handler 裡阻塞。

**解法：** 在 `WsHumanPlayer.decide()` 裡用 `threading.Event` 阻塞遊戲執行緒，由 asyncio 執行緒解除阻塞。（詳見 [5.1 Thread Bridge 模式](#51-thread-bridge-模式)）

---

## 4. 模組逐層解析

### 4.1 `utils` — 共用常數

**檔案：** `utils/constants.py`

所有有意義的「標籤」都以 `Enum` 定義在這裡，避免魔法字串散落各處。

| Enum | 值 | 用途 |
|------|----|------|
| `Suit` | ♠ ♥ ♦ ♣ | 花色，同時儲存顯示符號 |
| `Rank` | 2–14 | 牌面大小，整數值可直接比較 |
| `Action` | FOLD / CHECK / CALL / RAISE / ALL_IN | 玩家行動 |
| `Phase` | PRE_FLOP / FLOP / TURN / RIVER / SHOWDOWN | 手牌階段 |
| `HandRank` | 1–10 | 牌型等級，整數值用於大小比較 |

---

### 4.2 `cards` — 牌組與牌型判定

#### `Card`
最簡單的值物件，只有 `rank` 和 `suit` 兩個屬性。`frozen=True` 確保它可以放進 `set` 或當 dict key。`__str__` 輸出 `A♠`、`K♥` 等顯示用字串。

#### `Deck`
管理 52 張牌的有序堆疊，對外只暴露三個動作：`shuffle()`、`deal(n)`、`burn()`。牌組以 `list` 實作，`deal()` 從尾端 pop，等同於從牌堆頂部發牌。

#### `HandEvaluator`

完全無狀態（所有方法都是 `@staticmethod`）。

**演算法：**
1. 將底牌 + 公共牌（最多 7 張）用 `itertools.combinations` 產生所有 C(7,5)=21 種五張組合
2. 對每個組合呼叫 `_evaluate_five()`，判定牌型
3. 回傳最高的 `HandResult`

`HandResult` 包含 `(HandRank, tiebreakers)` 元組，Python 原生 tuple 比較就能正確決定勝負。特別處理 **A-2-3-4-5（Wheel）**，Ace 在此扮演最小牌。

---

### 4.3 `players` — 玩家層級體系

```
BasePlayer (ABC)
├── HumanPlayer        ← stdin（終端機模式）
├── WsHumanPlayer      ← threading.Event 橋接（網頁模式）
└── BotPlayer          ← 委派給 BettingStrategy
```

`BasePlayer` 定義所有玩家共用的狀態與行為：

- **狀態：** `chips`、`hole_cards`、`is_active`、`current_bet`
- **合約：** `decide(state: GameState) -> (Action, int)`（抽象方法）
- **工具方法：** `place_chips()`、`receive_winnings()`、`fold()`、`clear_hand()`

引擎（`Game`）只知道 `BasePlayer`，完全不知道對方是 stdin 玩家、WebSocket 玩家還是機器人，符合依賴反轉原則（DIP）。

---

### 4.4 `strategies` — 下注策略

每個策略實作 `BettingStrategy.decide(state, player) -> (Action, int)`。

**關鍵設計：** `legal_actions` 由引擎在呼叫 `decide()` 前計算完畢並放入 `GameState`，策略只能從這個清單中選擇。

| 策略 | 蓋牌 | 跟/過 | 加注 | 加注幅度 |
|------|------|-------|------|---------|
| `RandomStrategy` | 33% | 33% | 33% | 隨機（min → all-in） |
| `PassiveStrategy` | 10% | 75% | 15% | 1× – 2× 目前注額 |
| `AggressiveStrategy` | 5% | 20% | 75% | 2× → all-in |

三種策略共同的防禦邏輯：**若可以過牌就絕不蓋牌**（免費過牌永遠優於蓋牌）。

---

### 4.5 `engine` — 遊戲引擎

#### `Dealer`

遊戲中**唯一**被允許呼叫 `deck.deal()` 和 `deck.burn()` 的物件，確保任何地方都無法「偷看」牌。

```
deal_hole_cards(players)  → 每人兩張（兩輪發牌）
deal_flop(community)      → 燒一張，翻三張
deal_turn(community)      → 燒一張，翻一張
deal_river(community)     → 燒一張，翻一張
```

#### `Pot`

追蹤每位玩家的入池金額，並計算邊池（side pot）分配。`calculate_eligible_players()` 回傳 `[(player, max_winnable)]` 清單，引擎按此分配獎金。

#### `Table`

純粹的資料容器，管理座位順序、莊家位置、公共牌、底池、盲注金額。提供 `small_blind_position`、`big_blind_position` 屬性（自動計算）。

#### `Game`

遊戲的大腦，以樣板方法串起整個手牌流程。下注迴圈 `_betting_round()` 的核心機制：

```
while 還有人尚未行動:
    計算合法行動 → 建立 GameState(frozen) → player.decide(state)
    驗證回傳的行動 → 執行（更新籌碼、底池）
    若有人加注 → 重設「需行動」集合，其餘人需再次行動
```

---

### 4.6 `ui` — 終端機介面

`Renderer` 是一個純輸出模組，所有方法只接收資料並渲染，不讀取任何輸入，也不持有遊戲狀態。

| Rich 元件 | 用途 |
|-----------|------|
| `Panel` | 顯示公共牌、玩家手牌 |
| `Table` | 玩家籌碼狀態列表 |
| `rule()` | 階段分隔線 |
| `Text` 顏色 | 紅色心形/方塊，白色黑桃/梅花 |

**這種設計的關鍵意義：** `Renderer` 定義了「遊戲引擎能觸發哪些顯示事件」的完整介面。`WsRenderer` 只需繼承並覆寫這些方法，引擎程式碼**一行都不用動**，就能把所有輸出改為 WebSocket 事件。

---

## 5. Web 層架構

### 5.1 Thread Bridge 模式

這是整個 Web 架構最關鍵的設計，解決了一個根本矛盾：

```
問題：
  Game.run()         ← 同步阻塞迴圈（Python thread）
  HumanPlayer.decide() ← 必須等待瀏覽器回應
  FastAPI WebSocket  ← asyncio 事件迴圈，不能被阻塞
```

**解法：三層結構**

```
asyncio 事件迴圈（主執行緒）          ThreadPoolExecutor（遊戲執行緒）
─────────────────────────────        ──────────────────────────────
                                     game.run() 開始
                                     ...
                                     WsHumanPlayer.decide()
                                       → 呼叫 on_decision_needed(state)
asyncio.Queue ← run_coroutine_threadsafe ← 放入 ACTION_REQUIRED 事件
pump_events() → ws.send_json()           ← 瀏覽器收到按鈕

瀏覽器點擊 "Raise"
ws.receive_json() → submit_action(RAISE, 200)
                    threading.Event.set()  ─────────────────────────→
                                          WsHumanPlayer.decide() 解除阻塞
                                          return (Action.RAISE, 200)
                                          game.run() 繼續
```

核心是兩個執行緒安全原語：
- `threading.Event.wait()` — 阻塞遊戲執行緒，同時釋放 GIL（不影響 asyncio）
- `asyncio.run_coroutine_threadsafe()` — 從遊戲執行緒安全地往 asyncio Queue 放事件

---

### 5.2 `backend` — FastAPI WebSocket

| 檔案 | 職責 |
|------|------|
| `main.py` | FastAPI app；`/ws` endpoint；生產環境掛載 `frontend/dist/` |
| `session.py` | `GameSession`：每條連線一個實例；管理 executor、Queue、sender/receiver task |
| `serializer.py` | 純函式，引擎物件 → JSON dict；無副作用，可獨立測試；不 import `backend.*` |
| `ws_renderer.py` | 繼承 `Renderer`；覆寫所有 `show_*` 方法，改為 `run_coroutine_threadsafe` 推送事件 |

**連線生命週期：**

```
1. WebSocket 連線建立
2. 等待 START_GAME 訊息（含玩家設定）
3. 建立 WsHumanPlayer + BotPlayers + Table + Game
4. run_in_executor(game.run)  ← 遊戲執行緒啟動
5. sender task：drain Queue → ws.send_json()
6. receiver task：ws.receive_json() → submit_action()
7. 遊戲結束 or 斷線 → cancel() → 強制 FOLD 解除執行緒阻塞
```

**斷線安全：** `session.cancel()` 呼叫 `WsHumanPlayer.force_fold()`，確保遊戲執行緒不會永久阻塞。

---

### 5.3 `frontend` — React 應用程式

**狀態管理（Zustand）**

`gameStore.ts` 是前端唯一的狀態來源。`dispatch(msg)` 是一個 reducer，根據 `msg.type` 更新對應的狀態切片：

```
TABLE_STATE    → players, communityCards, pot, phase
ACTION_REQUIRED → pendingAction（觸發 ActionPanel 顯示）
SHOWDOWN       → showdown（顯示所有人底牌）
HAND_RESULT    → lastResult（顯示勝利公告）
ACTION_LOG     → log[]（右側行動記錄）
NEW_HAND       → 清除 showdown, lastResult
GAME_OVER      → gameOver（顯示結束覆蓋層）
```

**元件資料流**

```
usePokerSocket（hook）
  ├── 建立 WebSocket 連線
  ├── onmessage → dispatch(msg) → Zustand store
  └── 暴露 sendAction(), startGame()

App
  ├── useEffect：connected && !started → startGame()
  ├── GameTable ← 讀 store（players, communityCards, pot）
  │   ├── PlayerSeat × N ← 讀 store（showdown 時顯示底牌）
  │   ├── CommunityCards ← 讀 store
  │   └── ActionLog ← 讀 store（log[]）
  └── ActionPanel ← 讀 store（pendingAction）
      └── 按鈕點擊 → sendAction() → ws.send_json()
```

**卡牌顯示規則：**
- 人類玩家底牌：`TABLE_STATE` 中直接包含（始終可見）
- AI 玩家底牌：`TABLE_STATE` 中為空陣列（顯示牌背），`SHOWDOWN` 時才揭露
- ♥ ♦ 顯示紅色，♠ ♣ 顯示白色

---

### 5.4 WebSocket 訊息協定

#### Server → Browser

| 訊息類型 | 說明 |
|---------|------|
| `TABLE_STATE` | 牌桌完整快照（每次行動後發送） |
| `ACTION_REQUIRED` | 輪到人類玩家，附帶合法行動清單與金額範圍 |
| `PHASE_CHANGE` | 階段切換（PRE_FLOP / FLOP / TURN / RIVER） |
| `ACTION_LOG` | 行動記錄（如 "Alice: raises to 200"） |
| `SHOWDOWN` | 攤牌，揭露所有玩家底牌與牌型 |
| `HAND_RESULT` | 贏家公告 |
| `PLAYER_BUST` | 玩家籌碼歸零被淘汰 |
| `GAME_OVER` | 最終贏家 |
| `NEW_HAND` | 新一手牌開始 |

#### Browser → Server

| 訊息類型 | 說明 |
|---------|------|
| `START_GAME` | 連線後發送一次，包含玩家設定 |
| `PLAYER_ACTION` | 玩家行動（fold / check / call / raise / all_in + amount） |

---

## 6. 資料流與呼叫鏈

### 終端機模式（完整路徑）

```
Game._betting_round()
  ├─ _legal_actions() → [FOLD, CALL, RAISE]
  ├─ GameState(frozen) 建立
  ├─ HumanPlayer.decide(state)
  │     └─ 顯示選項（Renderer） → 讀 stdin → 回傳 (RAISE, 200)
  ├─ _validate_action()
  ├─ player.place_chips(200) + pot.add(player, 200)
  └─ renderer.show_action("You", "raises to 200") → rich console
```

### 網頁模式（完整路徑）

```
Game._betting_round()（遊戲執行緒）
  ├─ _legal_actions() → [FOLD, CALL, RAISE]
  ├─ GameState(frozen) 建立
  ├─ WsHumanPlayer.decide(state)
  │     ├─ on_decision_needed(state)  ← 回呼
  │     │     └─ run_coroutine_threadsafe → Queue.put(ACTION_REQUIRED)
  │     │           └─ pump_events → ws.send_json(ACTION_REQUIRED)
  │     │                 └─ 瀏覽器顯示 fold/call/raise 按鈕
  │     │
  │     └─ threading.Event.wait()  ← 阻塞，GIL 釋放
  │
  │  ── 使用者點擊 "Raise 200" ──
  │
  │     receive_actions() ← asyncio task
  │       └─ ws.receive_json() → submit_action(RAISE, 200)
  │             └─ threading.Event.set()  ← 解除阻塞
  │
  │     回傳 (RAISE, 200)
  ├─ _validate_action()
  ├─ player.place_chips(200) + pot.add(player, 200)
  └─ ws_renderer.show_action("You", "raises to 200")
        └─ run_coroutine_threadsafe → Queue.put(ACTION_LOG)
              └─ pump_events → ws.send_json(ACTION_LOG)
                    └─ 瀏覽器 ActionLog 更新
```

---

## 7. 關鍵設計決策

### 為什麼引擎完全不知道網頁的存在？

`Game`、`Dealer`、`Table` 只依賴 `BasePlayer` 介面和 `Renderer` 介面。網頁支援是透過**兩個替換**實現的：
- `HumanPlayer` → `WsHumanPlayer`（相同介面，不同 I/O）
- `Renderer` → `WsRenderer`（相同介面，輸出到 Queue 而非 stdout）

引擎程式碼一行都沒有改動，這是整個設計最重要的驗證。

### 為什麼用 `threading.Event` 而非重寫引擎為 async？

重寫引擎為 async 需要改動超過 200 行的遊戲邏輯，且會破壞終端機模式的同步呼叫鏈。`threading.Event.wait()` 只需要 30 行新程式碼，完全不動引擎，且 `wait()` 釋放 GIL，asyncio 事件迴圈繼續正常運行。

### 為什麼 `serializer.py` 不 import `backend.*`？

防止循環依賴。`serializer.py` 的功能是純資料轉換，只需要知道引擎物件的形狀。若它 import `session.py` 或 `main.py`，就形成 `session → serializer → session` 的循環。現在的依賴方向是單向的：`session → serializer → poker_trainer.*`。

### 為什麼前端用 Zustand 而非 Redux？

因為遊戲狀態是一個扁平的 flat object（沒有複雜的正規化需求），且更新邏輯是一個簡單的 switch/case reducer。Zustand 讓這個 reducer 只需要 50 行，沒有 action creator、middleware、selector 等樣板程式碼。

### 為什麼 `GameState.phase` 要從 `community_cards` 的數量推導？

引擎在 `_betting_round()` 中建立 `GameState` 時，`phase` 欄位固定寫死為 `PRE_FLOP`（已知 bug）。`serializer.py` 改用 `len(community_cards)` 推導正確的 phase，這樣即使引擎 bug 存在，前端顯示仍然正確。

---

## 8. 擴充性說明

### 新增 AI 策略

1. 在 `strategies/` 建立新 Class，繼承 `BettingStrategy`
2. 在 `PlayerFactory._STRATEGY_MAP` 加一行
3. 在 `frontend/src/App.tsx` 的 `bots` 設定中使用新類型名稱
4. 完成。引擎、玩家、工廠**零改動**。

### 新增遊戲模式（如錦標賽）

繼承 `Game`，覆寫 `_play_hand()` 或 `_award_pot()`。盲注遞增、淘汰重排等邏輯加在子類別，原始 `Game` 不動。前端只需更新對應的訊息處理邏輯。

### 支援多人連線

目前每條 WebSocket 連線對應一個獨立的 `GameSession`（單人 + AI）。要支援多人，需要：
1. 建立共享的 `GameRoom` 管理多個 WebSocket 連線
2. 每位玩家對應一個 `WsHumanPlayer`，各自有自己的 `threading.Event`
3. `session.py` 改為向所有連線廣播 `TABLE_STATE`

### 替換前端框架

`usePokerSocket.ts` 和 `gameStore.ts` 完全封裝了 WebSocket 邏輯。若換用 Vue 或 Svelte，只需重寫這兩個檔案（約 80 行），元件邏輯可直接移植。

---

## 小結

Poker Trainer 的架構核心思想是**「誰負責什麼，就只做什麼」**，在加入 Web 層後仍然完整保持：

| 物件 | 唯一職責 |
|------|---------|
| `Dealer` | 只碰牌，不知道遊戲規則 |
| `Strategy` | 只做決策，不知道桌況怎麼更新 |
| `Renderer` / `WsRenderer` | 只顯示，不持有任何狀態 |
| `Game` | 唯一知道完整流程的物件，但不自己渲染，也不自己發牌 |
| `GameSession` | 唯一知道 asyncio 與執行緒如何橋接的物件 |
| `serializer.py` | 唯一知道如何把引擎物件轉成 JSON 的地方 |

這種分工讓每個模組都能獨立測試，也讓系統在需要擴充時，改動範圍總是被限制在單一、明確的地方。
