#!/usr/bin/env node
import { Command } from 'commander'
import { hostname } from 'os'
import { startAgent } from './agent.js'

const program = new Command()

program
  .name('freesomnia-agent')
  .description('FreeSomnia local proxy agent — run API requests from your machine')
  .version('0.1.0')
  .requiredOption('--server <url>', 'FreeSomnia server URL (e.g., https://freesomnia.example.com)')
  .requiredOption('--email <email>', 'Login email')
  .requiredOption('--password <password>', 'Login password')
  .option('--name <name>', 'Agent name (shown in UI)', hostname())
  .option('--no-reconnect', 'Disable auto-reconnect on disconnect')
  .action(async (opts) => {
    await startAgent({
      serverUrl: opts.server.replace(/\/+$/, ''),
      email: opts.email,
      password: opts.password,
      agentName: opts.name,
      autoReconnect: opts.reconnect !== false,
    })
  })

program.parse()
