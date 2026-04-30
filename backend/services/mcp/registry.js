const knowledge = require('./knowledge');
const web = require('./web');
const files = require('./files');
const database = require('./database');

const tools = {};

function register(name, schema, handler) {
    tools[name] = { schema, handler };
}

knowledge.register(register);
web.register(register);
files.register(register);
database.register(register);

function getToolSchemas() {
    return Object.entries(tools).map(([name, tool]) => ({
        type: 'function',
        function: {
            name,
            description: tool.schema.description,
            parameters: tool.schema.parameters
        }
    }));
}

async function executeToolCall(name, args, userId) {
    const tool = tools[name];
    if (!tool) throw new Error('Unknown tool: ' + name);

    const start = Date.now();
    const result = await tool.handler(args, userId);
    const duration = Date.now() - start;

    console.log(`[MCP] ${name} executed in ${duration}ms`);
    return result;
}

module.exports = { getToolSchemas, executeToolCall };
