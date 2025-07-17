const OpenAI = require("openai");
const dotenv = require('dotenv');
const readline = require('readline');
const db = require('./db.js');
const { tools, functions } = require('./tools.js');

dotenv.config();

const openai = new OpenAI({
    baseURL: 'https://api.deepseek.com',
    apiKey: process.env.deepseek_key
});

const readLineAsync = () => {
    const rl = readline.createInterface({
        input: process.stdin
    });

    return new Promise((resolve) => {
        rl.prompt();
        rl.on('line', (line) => {
            rl.close();
            resolve(line);
        });
    });
};

function parseMessages(rows) {
    let arr = '[';
    for (let i = 0; i < rows.length; i++) {
        arr += rows[i].message + ',';
    }
    return JSON.parse(arr.slice(0, -1) + ']');
}

(async () => {
    await db.dropTables();
    await db.ensureTables();

    let user_id = await db.postRecord('users', { id: 123456 });
    let message = { role: "system", content: "You are a helpful assistant." };

    await db.postRecord('messages', { user_id, message: JSON.stringify(message) });
    let messages;

    while (true) {
        const content = await readLineAsync(); // Tell me the time and throw 5 dice
        if (content === 'exit') { break; }
        await db.postRecord('messages', { user_id, message: JSON.stringify({ role: 'user', content }) })
        messages = await db.getAllRecords('messages', { user_id });
        let completion = await openai.chat.completions.create({
            messages: parseMessages(messages),
            tools,
            model: "deepseek-chat",
        });
        await db.postRecord('messages', { user_id, message: JSON.stringify(completion.choices[0].message) });
        if (completion.choices[0].message.tool_calls && completion.choices[0].message.tool_calls.length > 0) {
            for (let i = 0; i < completion.choices[0].message.tool_calls.length; i++) {
                const toolcall = completion.choices[0].message.tool_calls[i];
                const functionname = toolcall.function.name;
                const functionArgs = JSON.parse(toolcall.function.arguments);
                const result = functions[functionname](functionArgs);
                await db.postRecord('messages', {
                    user_id, message: JSON.stringify(
                        {
                            tool_call_id: toolcall.id,
                            role: 'tool',
                            content: result
                        }
                    )
                });
            }
            messages = await db.getAllRecords('messages', { user_id });
            completion = await openai.chat.completions.create({
                messages: parseMessages(messages),
                tools,
                model: "deepseek-chat",
            });
            await db.postRecord('messages', { user_id, message: JSON.stringify(completion.choices[0].message) });
        }
        console.log(completion.choices[0].message.content);
    }
})();
