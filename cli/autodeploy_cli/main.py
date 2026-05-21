import typer
import requests
from rich.console import Console
from rich.panel import Panel
from typing import Optional
from . import config
from . import apps
from . import auth
from . import logs as logs_mod
import asyncio

app = typer.Typer(
    name="ad",
    help="AutoDeploy CLI: The Developer-First PaaS Interface",
    no_args_is_help=True,
    rich_markup_mode="rich"
)

# Core Resource Typer
app.add_typer(apps.app, name="apps")
app.add_typer(auth.app, name="auth")

# Alias common auth commands to the root for UX
@app.command()
def login(
    key: Optional[str] = typer.Option(None, "--key", "-k", help="The API Key from your dashboard"),
    api_base: Optional[str] = typer.Option(None, "--base", "-b", help="The API Base URL")
):
    """Authenticate with AutoDeploy"""
    auth.login(key=key, api_base=api_base)

@app.command()
def logout():
    """Remove local credentials"""
    auth.logout()

@app.command()
def whoami():
    """Check current user"""
    auth.whoami()

@app.command()
def credentials():
    """List deployment credentials (shortcut)"""
    auth.list_credentials()

console = Console()

@app.command()
def logs(job_id: Optional[str] = typer.Argument(None, help="The ID of the job to stream logs for")):
    """
    Stream real-time logs for a deployment job.
    """
    asyncio.run(logs_mod.run_logs(job_id))

@app.command()
def debug_ws(job_id: str):
    """
    Debug WebSocket connectivity with raw JSON output and automatic exit on completion.
    """
    import websockets
    import json
    
    async def run_debug():
        key = config.get_api_key()
        api_base = config.get_api_base()
        ws_base = api_base.replace("https://", "wss://").replace("http://", "ws://")
        url = f"{ws_base}/ws/logs/{job_id}?token={key}"
        
        stop_event = asyncio.Event()
        job_status = "RUNNING"

        async def poll_status():
            nonlocal job_status
            headers = {"Authorization": f"Bearer {key}"}
            while not stop_event.is_set():
                try:
                    res = await asyncio.get_event_loop().run_in_executor(
                        None, lambda: requests.get(f"{api_base}/jobs/{job_id}", headers=headers, timeout=2)
                    )
                    if res.ok:
                        status = res.json().get("status", "RUNNING")
                        if status in ["success", "failed", "stopped"]:
                            job_status = status.upper()
                            # Give the logs a few seconds to finish streaming before we kill the process
                            await asyncio.sleep(3)
                            stop_event.set()
                except: pass
                await asyncio.sleep(2)

        console.print(f"Connecting to [cyan]{url}[/cyan]...")
        
        # Start status poller in background
        poller = asyncio.create_task(poll_status())
        
        try:
            async with websockets.connect(url) as ws:
                console.print("[green]Connected![/green] Streaming raw JSON logs...")
                while not stop_event.is_set():
                    try:
                        # Use wait_for so we can check the stop_event periodically
                        msg = await asyncio.wait_for(ws.recv(), timeout=1.0)
                        console.print(f"[dim]RAW:[/dim] {msg}")
                    except asyncio.TimeoutError:
                        continue
                    except websockets.ConnectionClosed as e:
                        console.print(f"\n[yellow]Connection Closed by Server:[/yellow] Code: {e.code}, Reason: {e.reason}")
                        break
                
                console.print(f"\n[bold green]DEBUG SESSION FINISHED:[/bold green] Job reached state [cyan]{job_status}[/cyan]")
        except Exception as e:
            console.print(f"[red]Error:[/red] {e}")
        finally:
            stop_event.set()
            await poller

    asyncio.run(run_debug())

if __name__ == "__main__":
    app()
