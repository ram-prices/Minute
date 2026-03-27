import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";

async function startServer() {
  const app = express();
  const PORT = 3000;

  // API routes FIRST
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  // OAuth callback route
  app.get(["/auth/callback", "/auth/callback/"], (req, res) => {
    res.send(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Authenticating...</title>
        </head>
        <body>
          <script>
            if (window.opener) {
              const hash = window.location.hash;
              const search = window.location.search;
              window.opener.postMessage({ type: 'OAUTH_AUTH_SUCCESS', hash, search }, '*');
              window.close();
            } else {
              window.location.href = '/';
            }
          </script>
          <p>Authentication successful. This window should close automatically.</p>
        </body>
      </html>
    `);
  });

  // Proxy for Reddit token exchange to avoid CORS
  app.post("/api/auth/token", express.json(), async (req, res) => {
    const { grant_type, code, redirect_uri, client_id, refresh_token } = req.body;
    
    const params = new URLSearchParams();
    params.append('grant_type', grant_type);
    if (code) params.append('code', code);
    if (redirect_uri) params.append('redirect_uri', redirect_uri);
    if (refresh_token) params.append('refresh_token', refresh_token);

    try {
      const authHeader = Buffer.from(`${client_id}:`).toString('base64');
      const response = await fetch('https://www.reddit.com/api/v1/access_token', {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${authHeader}`,
          'Content-Type': 'application/x-www-form-urlencoded',
          'User-Agent': 'MinutePWA/1.0.0'
        },
        body: params.toString()
      });

      const data = await response.json();
      res.status(response.status).json(data);
    } catch (error) {
      console.error('Token exchange error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  app.get("/api/media-proxy", async (req, res) => {
    const url = req.query.url as string;
    if (!url || !url.startsWith('https://')) {
      return res.status(400).json({ error: 'Invalid URL' });
    }
    // Allowlist only known Reddit/media domains
    const allowed = ['v.redd.it', 'i.redd.it', 'preview.redd.it',
                     'i.imgur.com', 'media.giphy.com', 'media.tenor.com', 'tenor.com', 'giphy.com'];
    try {
      const host = new URL(url).hostname;
      if (!allowed.some(d => host.endsWith(d))) {
        return res.status(403).json({ error: 'Domain not allowed' });
      }
      const response = await fetch(url, {
        headers: { 'User-Agent': 'MinutePWA/1.0.0' }
      });
      res.setHeader('Content-Type', response.headers.get('content-type') ?? 'video/mp4');
      res.setHeader('Cache-Control', 'public, max-age=3600');
      
      if (response.body) {
        // @ts-ignore - node fetch stream types
        const reader = response.body.getReader();
        const pump = async () => {
          while (true) {
            const { done, value } = await reader.read();
            if (done) {
              res.end();
              break;
            }
            res.write(value);
          }
        };
        await pump();
      } else {
        res.end();
      }
    } catch (error) {
      console.error('Media proxy error:', error);
      res.status(502).json({ error: 'Upstream fetch failed' });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
