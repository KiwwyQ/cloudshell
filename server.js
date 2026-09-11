const express = require('express');
const { exec } = require('child_process');
const app = express();

const SHELL_PASSWORD = process.env.SHELL_PASSWORD || 'password123';
const PORT = process.env.PORT || 3000;

const sessions = new Set(); // Store active session tokens

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get('/', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>Cloud Shell</title>
      <style>
        body { font-family: monospace; background: #1e1e1e; color: #00ff00; padding: 20px; }
        .container { max-width: 800px; margin: 0 auto; }
        input, textarea { background: #2d2d2d; color: #00ff00; border: 1px solid #00ff00; padding: 10px; width: 100%; box-sizing: border-box; margin: 10px 0; }
        button { background: #00ff00; color: #000; padding: 10px 20px; border: none; cursor: pointer; }
        #output { background: #0a0a0a; border: 1px solid #00ff00; padding: 15px; margin-top: 15px; height: 400px; overflow-y: auto; white-space: pre-wrap; word-wrap: break-word; }
        .auth-form { margin-bottom: 20px; }
      </style>
    </head>
    <body>
      <div class="container">
        <h1>🔧 Cloud Shell Access</h1>
        
        <div class="auth-form" id="authForm">
          <label>Password:</label>
          <input type="password" id="password" placeholder="Enter shell password">
          <button onclick="authenticate()">Login</button>
        </div>

        <div id="shell" style="display:none;">
          <label>Command:</label>
          <input type="text" id="command" placeholder="Enter command" autofocus>
          <button onclick="executeCommand()">Execute</button>
          <button onclick="logout()">Logout</button>
          <div id="output"></div>
        </div>
      </div>

      <script>
        let token = null;

        function authenticate() {
          const pwd = document.getElementById('password').value;
          fetch('/api/auth', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ password: pwd })
          })
          .then(r => r.json())
          .then(data => {
            if (data.success) {
              token = data.token;
              document.getElementById('authForm').style.display = 'none';
              document.getElementById('shell').style.display = 'block';
              document.getElementById('output').textContent = 'Authenticated! Type a command above.';
              document.getElementById('command').focus();
            } else {
              alert('Wrong password');
            }
          });
        }

        function executeCommand() {
          if (!token) return;
          const cmd = document.getElementById('command').value;
          if (!cmd) return;

          document.getElementById('output').textContent += '\\n$ ' + cmd + '\\n';
          document.getElementById('command').value = '';

          fetch('/api/execute', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ command: cmd, token: token })
          })
          .then(r => r.json())
          .then(data => {
            document.getElementById('output').textContent += data.output + '\\n';
            document.getElementById('output').scrollTop = document.getElementById('output').scrollHeight;
          })
          .catch(e => {
            document.getElementById('output').textContent += 'Error: ' + e + '\\n';
          });
        }

        function logout() {
          token = null;
          document.getElementById('authForm').style.display = 'block';
          document.getElementById('shell').style.display = 'none';
          document.getElementById('password').value = '';
          document.getElementById('command').value = '';
          document.getElementById('output').textContent = '';
        }

        document.getElementById('password').addEventListener('keypress', (e) => {
          if (e.key === 'Enter') authenticate();
        });
        document.getElementById('command').addEventListener('keypress', (e) => {
          if (e.key === 'Enter') executeCommand();
        });
      </script>
    </body>
    </html>
  `);
});

// Authentication endpoint
app.post('/api/auth', (req, res) => {
  const { password } = req.body;
  if (password === SHELL_PASSWORD) {
    const token = require('crypto').randomBytes(16).toString('hex');
    sessions.add(token);
    res.json({ success: true, token });
  } else {
    res.json({ success: false });
  }
});

// Command execution endpoint - REQUIRES VALID TOKEN
app.post('/api/execute', (req, res) => {
  const { command, token } = req.body;

  if (!token || !sessions.has(token)) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  if (!command) {
    return res.status(400).json({ error: 'Command required' });
  }

  exec(command, { timeout: 5000 }, (error, stdout, stderr) => {
    if (error) {
      return res.json({ output: stderr || error.message });
    }
    res.json({ output: stdout });
  });
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
