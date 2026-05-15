import asyncio
import json
import websockets
import requests
import time
import sys
import tty
import termios
import select
import logging
import os
from rich.console import Console, Group
from rich.live import Live
from rich.panel import Panel
from rich.text import Text
from rich.table import Table
from rich.progress_bar import ProgressBar
from rich.align import Align
from rich.padding import Padding
from datetime import datetime
from typing import Optional, List, Dict, Any
from . import config
from . import context

# Setup file-based logging for debugging
log_file = os.path.expanduser("~/.autodeploy_cli.log")
logging.basicConfig(filename=log_file, level=logging.DEBUG, 
                    format='%(asctime)s - %(levelname)s - %(message)s')

console = Console()

class LogStreamer:
    def __init__(self, job_id: str, app_name: str = "Application"):
        self.job_id = job_id
        self.app_name = app_name
        self.logs = []
        self.status = "RUNNING"
        self.progress = 0
        self.url = None
        self.api_key = config.get_api_key()
        self.api_base = config.get_api_base()
        self.ws_base = self.api_base.replace("http://", "ws://")
        self.ws_status = "CONNECTING"
        self._stop_event = asyncio.Event()
        self.scroll_offset = 0
        logging.debug(f"LogStreamer initialized for job {job_id}")

    def render_header(self) -> Panel:
        status_color = "blue"
        if self.status == "SUCCESS": status_color = "green"
        elif self.status == "FAILED": status_color = "red"
        
        is_pulse = (self.status == "RUNNING" and int(time.time() * 2) % 2 == 0)
        pulse_style = "reverse bold " if is_pulse else "bold "

        header_text = Text.assemble(
            (" JOB: ", "bold white"), (f"{self.job_id[:8]} ", "cyan"),
            ("┃ ", "dim"),
            (" APP: ", "bold white"), (f"{self.app_name} ", "magenta"),
            ("┃ ", "dim"),
            (" STATUS: ", "bold white"), (f" {self.status} ", f"{pulse_style}{status_color}"),
            ("┃ ", "dim"),
            (" WS: ", "bold white"), (f"{self.ws_status} ", "dim" if self.ws_status == "DISCONNECTED" else "green")
        )
        return Panel(header_text, border_style=status_color, expand=True)

    def render_body(self, height: int) -> Panel:
        body_h = max(1, height - 2)
        
        if not self.logs:
            content = Align.center(Text("Waiting for logs...", style="dim italic"), vertical="middle")
        else:
            max_offset = max(0, len(self.logs) - body_h)
            self.scroll_offset = min(self.scroll_offset, max_offset)
            
            log_text = Text()
            if self.scroll_offset == 0:
                visible_slice = self.logs[-body_h:]
            else:
                end = len(self.logs) - self.scroll_offset
                start = max(0, end - body_h)
                visible_slice = self.logs[start:end]
            
            for log in visible_slice:
                ts = log.get("created_at", "").split("T")[-1][:8]
                msg = log.get("message", "")
                log_text.append(f"{ts} ", style="dim")
                log_text.append(f"> {msg}\n")
            content = log_text

        if self.status in ["SUCCESS", "FAILED"]:
            result_color = "green" if self.status == "SUCCESS" else "red"
            result_title = "✔ DEPLOYMENT SUCCESSFUL" if self.status == "SUCCESS" else "✘ DEPLOYMENT FAILED"
            
            res_group = [
                Text(f"\n{result_title}", style=f"bold {result_color} underline"),
            ]
            
            if self.status == "SUCCESS" and self.url:
                res_group.append(Text("\nYour application is live at:", style="white"))
                res_group.append(Padding(
                    Panel(Text(f" {self.url} ", style="bold cyan underline"), border_style="cyan", expand=False),
                    (1, 0, 0, 0)
                ))
            
            content = Group(content, Align.center(Group(*res_group)))

        scroll_info = f" [bold yellow](↑ {self.scroll_offset} lines hidden below)[/]" if self.scroll_offset > 0 else ""
        return Panel(content, title=f"[bold]BUILD LOGS{scroll_info}", border_style="dim", expand=True)

    def render_footer(self) -> Panel:
        p_bar = ProgressBar(total=100, completed=self.progress, width=40, pulse=self.status=="RUNNING")
        footer_grid = Table.grid(expand=True)
        footer_grid.add_column(ratio=2)
        footer_grid.add_column(ratio=1, justify="center")
        footer_grid.add_column(ratio=1, justify="right")
        
        exit_hint = "Esc to exit" if self.status in ["SUCCESS", "FAILED"] else "Esc to quit"
        
        footer_grid.add_row(
            Text.assemble(
                (" HEALTH: ", "bold green"), ("STABLE ", "green"),
                ("┃ ", "dim"),
                (" PROGRESS: ", "bold white"), (f"{self.progress}% ", "bold cyan")
            ),
            p_bar,
            Text.assemble(
                (f"{datetime.now().strftime('%H:%M:%S')} ", "dim"),
                (f" [bold white]{exit_hint}[/]", "")
            )
        )
        return Panel(footer_grid, border_style="dim", expand=True)

