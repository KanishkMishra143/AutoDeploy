import typer
import requests
import json
from rich.console import Console
from rich.table import Table
from typing import Optional
from . import config, context, logs
from uuid import UUID

app = typer.Typer(help="Manage and deploy applications")
console = Console()

def stream_logs(job_id: str, app_name: str):
    """Bridge to logs.run_logs"""
    import asyncio
    asyncio.run(logs.run_logs(job_id))

def wait_for_finish(job_id: str):
    """Bridge to logs.wait_for_finish"""
    import asyncio
    asyncio.run(logs.wait_for_finish(job_id))

@app.command("list")
def list_apps():
    """Lists all your managed applications"""
    key = config.get_api_key()
    if not key:
        console.print("[red]Error:[/red] Not logged in. Run 'ad login' first.")
        return

    api_base = config.get_api_base()
    headers = {"Authorization": f"Bearer {key}"}

    try:
        response = requests.get(f"{api_base}/apps", headers=headers)
        if response.ok:
            data = response.json()
            apps = data.get("apps", [])
            
            if not apps:
                console.print("[yellow]No applications found.[/yellow]")
                return

            table = Table(title="Your Applications")
            table.add_column("Name", style="cyan")
            table.add_column("ID", style="dim")
            table.add_column("Stack", style="green")
            table.add_column("Branch", style="magenta")
            table.add_column("Role", style="yellow")
            table.add_column("Last Updated", style="dim")

            for a in apps:
                table.add_row(
                    a["name"],
                    str(a["id"])[:8] + "...",
                    a["stack"],
                    a["branch"],
                    a.get("role", "OWNER"),
                    a["updated_at"]
                )
            
            console.print(table)
        else:
            console.print(f"[red]Error fetching apps:[/red] {response.json().get('detail', 'Unknown error')}")
    except Exception as e:
        console.print(f"[red]Unexpected Error:[/red] {str(e)}")

@app.command("deploy")
def deploy(
    name: Optional[str] = typer.Option(None, "--name", "-n", help="Application name override"),
    app_id: Optional[str] = typer.Option(None, "--app-id", "-id", help="Target App ID override"),
    stream: bool = typer.Option(True, "--stream/--no-stream", help="Stream logs immediately")
):
    """Deploys the current project"""
    key = config.get_api_key()
    if not key:
        console.print("[red]Error:[/red] Not logged in. Run 'ad login' first.")
        return

    api_base = config.get_api_base()
    ctx = context.get_project_context()
    
    # 1. Resolve which App ID and Name to use
    final_app_id = app_id or ctx.get("app_id")
    final_name = name or ctx["name"]
    headers = {"Authorization": f"Bearer {key}"}

    try:
        if not final_app_id:
            # --- CREATE NEW APP ---
            if "error" in ctx:
                console.print(f"[red]Error:[/red] {ctx['error']}")
                return

            console.print(f"[bold blue]Creating new application: [cyan]{final_name}[/cyan]...")
            create_res = requests.post(
                f"{api_base}/apps",
                headers=headers,
                json={
                    "name": final_name,
                    "repo_url": ctx["repo_url"],
                    "branch": ctx["branch"],
                    "stack": ctx["stack"],
                    "internal_port": ctx["internal_port"],
                    "volumes": ctx["volumes"],
                    "root_dir": ctx["root_dir"],
                    "pre_build_steps": ctx["pre_build_steps"],
                    "post_build_steps": ctx["post_build_steps"],
                    "env_vars": ctx["env_vars"]
                }
            )
            
            if not create_res.ok:
                console.print(f"[red]Error creating app ({create_res.status_code}):[/red] {create_res.json().get('detail', 'Unknown error')}")
                return
            
            app_data = create_res.json()
            final_app_id = app_data["id"]
            context.save_project_link(ctx["root"], final_app_id)
            console.print(f"[green]✔ App created and linked locally.[/green]")
        else:
            # --- UPDATE EXISTING APP (Optional but recommended for consistency) ---
            if "error" not in ctx:
                console.print(f"[bold blue]Syncing configuration for [cyan]{final_name}[/cyan]...")
                patch_res = requests.patch(
                    f"{api_base}/apps/{final_app_id}",
                    headers=headers,
                    json={
                        "name": final_name,
                        "branch": ctx["branch"],
                        "internal_port": ctx["internal_port"],
                        "volumes": ctx["volumes"],
                        "root_dir": ctx["root_dir"],
                        "pre_build_steps": ctx["pre_build_steps"],
                        "post_build_steps": ctx["post_build_steps"],
                        "env_vars": ctx["env_vars"]
                    }
                )
                if not patch_res.ok:
                    console.print(f"[red]Error syncing app config ({patch_res.status_code}):[/red] {patch_res.json().get('detail', 'Unknown error')}")
                    if patch_res.status_code == 404:
                        console.print("[yellow]Hint:[/yellow] The linked App ID in .ad_project might be invalid. Try deleting .ad_project and deploying again.")
                    return

        # 2. TRIGGER DEPLOYMENT
        with console.status(f"[bold blue]Triggering deployment..."):
            response = requests.post(
                f"{api_base}/apps/{final_app_id}/deploy?trigger_reason=Manual:CLI",
                headers=headers
            )
        
        if response.ok:
            job_data = response.json()
            console.print(f"[green]🚀 Deployment triggered![/green]")
            console.print(f"Job ID: [cyan]{job_data['id']}[/cyan]")
            
            if stream:
                if typer.confirm("Would you like to stream the logs now?", default=True):
                    stream_logs(job_data['id'], final_name)
                else:
                    wait_for_finish(job_data['id'])
        else:
            error_detail = response.json().get('detail', 'Deployment failed')
            console.print(f"[red]Error ({response.status_code}):[/red] {error_detail}")
            if response.status_code == 404:
                 console.print("[yellow]Hint:[/yellow] Application ID not found in the database. Your .ad_project file might be stale.")

    except Exception as e:
        console.print(f"[red]Unexpected Error:[/red] {str(e)}")

@app.command("delete")
def delete_app(app_id: str):
    """Deletes an application and its history"""
    key = config.get_api_key()
    api_base = config.get_api_base()
    headers = {"Authorization": f"Bearer {key}"}

    if typer.confirm(f"Are you sure you want to delete app {app_id}?"):
        res = requests.delete(f"{api_base}/apps/{app_id}", headers=headers)
        if res.ok:
            console.print("[green]✔ Application deletion scheduled.[/green]")
        else:
            console.print(f"[red]Error:[/red] {res.json().get('detail', 'Failed to delete')}")

@app.command("logs")
def get_logs(app_id: str):
    """Shows logs for the latest job of an app"""
    key = config.get_api_key()
    api_base = config.get_api_base()
    headers = {"Authorization": f"Bearer {key}"}

    # 1. Get latest job
    res = requests.get(f"{api_base}/jobs?app_id={app_id}&limit=1", headers=headers)
    if res.ok:
        jobs = res.json().get("jobs", [])
        if not jobs:
            console.print("[yellow]No jobs found for this app.[/yellow]")
            return
        
        job_id = jobs[0]["id"]
        # 2. Get logs
        logs_res = requests.get(f"{api_base}/jobs/{job_id}/logs", headers=headers)
        if logs_res.ok:
            data = logs_res.json().get("logs", [])
            for l in data:
                console.print(f"[dim]{l['created_at']}[/dim] {l['message']}")
        else:
            console.print("[red]Error fetching logs.[/red]")
    else:
        console.print("[red]Error fetching jobs.[/red]")
