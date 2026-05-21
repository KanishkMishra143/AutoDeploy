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
def login(
    key: Optional[str] = typer.Option(None, "--key", "-k", help="The API Key from your dashboard"),
    api_base: Optional[str] = typer.Option(None, "--base", "-b", help="The API Base URL (default: https://api.auto-deploy.tech)")
):
    """
    Authenticate the CLI with your AutoDeploy account.
    """
    if not key:
        key = typer.prompt("Enter your AutoDeploy API Key", hide_input=True)
    
    if not key.startswith("ad_live_"):
        console.print("[red]Error:[/red] Invalid key format. Keys should start with 'ad_live_'")
        raise typer.Exit(1)

    # Resolve API Base: CLI Argument > Default
    final_api_base = api_base or "https://api.auto-deploy.tech"
    
    # Verify the key
    try:
        with console.status(f"[bold blue]Verifying connection to {final_api_base}..."):
            response = requests.get(
                f"{final_api_base}/auth/profile",
                headers={"Authorization": f"Bearer {key}"},
                timeout=10
            )
        
        if response.ok:
            data = response.json()
            config.save_config({"api_key": key, "api_base": final_api_base})
            console.print(Panel(
                f"Welcome, [bold green]{data['username']}[/bold green]!\n"
                f"Successfully authenticated with {final_api_base}",
                title="[bold]Authentication Successful",
                border_style="green"
            ))
        elif response.status_code == 401:
            console.print("[red]Error:[/red] Invalid API Key. Please check the key in your dashboard and try again.")
        else:
            try:
                error_detail = response.json().get('detail', 'Unknown error')
            except:
                error_detail = response.text
            console.print(f"[red]Error:[/red] Server returned an unexpected error ({response.status_code}): {error_detail}")
    except requests.exceptions.ConnectionError:
        console.print(f"[red]Error:[/red] Could not reach the server at {final_api_base}. Please ensure the AutoDeploy API is running.")
    except Exception as e:
        console.print(f"[red]Error:[/red] An unexpected error occurred: {e}")

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
        elif response.status_code == 401:
            detail = response.json().get("detail", "")
            if "expired" in detail.lower():
                console.print("[red]Error:[/red] Your API Key has expired. Please re-generate a new key from the dashboard and run 'ad login' again.")
            else:
                console.print("[red]Error:[/red] Session invalid or unauthorized. Run 'ad login' again.")
        else:
            console.print(f"[red]Error:[/red] Could not fetch profile (Status: {response.status_code})")
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
        base = config.get_api_base().replace("https://", "wss://").replace("http://", "ws://")
        url = f"{base}/ws/logs/{job_id}?token={key}"
        console.print(f"Connecting to [cyan]{url}[/cyan]...")
        try:
            async with websockets.connect(url) as ws:
                console.print("[green]Connected![/green] Waiting for messages...")
                while True:
                    try:
                        msg = await ws.recv()
                        console.print(f"[dim]RAW:[/dim] {msg}")
                    except websockets.ConnectionClosed as e:
                        console.print(f"\n[yellow]Connection Closed by Server:[/yellow] Code: {e.code}, Reason: {e.reason}")
                        break
        except Exception as e:
            console.print(f"[red]Error:[/red] {e}")

    asyncio.run(run_debug())

if __name__ == "__main__":
    app()