async def fetch_job_state(streamer):
    logging.debug("Starting fetch_job_state loop")
    headers = {"Authorization": f"Bearer {streamer.api_key}"}
    while not streamer._stop_event.is_set():
        try:
            loop = asyncio.get_event_loop()
            res = await loop.run_in_executor(None, lambda: requests.get(f"{streamer.api_base}/jobs/{streamer.job_id}", headers=headers, timeout=2))
            if res.ok:
                data = res.json()
                streamer.status = data.get("status", "RUNNING").upper()
                result = data.get("result", {})
                if result:
                    streamer.progress = result.get("progress_pct", streamer.progress)
                    streamer.url = result.get("url", streamer.url)
        except Exception as e:
            logging.error(f"Error in fetch_job_state: {e}")
        await asyncio.sleep(2)

async def stream_logs(streamer):
    logging.debug("Starting stream_logs loop")
    ws_url = f"{streamer.ws_base}/ws/logs/{streamer.job_id}?token={streamer.api_key}"
    logging.debug(f"WS URL: {ws_url}")
    while not streamer._stop_event.is_set():
        try:
            streamer.ws_status = "CONNECTING"
            async with websockets.connect(ws_url, open_timeout=5) as websocket:
                streamer.ws_status = "CONNECTED"
                logging.debug("WS Connected")
                while not streamer._stop_event.is_set():
                    message = await asyncio.wait_for(websocket.recv(), timeout=0.5)
                    data = json.loads(message)
                    if isinstance(data, list): streamer.logs.extend(data)
                    else: streamer.logs.append(data)
        except (asyncio.TimeoutError, websockets.ConnectionClosed) as e:
            logging.warning(f"WS Connection closed/timeout: {e}")
            streamer.ws_status = "DISCONNECTED"
            await asyncio.sleep(1)
        except Exception as e:
            logging.error(f"WS Exception: {e}")
            streamer.ws_status = "ERROR"
            await asyncio.sleep(2)

async def wait_for_finish(job_id: str):
    """Waits for a job to complete quietly with a progress spinner."""
    api_key = config.get_api_key()
    api_base = config.get_api_base()
    
    streamer = LogStreamer(job_id, "Application")
    
    with console.status("[bold blue]Waiting for deployment to finish...") as status:
        while True:
            try:
                res = requests.get(f"{api_base}/jobs/{job_id}", headers={"Authorization": f"Bearer {api_key}"}, timeout=2)
                if res.ok:
                    data = res.json()
                    streamer.status = data.get("status", "RUNNING").upper()
                    result = data.get("result", {})
                    if result:
                        streamer.progress = result.get("progress_pct", streamer.progress)
                        streamer.url = result.get("url", streamer.url)
                        status.update(f"[bold blue]Deploying... {streamer.progress}%")
                
                if streamer.status in ["SUCCESS", "FAILED"]:
                    break
            except Exception: pass
            await asyncio.sleep(2)

    # Final Summary
    print_final_summary(streamer)

