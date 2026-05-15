import typer
import requests
from rich.console import Console
from rich.table import Table
from typing import Optional
from . import config
from . import context

app = typer.Typer(help="Manage your AutoDeploy applications")
console = Console()

@app.command(name="list")
def list_apps():
    """
    List all applications you have access to.
    """
    key = config.get_api_key()
    if not key:
        console.print("[red]Error:[/red] Not logged in. Run 'ad login' first.")
        return

    api_base = config.get_api_base()
    try:
        response = requests.get(
            f"{api_base}/apps",
            headers={"Authorization": f"Bearer {key}"}
        )
        if response.ok:
            data = response.json()
            apps = data.get("apps", [])
            
            if not apps:
                console.print("[yellow]No applications found.[/yellow]")
                return

            table = Table(title="Your Applications", border_style="blue")
            table.add_column("Name", style="bold cyan")
            table.add_column("Status", style="bold")
            table.add_column("Role", style="magenta")
            table.add_column("Branch", style="green")
            table.add_column("Last Updated", style="dim")

            for a in apps:
                table.add_row(
                    a['name'],
                    "RUNNING", # In a real app, we'd fetch the latest job status
                    a['role'],
                    a['branch'],
                    a['updated_at'].split('T')[0]
                )
            
            console.print(table)
        else:
            console.print("[red]Error:[/red] Could not fetch applications.")
    except Exception as e:
        console.print(f"[red]Error:[/red] Connection failed: {e}")

@app.command()
def deploy(
    app_id: Optional[str] = typer.Argument(
        None, 
        help="The UUID of the application. If omitted, AutoDeploy looks for a link in .ad_project or creates a new app."
    ),
    name: Optional[str] = typer.Option(
        None, "--name", "-n", 
        help="Manual name for the app. Only used during initial creation or to override detection."
    )
):
    """
    🚀 Deploy the current project to AutoDeploy.

    This command performs a 'Smart Sync' before triggering:
    1. Detects Git remote (origin) and branch.
    2. Loads 'autodeploy.yml' for build steps and stack configuration.
    3. Injects environment variables from local '.env' file.
    4. Automatically links the local folder to the remote App ID.

    If the app doesn't exist, it will be created using the detected name or the --name flag.
    """
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
                    "pre_build_steps": ctx["pre_build_steps"],
                    "post_build_steps": ctx["post_build_steps"],
                    "env_vars": ctx["env_vars"]
                }
            )
            
            if not create_res.ok:
                console.print(f"[red]Error creating app:[/red] {create_res.json().get('detail', 'Unknown error')}")
                return
            
            app_data = create_res.json()
            final_app_id = app_data["id"]
            context.save_project_link(ctx["root"], final_app_id)
            console.print(f"[green]✔ App created and linked locally.[/green]")
        else:
            # --- UPDATE EXISTING APP (Optional but recommended for consistency) ---
            if "error" not in ctx:
                console.print(f"[bold blue]Syncing configuration for [cyan]{ctx['name']}[/cyan]...")
                requests.patch(
                    f"{api_base}/apps/{final_app_id}",
                    headers=headers,
                    json={
                        "branch": ctx["branch"],
                        "pre_build_steps": ctx["pre_build_steps"],
                        "post_build_steps": ctx["post_build_steps"],
                        "env_vars": ctx["env_vars"]
                    }
                )

        # 2. TRIGGER DEPLOYMENT
        with console.status(f"[bold blue]Triggering deployment..."):
            response = requests.post(
                f"{api_base}/apps/{final_app_id}/deploy",
                headers=headers
            )
        
        if response.ok:
            data = response.json()
            console.print(f"[bold green]🚀 Deployment triggered![/bold green]")
            console.print(f"Job ID: [dim]{data['id']}[/dim]")
            
            # Auto-trigger logs
            from . import logs
            import asyncio
            
            if typer.confirm("Would you like to stream the logs now?", default=True):
                asyncio.run(logs.run_logs(data['id']))
            else:
                asyncio.run(logs.wait_for_finish(data['id']))
        else:
            console.print(f"[red]Error:[/red] Deployment failed. {response.json().get('detail', '')}")
            
    except Exception as e:
        console.print(f"[red]Error:[/red] Connection failed: {e}")
