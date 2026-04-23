"""
Terminal renderer using the `rich` library.

The Renderer is a pure output component — it reads game state and prints
it.  It never modifies any game object.  Keeping display logic here means
the engine (game.py) remains free of print statements and ANSI codes.

Card display uses colored suit symbols:
    ♠ ♣  — white / default
    ♥ ♦  — red
"""

from __future__ import annotations

from typing import TYPE_CHECKING, List

from rich.console import Console
from rich.panel import Panel
from rich.table import Table as RichTable
from rich.text import Text

from poker_trainer.cards.card import Card
from poker_trainer.utils.constants import Suit

if TYPE_CHECKING:
    from poker_trainer.engine.table import Table
    from poker_trainer.players.base_player import BasePlayer

console = Console()


def _card_text(card: Card) -> Text:
    """Return a richly formatted Text representation of a card."""
    red_suits = {Suit.HEARTS, Suit.DIAMONDS}
    color = "bold red" if card.suit in red_suits else "bold white"
    return Text(str(card), style=color)


def _hand_text(cards: List[Card]) -> Text:
    """Build a combined Text object for a list of cards."""
    t = Text()
    for i, card in enumerate(cards):
        if i:
            t.append("  ")
        t.append_text(_card_text(card))
    return t


class Renderer:
    """
    Renders game state to the terminal.

    All methods are idempotent: calling them twice prints twice.
    No state is stored between calls.
    """

    # ------------------------------------------------------------------
    # Hand-level display
    # ------------------------------------------------------------------

    def show_table(self, table: "Table", viewing_player: "BasePlayer") -> None:
        """
        Print the full table view for *viewing_player*'s turn:
          - Community cards
          - Pot total
          - All players' chip counts and fold/active state
          - The viewing player's hole cards
        """
        console.print()

        # Community cards panel
        community_text = Text()
        if table.community_cards:
            community_text = _hand_text(table.community_cards)
        else:
            community_text = Text("(none yet)", style="dim")
        console.print(
            Panel(community_text, title="Board", border_style="cyan", expand=False)
        )

        # Pot
        console.print(f"  [yellow]Pot:[/yellow] {table.pot.total} chips\n")

        # Players table
        grid = RichTable(show_header=True, header_style="bold blue", box=None)
        grid.add_column("Player", style="bold")
        grid.add_column("Chips", justify="right")
        grid.add_column("Bet", justify="right")
        grid.add_column("Status")

        for player in table.seats:
            if player == viewing_player:
                name = Text(f"▶ {player.name}", style="bold green")
            else:
                name = Text(player.name)

            status = (
                Text("active", style="green")
                if player.is_active
                else Text("folded", style="dim red")
            )
            if player.is_all_in:
                status = Text("all-in", style="yellow")
            if player.chips == 0 and not player.is_active:
                status = Text("bust", style="bold red")

            grid.add_row(
                name,
                str(player.chips),
                str(player.current_bet),
                status,
            )

        console.print(grid)

        # Hole cards for the viewing player
        if viewing_player.hole_cards:
            hole_text = _hand_text(viewing_player.hole_cards)
            console.print(
                Panel(
                    hole_text,
                    title=f"Your Hand ({viewing_player.name})",
                    border_style="green",
                    expand=False,
                )
            )

    def show_phase_header(self, phase_name: str) -> None:
        """Print a section divider for a new phase."""
        console.rule(f"[bold cyan]{phase_name}[/bold cyan]")

    def show_action(self, player_name: str, action_str: str) -> None:
        """Print what a player did."""
        console.print(f"  [bold]{player_name}[/bold]: {action_str}")

    def show_hand_result(
        self,
        winner_name: str,
        hand_description: str,
        amount: int,
    ) -> None:
        """Print the winner of a hand."""
        console.print(
            f"\n  [bold yellow]{winner_name}[/bold yellow] wins "
            f"[yellow]{amount}[/yellow] chips "
            f"with [bold]{hand_description}[/bold]!"
        )

    def show_showdown(self, players: List["BasePlayer"], community: List[Card]) -> None:
        """
        Reveal all active players' hole cards at showdown.
        """
        console.rule("[bold magenta]Showdown[/bold magenta]")
        for player in players:
            if player.is_active and player.hole_cards:
                hole_text = _hand_text(player.hole_cards)
                console.print(f"  [bold]{player.name}[/bold]: ", end="")
                console.print(hole_text)

    def show_bust(self, player_name: str) -> None:
        """Announce a player has been eliminated."""
        console.print(f"\n  [red]{player_name} has been eliminated![/red]")

    def show_game_over(self, winner_name: str, chips: int) -> None:
        """Announce the final game winner."""
        console.print()
        console.print(
            Panel(
                f"[bold yellow]{winner_name}[/bold yellow] wins the game "
                f"with [yellow]{chips}[/yellow] chips!",
                title="Game Over",
                border_style="yellow",
            )
        )

    def show_hand_separator(self, hand_num: int) -> None:
        """Print a visual separator between hands."""
        console.print()
        console.rule(f"[dim]Hand #{hand_num}[/dim]")
        console.print()

    def show_message(self, msg: str) -> None:
        """Print an informational message."""
        console.print(f"  {msg}")
