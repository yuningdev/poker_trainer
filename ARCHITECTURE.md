# Poker Trainer 程式碼架構解析

> 一個以 Python 實作的德州撲克終端機遊戲，從設計模式到模組分工，完整說明。

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
5. [資料流與呼叫鏈](#5-資料流與呼叫鏈)
6. [關鍵設計決策](#6-關鍵設計決策)
7. [擴充性說明](#7-擴充性說明)

---

## 1. 專案總覽

Poker Trainer 是一個可在終端機執行的德州撲克（Texas Hold'em）遊戲，支援人類玩家對抗多種 AI 對手。整個專案的設計目標有三：

- **可擴充** — 新增一種 AI 策略只需寫一個 Class，不需動其他程式碼
- **關注點分離** — 發牌邏輯、下注決策、畫面渲染三者互不耦合
- **可測試** — 核心模組（牌型判定、策略）完全不依賴 I/O，可直接單元測試

技術選型上，遊戲本體只依賴 Python 標準函式庫，終端機渲染使用 `rich` 套件，套件管理使用 `uv`。

---

## 2. 資料夾結構

```
poker_trainer/                    ← 專案根目錄
│
├── pyproject.toml                ← uv 套件設定（依賴、進入點）
├── .python-version               ← Python 版本鎖定（3.11）
├── README.md                     ← 快速開始
├── USER_GUIDE.md                 ← 中英文使用手冊
├── ARCHITECTURE.md               ← 本文件
├── simulate.py                   ← 模擬腳本（產生報告用）
│
├── poker_trainer/                ← 主程式套件
│   ├── __init__.py
│   ├── __main__.py               ← 進入點（uv run poker）
│   │
│   ├── utils/
│   │   └── constants.py          ← 所有 Enum 定義
│   │
│   ├── cards/
│   │   ├── card.py               ← Card 值物件
│   │   ├── deck.py               ← Deck 牌組
│   │   └── hand_evaluator.py     ← 牌型判定器
│   │
│   ├── players/
│   │   ├── base_player.py        ← 抽象基底類別
│   │   ├── human_player.py       ← 人類玩家（stdin）
│   │   ├── bot_player.py         ← AI 玩家（委派策略）
│   │   └── player_factory.py     ← 工廠方法
│   │
│   ├── strategies/
│   │   ├── base_strategy.py      ← 策略介面 + GameState
│   │   ├── random_strategy.py    ← 隨機策略
│   │   ├── passive_strategy.py   ← 保守策略
│   │   └── aggressive_strategy.py← 激進策略
│   │
│   ├── engine/
│   │   ├── dealer.py             ← 發牌者（唯一能碰牌組的物件）
│   │   ├── pot.py                ← 底池管理
│   │   ├── table.py              ← 牌桌狀態
│   │   └── game.py               ← 遊戲主迴圈
│   │
│   └── ui/
│       └── renderer.py           ← 終端機渲染（rich）
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

本專案共使用四種 GoF 設計模式，每一種都對應一個具體的問題：

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

**問題：** `__main__.py` 需要根據設定字串（如 `"aggressive"`）建立玩家，若直接 `import` 具體類別，設定與實作就耦合在一起。

**解法：** `PlayerFactory.create("aggressive", "Alice", 1000)` 統一管理映射關係。

```python
# __main__.py 只知道字串，不知道具體 Class
PlayerFactory.create("aggressive", "Alice", 1000)

# 工廠內部維護映射表
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
Game._play_hand()               ← 骨架（固定順序）
  ├── _post_blinds()
  ├── dealer.deal_hole_cards()
  ├── _betting_round()          ← 可被子類別覆寫
  ├── dealer.deal_flop()
  ├── _betting_round()
  ├── dealer.deal_turn()
  ├── _betting_round()
  ├── dealer.deal_river()
  ├── _betting_round()
  └── _award_pot()
```

模擬腳本中的 `ObservableGame` 就是繼承 `Game` 並覆寫 `_play_hand()`，在不動原始引擎的前提下插入錄製邏輯。

---

### 值物件模式（Value Object）

**問題：** 策略函式在決策時需要讀取遊戲狀態，但如果直接傳入可變物件，一個有 bug 的策略可能意外改動遊戲狀態，造成難以追蹤的錯誤。

**解法：** `Card` 與 `GameState` 都是 `@dataclass(frozen=True)`，建立後完全不可變。策略只能讀取，無法篡改。

```python
@dataclass(frozen=True)
class GameState:
    community_cards: tuple
    pot_total: int
    current_bet: int
    legal_actions: tuple   # 合法行動清單，由引擎預先計算
    ...
```

---

## 4. 模組逐層解析

### 4.1 `utils` — 共用常數

**檔案：** `utils/constants.py`

整個專案中所有有意義的「標籤」都以 `Enum` 定義在這裡，避免魔法字串（magic string）散落各處。

| Enum | 值 | 用途 |
|------|----|------|
| `Suit` | ♠ ♥ ♦ ♣ | 花色，同時儲存顯示符號 |
| `Rank` | 2–14 | 牌面大小，整數值可直接比較 |
| `Action` | FOLD / CHECK / CALL / RAISE / ALL_IN | 玩家行動 |
| `Phase` | PRE_FLOP / FLOP / TURN / RIVER / SHOWDOWN | 手牌階段 |
| `HandRank` | 1–10 | 牌型等級，整數值用於大小比較 |

所有模組都從這裡 import，確保沒有任何地方用字串 `"fold"` 或數字 `14` 表示 Ace。

---

### 4.2 `cards` — 牌組與牌型判定

這一層負責撲克牌的「物理」行為：牌長什麼樣、牌組如何運作、如何判定牌型。

#### `Card`
最簡單的值物件，只有 `rank` 和 `suit` 兩個屬性，以及顯示用的 `__str__`（輸出 `A♠`、`K♥` 等）。`frozen=True` 確保它可以放進 `set` 或當 dict key。

#### `Deck`
管理 52 張牌的有序堆疊。對外只暴露三個動作：

- `shuffle()` — 洗牌
- `deal(n)` — 從頂部取出 n 張，若不足則拋出 `ValueError`
- `burn()` — 燒牌（丟棄一張，不進入任何玩家手中）

牌組以 `list` 實作，`deal()` 從尾端 pop，等同於從牌堆頂部發牌。

#### `HandEvaluator`

牌型判定的核心，完全無狀態（所有方法都是 `@staticmethod`）。

**演算法：**
1. 將底牌 + 公共牌（最多 7 張）用 `itertools.combinations` 產生所有 C(7,5)=21 種五張組合
2. 對每個組合呼叫 `_evaluate_five()`，判定牌型與比牌值
3. 回傳最高的 `HandResult`

`HandResult` 包含 `(HandRank, tiebreakers)` 元組，Python 原生 tuple 比較就能正確決定勝負，無需額外邏輯。

特別處理的邊界情況：**A-2-3-4-5（Wheel）**，Ace 在此扮演最小牌，high card 為 5。

---

### 4.3 `players` — 玩家層級體系

```
BasePlayer (ABC)
├── HumanPlayer        ← 從 stdin 讀取輸入
└── BotPlayer          ← 委派給 BettingStrategy
```

`BasePlayer` 定義所有玩家共用的狀態與行為：

- **狀態：** `chips`、`hole_cards`、`is_active`、`current_bet`
- **合約：** `decide(state: GameState) -> (Action, int)`（抽象方法）
- **工具方法：** `place_chips()`、`receive_winnings()`、`fold()`、`clear_hand()`

引擎（`Game`）只知道 `BasePlayer`，完全不知道對方是人還是機器，符合依賴反轉原則（DIP）。

`PlayerFactory` 的映射表設計讓新增玩家類型只需修改工廠，其餘程式碼零改動：

```python
# 加入這兩行就能支援新策略
from poker_trainer.strategies.my_strategy import MyStrategy
_STRATEGY_MAP["my_strategy"] = MyStrategy
```

---

### 4.4 `strategies` — 下注策略

每個策略實作 `BettingStrategy.decide(state, player) -> (Action, int)`。

**關鍵設計：** `legal_actions` 由引擎在呼叫 `decide()` 前計算完畢並放入 `GameState`，策略只能從這個清單中選擇，不可能選出非法行動（如無籌碼時加注）。

| 策略 | 核心邏輯 |
|------|---------|
| `RandomStrategy` | 以均等機率從 `legal_actions` 中隨機選一個 |
| `PassiveStrategy` | 加權隨機：蓋牌 10%、跟/過 75%、加注 15%；加注幅度限 1–2 倍 |
| `AggressiveStrategy` | 加權隨機：蓋牌 5%、跟/過 20%、加注 75%；加注幅度 2 倍至全押 |

三種策略都有一個共同的防禦邏輯：**若可以過牌就絕不蓋牌**（因為蓋牌需要放棄已入池的籌碼，免費過牌永遠優於蓋牌）。

---

### 4.5 `engine` — 遊戲引擎

引擎層是整個專案最複雜的部分，由四個各司其職的類別組成。

#### `Dealer`

遊戲中**唯一**被允許呼叫 `deck.deal()` 和 `deck.burn()` 的物件。這個強制約束確保任何地方都無法「偷看」或「偷拿」牌。

```
dealer.deal_hole_cards(players)  → 每人兩張（兩輪發牌）
dealer.deal_flop(community)      → 燒一張，翻三張
dealer.deal_turn(community)      → 燒一張，翻一張
dealer.deal_river(community)     → 燒一張，翻一張
```

`community` 是由 `Table` 擁有的 `list`，Dealer 直接對它 `extend()`，不自己保存狀態。

#### `Pot`

追蹤每位玩家的入池金額，並計算邊池（side pot）分配。

邊池計算邏輯：當玩家全押（all-in）且金額低於其他人時，他只能從每個對手身上贏取「與自己相同的金額」。`calculate_eligible_players()` 回傳 `[(player, max_winnable)]` 清單，引擎按這個清單分配獎金。

#### `Table`

純粹的資料容器，管理：

- 座位順序（`seats: list[BasePlayer]`）
- 莊家位置（`dealer_position`）
- 公共牌（`community_cards`）
- 底池（`pot: Pot`）
- 盲注金額

提供輔助計算：`small_blind_position`、`big_blind_position`（屬性，自動計算）、`rotate_dealer()`。

#### `Game`

遊戲的大腦，以樣板方法串起整個手牌流程。其中最關鍵的是下注迴圈 `_betting_round()`：

```
while 還有人尚未行動:
    取得當前玩家
    計算合法行動（FOLD / CHECK / CALL / RAISE / ALL_IN）
    建立 GameState 快照（frozen）
    呼叫 player.decide(state)
    驗證回傳的行動（防禦性檢查）
    執行行動（更新籌碼、底池、狀態）
    若有人加注 → 重設「需行動」集合，其餘人需再次行動
```

「需行動」集合（`to_act: set[BasePlayer]`）是讓加注後其他人重新行動的關鍵機制。每次有人加注，集合就重設為「所有活躍且非全押的玩家（除加注者外）」。

---

### 4.6 `ui` — 終端機介面

`Renderer` 是一個純輸出模組，所有方法只接收資料並渲染，不讀取任何輸入，也不持有遊戲狀態。

使用 `rich` 函式庫的幾個關鍵功能：

| Rich 元件 | 用途 |
|-----------|------|
| `Panel` | 顯示公共牌、玩家手牌 |
| `Table` | 玩家籌碼狀態列表 |
| `rule()` | 階段分隔線（如「── Flop ──」） |
| `Text` 顏色 | 紅色心形/方塊，白色黑桃/梅花 |

引擎呼叫 Renderer 的方式：

```python
self.renderer.show_action(player.name, "raises to 200")
self.renderer.show_phase_header("Flop")
self.renderer.show_hand_result(winner, hand_desc, amount)
```

這種設計讓未來換成 Web Socket 介面或 GUI 時，只需替換 `Renderer` 實作，引擎程式碼完全不用動。

---

## 5. 資料流與呼叫鏈

以一個完整的下注行動為例，追蹤從遊戲迴圈到策略決策的完整路徑：

```
Game._betting_round()
  │
  ├─ 計算 call_needed = current_bet - player.current_bet
  ├─ 呼叫 _legal_actions() → [FOLD, CALL, RAISE]
  │
  ├─ 建立 GameState(frozen)
  │     community_cards, pot_total, current_bet,
  │     min_raise, legal_actions, player_chips, ...
  │
  ├─ player.decide(state)
  │     ├─ HumanPlayer → 顯示選項 → 讀 stdin → 回傳
  │     └─ BotPlayer   → strategy.decide(state, self)
  │                          └─ AggressiveStrategy
  │                               → 隨機選 RAISE
  │                               → 計算金額（2x ~ all-in）
  │                               → 回傳 (Action.RAISE, 400)
  │
  ├─ _validate_action() → 確保金額在合法範圍
  │
  ├─ player.place_chips(400) → 扣除籌碼
  ├─ table.pot.add(player, 400) → 更新底池
  ├─ renderer.show_action("Alice", "raises to 400")
  │
  └─ 重設 to_act（其他人需再次行動）
```

---

## 6. 關鍵設計決策

### 為什麼 `Dealer` 擁有 `Deck` 而非 `Table`？

牌桌（Table）是長期存在的物件（整場遊戲），但牌組在每手牌都需要重建。將 `Deck` 放在 `Dealer` 裡，`dealer.reset()` 就能在每手牌乾淨地重建牌組，不影響桌況。

### 為什麼 `legal_actions` 由引擎計算而非策略自行判斷？

若每個策略都自己計算合法行動，任何一個策略算錯就會在執行時崩潰。把這個計算集中在 `Game._legal_actions()` 一個地方，策略只需從清單中選擇，測試也更簡單。

### 為什麼 `GameState` 是 `frozen=True`？

防禦性設計。一個有 bug 的策略（或惡意策略）不可能透過改動 `GameState` 來影響其他玩家的行動或底池金額。這也讓單元測試更容易，因為測試可以直接建立 `GameState` 物件而不用擔心副作用。

### 為什麼 `Renderer` 完全不持有狀態？

讓引擎成為唯一的狀態來源（Single Source of Truth）。若渲染器也持有狀態，就可能出現「引擎狀態正確但畫面顯示錯誤」的 debug 噩夢。現在的設計確保每次呼叫都是「將當前狀態渲染成畫面」的單向操作。

---

## 7. 擴充性說明

設計上預留了幾個明確的擴充點：

### 新增 AI 策略

1. 在 `strategies/` 建立新 Class，繼承 `BettingStrategy`
2. 在 `PlayerFactory._STRATEGY_MAP` 加一行
3. 完成。引擎、玩家、工廠的其他部分**零改動**。

### 新增遊戲模式（如錦標賽）

繼承 `Game`，覆寫 `_play_hand()` 或 `_betting_round()`。  
盲注遞增、淘汰重排座位等邏輯加在子類別裡，原始 `Game` 保持不動。

### 替換終端機介面為 Web UI

實作一個繼承自 `Renderer` 的 `WebSocketRenderer`，將 `show_action()`、`show_phase_header()` 等方法改為發送 JSON 事件，其餘程式碼完全不需修改。

### 加入牌局記錄 / 統計

參考 `simulate.py` 中 `StructuredRenderer` 的做法：繼承 `Renderer`，覆寫各方法以收集結構化資料，再依需求輸出 CSV、JSON 或 Markdown 報告。

---

## 小結

Poker Trainer 的架構核心思想是**「誰負責什麼，就只做什麼」**：

- `Dealer` 只碰牌，不知道遊戲規則
- `Strategy` 只做決策，不知道桌況怎麼更新
- `Renderer` 只顯示，不持有任何狀態
- `Game` 是唯一知道完整流程的物件，但它不自己渲染，也不自己發牌

這種分工讓每個模組都能獨立測試，也讓整個系統在需要擴充時，改動範圍總是被限制在單一、明確的地方。
