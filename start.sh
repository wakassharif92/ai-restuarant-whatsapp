#!/bin/bash
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
nvm use 22
cd "/Users/wakassharif/Projects/AI Agents/restaurants"
node local-server.js
