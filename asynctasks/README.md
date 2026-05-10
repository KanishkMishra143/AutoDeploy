
# Development

### For getting the server up and running 
 - Get docker-compose up and running: 
 ```
 docker-compose up -d
 ```
 - Get the API running: 
 ```
 uvicorn api.main:app --reload
 ```
 - Get the worker server running: 
 ```
 celery -A worker.celery_app worker --loglevel=INFO
 ```

 ### For persisting change into the database

 - Wind down the docker:
 ```
 docker-compose down -v  #-v deletes volume/data 
 ```
 - Start up docker again:
 ```
docker-compose up -d
 ```

### Test job creation:
```
curl -X POST http://127.0.0.1:8000/jobs -H "Content-Type: application/json" -d '{"payload": {"repo": "https://github.com/example/app"}}'
```

---

# 🚀 Production Features

## 🔔 Enabling Real GitHub Webhooks
To achieve the "Deploy on Push" experience for real, your local API needs to be accessible from the internet.

1. **Install ngrok**: Download from [ngrok.com](https://ngrok.com/).
2. **Start a Tunnel**: In a new terminal, run:
   ```bash
   ngrok http 8000
   ```
3. **Copy the URL**: Find the `Forwarding` URL (e.g., `https://xyz.ngrok-free.app`).
4. **GitHub Settings**: 
   - Go to your repository on GitHub.
   - Settings -> Webhooks -> Add Webhook.
   - **Payload URL**: `https://your-url.ngrok-free.app/webhooks/github`
   - **Content type**: `application/json`
   - **Events**: Just the `push` event.
5. **Push Code**: Make a change to your repo and `git push`. AutoDeploy will detect it instantly!

## 🔄 Versioning & Rollbacks
AutoDeploy automatically tracks the version history of your applications.
- **Stable Domains**: Every app has a stable URL based on its name.
- **Restore**: In the "History" tab of an application, you can click **RESTORE** on any successful previous version.
- **Provenance**: The system tracks why a deployment was triggered (Manual, Webhook, or Rollback) and includes metadata like commit hashes or source version numbers.
