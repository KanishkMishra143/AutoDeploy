import typer
import requests
from rich.console import Console
from rich.panel import Panel
from rich.table import Table
from typing import Optional
from . import config
from . import apps
from . import logs as logs_mod
import asyncio

app = typer.Typer(
    name="ad",
    help="AutoDeploy CLI: The Developer-First PaaS Interface",
    no_args_is_help=True,
    rich_markup_mode="rich"
)
app.add_typer(apps.app, name="apps")
console = Console()

@app.command()
def logs(job_id: Optional[str] = typer.Argument(None, help="The ID of the job to stream logs for")):
    """
    Stream real-time logs for a deployment job.
    """
    asyncio.run(logs_mod.run_logs(job_id))

@app.command()
def login(key: Optional[str] = typer.Option(None, "--key", "-k", help="The API Key from your dashboard")):
    """
    Authenticate the CLI with your AutoDeploy account.
    """
    if not key:
        key = typer.prompt("Enter your AutoDeploy API Key", hide_input=True)
    
    if not key.startswith("ad_live_"):
        console.print("[red]Error:[/red] Invalid key format. Keys should start with 'ad_live_'")
        raise typer.Exit(1)

    # Verify the key
    api_base = config.get_api_base()
    try:
        with console.status("[bold blue]Verifying connection..."):
            response = requests.get(
                f"{api_base}/auth/profile",
                headers={"Authorization": f"Bearer {key}"}
            )
        
        if response.ok:
            data = response.json()
            config.save_config({"api_key": key, "api_base": api_base})
            console.print(Panel(
                f"Welcome, [bold green]{data['username']}[/bold green]!\n"
                f"Successfully authenticated with {api_base}",
                title="[bold]Authentication Successful",
                border_style="green"
            ))
        else:
            console.print("[red]Error:[/red] Invalid API Key or server unreachable.")
    except Exception as e:
        console.print(f"[red]Error:[/red] Could not connect to the API: {e}")

@app.command()
def whoami():
    """
    Check the current authenticated user.
    """
    key = config.get_api_key()
    if not key:
        console.print("[yellow]Not logged in.[/yellow] Run 'ad login' first.")
        return

    api_base = config.get_api_base()
    try:
        response = requests.get(
            f"{api_base}/auth/profile",
            headers={"Authorization": f"Bearer {key}"}
        )
        if response.ok:
            data = response.json()
            console.print(f"Logged in as: [bold green]{data['username']}[/bold green] (@{data['user_id']})")
        else:
            console.print("[red]Error:[/red] Session expired or invalid key. Run 'ad login' again.")
    except Exception as e:
        console.print(f"[red]Error:[/red] Could not connect to the API: {e}")

@app.command()
def logout():
    """
    Remove local authentication credentials.
    """
    if config.CONFIG_FILE.exists():
        config.CONFIG_FILE.unlink()
        console.print("[green]Successfully logged out.[/green]")
    else:
        console.print("[yellow]No active session found.[/yellow]")

@app.command()
def debug_ws(job_id: str):
    """
    Debug WebSocket connectivity by printing raw messages.
    """
    import websockets
    import json
    
    async def run_debug():
        key = config.get_api_key()
        base = config.get_api_base().replace("http://", "ws://")
        url = f"{base}/ws/logs/{job_id}?token={key}"
        console.print(f"Connecting to [cyan]{url}[/cyan]...")
        try:
            async with websockets.connect(url) as ws:
                console.print("[green]Connected![/green] Waiting for messages...")
                while True:
                    msg = await ws.recv()
                    console.print(f"[dim]RAW:[/dim] {msg}")
        except Exception as e:
            console.print(f"[red]Error:[/red] {e}")

    asyncio.run(run_debug())

if __name__ == "__main__":
    app()
