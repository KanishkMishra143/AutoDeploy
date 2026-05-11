const express = require('express');
const app = express();
const port = 8000;

app.get('/', (req, res) => {
  res.send('<h1>🚀 Hello from AutoDeploy Node.js!</h1><p>Environment: ' + JSON.stringify(process.env) + '</p>');
});

app.listen(port, () => {
  console.log(`Node app listening at http://localhost:${port}`);
});
