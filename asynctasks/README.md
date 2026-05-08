
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