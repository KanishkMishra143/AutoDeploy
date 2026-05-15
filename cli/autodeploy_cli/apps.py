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
                f"{api_base}/apps/{final_app_id}/deploy?trigger_reason=Manual:CLI",
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

@app.command(name="env-list")
def env_list(
    app_id: Optional[str] = typer.Argument(None, help="The ID of the application")
):
    """
    📋 List all environment variables for an application.
    """
    key = config.get_api_key()
    api_base = config.get_api_base()
    ctx = context.get_project_context()
    final_app_id = app_id or ctx.get("app_id")

    if not final_app_id:
        console.print("[red]Error:[/red] No application linked. Provide an app_id or run inside a linked project.")
        return

    try:
        res = requests.get(f"{api_base}/apps/{final_app_id}", headers={"Authorization": f"Bearer {key}"})
        if res.ok:
            app_data = res.json()
            env_vars = app_data.get("env_vars", {})
            if not env_vars:
                console.print("[yellow]No environment variables found.[/yellow]")
                return

            table = Table(title=f"Environment Variables: {app_data['name']}", border_style="cyan")
            table.add_column("Key", style="bold green")
            table.add_column("Value", style="dim")

            for k, v in env_vars.items():
                # Mask secrets if they look sensitive but show enough for context
                display_val = f"{v[:4]}...{v[-4:]}" if len(v) > 12 else "***"
                if v.startswith("vault://"): display_val = f"[magenta]{v}[/magenta]"
                table.add_row(k, display_val)
            
            console.print(table)
        else:
            console.print("[red]Error:[/red] Could not fetch environment variables.")
    except Exception as e:
        console.print(f"[red]Error:[/red] {e}")

@app.command(name="env-set")
def env_set(
    pair: str = typer.Argument(..., help="The KEY=VALUE pair to set"),
    app_id: Optional[str] = typer.Argument(None, help="The ID of the application")
):
    """
    🔑 Set an environment variable (KEY=VALUE).
    """
    if "=" not in pair:
        console.print("[red]Error:[/red] Format must be KEY=VALUE")
        return

    key_name, val = pair.split("=", 1)
    key = config.get_api_key()
    api_base = config.get_api_base()
    ctx = context.get_project_context()
    final_app_id = app_id or ctx.get("app_id")

    try:
        # Get current env first to merge
        res = requests.get(f"{api_base}/apps/{final_app_id}", headers={"Authorization": f"Bearer {key}"})
        if res.ok:
            current_env = res.json().get("env_vars", {})
            current_env[key_name.strip()] = val.strip()
            
            update_res = requests.patch(
                f"{api_base}/apps/{final_app_id}",
                headers={"Authorization": f"Bearer {key}"},
                json={"env_vars": current_env}
            )
            if update_res.ok:
                console.print(f"[green]✔ Set {key_name.strip()} successfully.[/green]")
            else:
                console.print("[red]Error updating environment variables.[/red]")
    except Exception as e:
        console.print(f"[red]Error:[/red] {e}")

@app.command(name="env-get")
def env_get(
    key_name: str = typer.Argument(..., help="The key to retrieve"),
    app_id: Optional[str] = typer.Argument(None, help="The ID of the application")
):
    """
    🔍 Get the value of a specific environment variable.
    """
    key = config.get_api_key()
    api_base = config.get_api_base()
    ctx = context.get_project_context()
    final_app_id = app_id or ctx.get("app_id")

    try:
        res = requests.get(f"{api_base}/apps/{final_app_id}", headers={"Authorization": f"Bearer {key}"})
        if res.ok:
            val = res.json().get("env_vars", {}).get(key_name)
            if val:
                console.print(f"[bold green]{key_name}[/bold green] = [cyan]{val}[/cyan]")
            else:
                console.print(f"[yellow]Key '{key_name}' not found.[/yellow]")
    except Exception as e:
        console.print(f"[red]Error:[/red] {e}")
