// Node test environment (real fetch Request/Response for API routes) with a bare `window`
// so the shared jest.setup.js can still define its wallet mocks.
const NodeEnvironment = require('jest-environment-node').TestEnvironment

class NodeWindowEnvironment extends NodeEnvironment {
  async setup() {
    await super.setup()
    this.global.window = this.global
  }
}

module.exports = NodeWindowEnvironment
