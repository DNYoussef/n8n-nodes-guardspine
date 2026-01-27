# n8n-nodes-guardspine

n8n community nodes for [GuardSpine](https://github.com/DNYoussef/life-os-dashboard) governance layer.

## Nodes

- **GuardSpine Gate** - Evaluate artifacts against governance rubrics. Routes to Pass/Block outputs based on risk tier.
- **Beads Create** - Create work items in the Beads task spine.

## Setup

1. Set `GUARDSPINE_API_KEY` in your n8n credentials
2. Point Base URL to your GuardSpine API instance

## Development

npm install
npm run build
npm test