def print_final_summary(streamer):
    if streamer.status == "SUCCESS":
        console.print(f"\n [bold green]✔ DEPLOYMENT SUCCESSFUL[/bold green]")
        if streamer.url:
            console.print(f" [bold]Live Link:[/bold] [cyan underline]{streamer.url}[/cyan underline]\n")
    elif streamer.status == "FAILED":
        console.print(f"\n [bold red]✘ DEPLOYMENT FAILED[/bold red]\n")
    else:
        console.print(f"\n [bold yellow]! DEPLOYMENT TERMINATED ({streamer.status})[/bold yellow]\n")

async def run_logs(job_id: Optional[str] = None):
    logging.debug("run_logs called")
    # Context resolution
    app_name = "Application"
    if not job_id:
        ctx = context.get_project_context()
        app_id = ctx.get("app_id")
        app_name = ctx.get("name", "Application")
        if not app_id:
            console.print("[red]Error:[/red] No project linked.")
            return
        key = config.get_api_key()
        api_base = config.get_api_base()
        try:
            res = requests.get(f"{api_base}/jobs?app_id={app_id}&limit=1", headers={"Authorization": f"Bearer {key}"}, timeout=2)
            if res.ok:
                jobs = res.json().get("jobs", [])
                if jobs: job_id = str(jobs[0]["id"])
        except Exception as e:
            logging.error(f"Context resolution error: {e}")
        if not job_id:
            console.print("[yellow]No jobs found for this application.[/yellow]")
            return
    else:
        api_key = config.get_api_key()
        api_base = config.get_api_base()
        try:
            res = requests.get(f"{api_base}/jobs/{job_id}", headers={"Authorization": f"Bearer {api_key}"})
            if res.ok:
                app_id_val = res.json().get("app_id")
                if app_id_val:
                    app_res = requests.get(f"{api_base}/apps/{app_id_val}", headers={"Authorization": f"Bearer {api_key}"})
                    if app_res.ok: app_name = app_res.json().get("name", "Application")
        except Exception as e:
            logging.error(f"App name fetch error: {e}")

    streamer = LogStreamer(job_id, app_name)
    
    console.print(f"[bold blue]STREAMING LOGS:[/bold blue] [cyan]{app_name}[/cyan] ([dim]{job_id}[/dim])")
    console.print("[dim]Press 'q' to stop logs (job continues) or Ctrl+C to exit.[/dim]\n")

    tasks = [
        asyncio.create_task(stream_logs(streamer)),
        asyncio.create_task(fetch_job_state(streamer)),
    ]

    # --- KEYBOARD LISTENER (NON-BLOCKING) ---
    stop_logs = False
    fd = sys.stdin.fileno()
    old_settings = termios.tcgetattr(fd)

    last_log_count = 0
    try:
        tty.setcbreak(fd) # Use cbreak instead of raw for simpler line-based logs
        while streamer.status == "RUNNING" or (not stop_logs and last_log_count < len(streamer.logs)):
            # Check for 'q'
            if select.select([sys.stdin], [], [], 0.05)[0]:
                ch = sys.stdin.read(1)
                if ch.lower() == 'q':
                    stop_logs = True
                    console.print("\n[yellow]Log streaming stopped. Waiting for deployment to finish...[/yellow]")
                    # Cancel the log stream task but keep fetch_job_state
                    tasks[0].cancel()
            
            if not stop_logs and len(streamer.logs) > last_log_count:
                for log in streamer.logs[last_log_count:]:
                    ts = log.get("created_at", "").split("T")[-1][:8]
                    msg = log.get("message", "")
                    console.print(f"[dim]{ts}[/dim] > {msg}")
                last_log_count = len(streamer.logs)
            
            if streamer.status in ["SUCCESS", "FAILED"]:
                if stop_logs or last_log_count == len(streamer.logs):
                    break
                
            await asyncio.sleep(0.2)
    except KeyboardInterrupt:
        console.print("\n[yellow]Deployment monitor stopped.[/yellow]")
    finally:
        termios.tcsetattr(fd, termios.TCSADRAIN, old_settings)
        for t in tasks: t.cancel()

    # Final Summary
    print_final_summary(streamer)
