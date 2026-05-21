import typer
import requests
from rich.console import Console
from rich.table import Table
from typing import Optional, List
from . import config
from pathlib import Path
from rich.panel import Panel

app = typer.Typer(help="Manage authentication, API keys, and credentials")
console = Console()

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
        console.print("[yellow]Not logged in.[/yellow] Run 'ad auth login' first.")
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

# --- CREDENTIALS SUB-COMMANDS ---
cred_app = typer.Typer(help="Manage Deployment Credentials (PATs and SSH Keys)")
app.add_typer(cred_app, name="credentials")

@cred_app.command("list")
def list_credentials():
    """Lists all your stored deployment credentials"""
    key = config.get_api_key()
    api_base = config.get_api_base()
    if not key:
        console.print("[red]Error:[/red] Not logged in.")
        return

    headers = {"Authorization": f"Bearer {key}"}
    try:
        response = requests.get(f"{api_base}/auth/credentials", headers=headers)
        if response.ok:
            creds = response.json()
            if not creds:
                console.print("[yellow]No credentials found.[/yellow]")
                return

            table = Table(title="Deployment Credentials")
            table.add_column("Name", style="cyan")
            table.add_column("Type", style="green")
            table.add_column("ID", style="dim")
            table.add_column("Created At", style="dim")

            for c in creds:
                table.add_row(c["name"], c["type"], str(c["id"]), c["created_at"])
            console.print(table)
        else:
            console.print(f"[red]Error:[/red] {response.json().get('detail', 'Unknown error')}")
    except Exception as e:
        console.print(f"[red]Error:[/red] {e}")

@cred_app.command("add")
def add_credential(
    name: str = typer.Argument(..., help="Descriptive name for the credential"),
    type: str = typer.Option(..., "--type", "-t", help="Credential type: SSH or PAT"),
    value: Optional[str] = typer.Option(None, "--value", "-v", help="The raw PAT token or path to SSH private key file"),
):
    """Securely stores a new deployment credential (SSH Private Key or PAT)"""
    key = config.get_api_key()
    api_base = config.get_api_base()
    if not key:
        console.print("[red]Error:[/red] Not logged in.")
        return

    if not value:
        if type.upper() == "SSH":
            value = typer.prompt("Enter path to your SSH private key file")
        else:
            value = typer.prompt("Enter your Personal Access Token (PAT)", hide_input=True)

    final_value = value
    # If it's SSH and looks like a path, read it
    if type.upper() == "SSH" and Path(value).expanduser().exists():
        try:
            final_value = Path(value).expanduser().read_text()
        except Exception as e:
            console.print(f"[red]Error reading SSH key file:[/red] {e}")
            return

    headers = {"Authorization": f"Bearer {key}"}
    payload = {
        "name": name,
        "type": type.upper(),
        "value": final_value
    }

    try:
        response = requests.post(f"{api_base}/auth/credentials", headers=headers, json=payload)
        if response.ok:
            console.print(f"[green]✔ Credential '{name}' successfully added.[/green]")
        else:
            console.print(f"[red]Error:[/red] {response.json().get('detail', 'Unknown error')}")
    except Exception as e:
        console.print(f"[red]Error:[/red] {e}")

@cred_app.command("delete")
def delete_credential(credential_id: str):
    """Deletes a stored credential"""
    key = config.get_api_key()
    api_base = config.get_api_base()
    headers = {"Authorization": f"Bearer {key}"}

    if typer.confirm(f"Are you sure you want to delete credential {credential_id}?"):
        try:
            res = requests.delete(f"{api_base}/auth/credentials/{credential_id}", headers=headers)
            if res.ok:
                console.print("[green]✔ Credential deleted.[/green]")
            else:
                console.print(f"[red]Error:[/red] {res.json().get('detail', 'Failed to delete')}")
        except Exception as e:
            console.print(f"[red]Error:[/red] {e}")


# --- API KEYS SUB-COMMANDS ---
key_app = typer.Typer(help="Manage CLI API Keys")
app.add_typer(key_app, name="keys")

@key_app.command("list")
def list_keys():
    """Lists metadata for your API keys"""
    key = config.get_api_key()
    api_base = config.get_api_base()
    headers = {"Authorization": f"Bearer {key}"}
    try:
        response = requests.get(f"{api_base}/auth/keys", headers=headers)
        if response.ok:
            keys = response.json()
            table = Table(title="Your API Keys")
            table.add_column("Name", style="cyan")
            table.add_column("Prefix", style="green")
            table.add_column("Expires At", style="dim")
            table.add_column("ID", style="dim")

            for k in keys:
                table.add_row(k["name"], k["key_prefix"], k["expires_at"] or "Never", str(k["id"]))
            console.print(table)
        else:
            console.print(f"[red]Error:[/red] {response.json().get('detail', 'Unknown error')}")
    except Exception as e:
        console.print(f"[red]Error:[/red] {e}")

@key_app.command("add")
def add_key(
    name: str = typer.Argument(..., help="Descriptive name for the key"),
    days: int = typer.Option(30, "--days", "-d", help="Validity period in days")
):
    """Generates a new API key"""
    key = config.get_api_key()
    api_base = config.get_api_base()
    headers = {"Authorization": f"Bearer {key}"}
    try:
        response = requests.post(f"{api_base}/auth/keys", headers=headers, json={"name": name, "validity_days": days})
        if response.ok:
            data = response.json()
            console.print(f"[green]✔ New API Key generated:[/green] [bold cyan]{data['secret_key']}[/bold cyan]")
            console.print("[yellow]Save this key now! It will not be shown again.[/yellow]")
        else:
            console.print(f"[red]Error:[/red] {response.json().get('detail', 'Unknown error')}")
    except Exception as e:
        console.print(f"[red]Error:[/red] {e}")

@key_app.command("delete")
def delete_key(key_id: str):
    """Revokes an API key"""
    key = config.get_api_key()
    api_base = config.get_api_base()
    headers = {"Authorization": f"Bearer {key}"}
    if typer.confirm(f"Are you sure you want to revoke key {key_id}?"):
        try:
            res = requests.delete(f"{api_base}/auth/keys/{key_id}", headers=headers)
            if res.ok:
                console.print("[green]✔ API Key revoked.[/green]")
            else:
                console.print(f"[red]Error:[/red] {res.json().get('detail', 'Failed to delete')}")
        except Exception as e:
            console.print(f"[red]Error:[/red] {e}")
