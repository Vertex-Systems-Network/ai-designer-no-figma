# Optional remote MCP tunnel for browser AI clients

This path exposes the **custom local MCP server**, not Figma's official hosted MCP. A compatible online AI client can call its tools over HTTPS while the Figma plugin polls the local pairing bridge on the same computer. The AI client may be free or paid; this project uses no provider inference API token. An online client must support adding a custom Streamable HTTP MCP URL and a bearer secret. A URL alone cannot authorize tool calls.

## Boundaries

- `127.0.0.1:8788`: Figma plugin pairing and job transport. **Never tunnel this port.**
- `127.0.0.1:8790/mcp`: separate remote AI ingress, bearer authenticated. Tunnel only this port.
- The remote token is generated locally at `~/.ai-designer-no-figma/remote-mcp-token` and differs from the plugin pairing credential. Do not post it in chat, screenshots, GitHub issues or URL query strings. Only the named online AI client should receive it in its secret/header field.
- Requests with browser `Origin` headers are rejected; the endpoint is for server-side MCP clients. It binds to loopback, caps concurrent requests and payloads, and returns JSON (no SSE requirement).
- The Figma file, plugin and local process must remain open. A tunnel does not keep a closed plugin alive or install a development plugin into a Figma browser tab. The browser plugin may need prior registration/distribution; this has not been live verified.

## Windows setup

1. Extract the current repo package on the computer running Figma. Install Node.js 20+ and run `npm ci` in the extracted project directory.
2. In Figma Design, run the installed plugin in the file you want to test. Its **Settings → Connect & hide panel** pairs with the local bridge after step 3. If the development plugin cannot run in the browser, use the Figma desktop editor for this plugin session; browser-only plugin distribution requires a separate Figma registration step.
3. In PowerShell, from the project directory, run `npm run mcp:remote`. This starts the pairing bridge on 8788 and the remote MCP listener on 8790. Leave it running; then connect the plugin in Settings.
4. Install `cloudflared` and, in a second PowerShell window, run `cloudflared tunnel --url http://localhost:8790`. Copy the temporary HTTPS hostname it prints and append `/mcp`. Cloudflare Quick Tunnels are for development and do not require an account. Alternatively, a configured ngrok account can forward port 8790.
5. Read the remote secret **locally** with `Get-Content "$env:USERPROFILE\.ai-designer-no-figma\remote-mcp-token"`. In an AI client that supports custom Streamable HTTP MCP plus bearer authentication, enter `https://<temporary-hostname>/mcp` and the secret in its bearer-token setting. Never put the secret into the URL or a model prompt.
6. Call `figma_get_connection_status`; expect one connected plugin session. Then call `figma_get_selection` and `figma_get_job_result` to verify read-only routing before trying `figma_import_design_schema`. Keep the target file open. Stop the tunnel when testing ends.

The online AI client may require OAuth instead of a static bearer credential, or may not support custom MCP servers at all. In that case this endpoint cannot connect to that client without an additional client-specific authentication adapter. The temporary URL is not a guarantee of model capability or visual design quality.

## Evidence

Automated tests negotiate MCP over authenticated HTTP, reject missing auth and browser origins, reject public listener binding, and route a remote tool call through the same broker to a locally paired plugin simulation and back. A real Figma browser plugin, public tunnel, and named online AI client have **not** been tested in this environment.
