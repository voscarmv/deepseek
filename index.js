const OpenAI = require("openai");
const dotenv = require('dotenv');
const db = require('./db.js');

dotenv.config();

const openai = new OpenAI({
    baseURL: 'https://api.deepseek.com',
    apiKey: process.env.deepseek_key
});

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
    let message = { role: "system", content: "You are a helpful doctor." };

    await db.postRecord('messages', { user_id, message: JSON.stringify(message) });
    let messages = await db.getAllRecords('messages', { user_id });
    let completion = await openai.chat.completions.create({
        messages: parseMessages(messages),
        model: "deepseek-chat",
    });
    await db.postRecord('messages', { user_id, message: JSON.stringify(completion.choices[0].message) });

    await db.postRecord('messages', { user_id, message: JSON.stringify({ role: 'user', content: 'I have a headache' }) })
    messages = await db.getAllRecords('messages', { user_id });
    completion = await openai.chat.completions.create({
        messages: parseMessages(messages),
        model: "deepseek-chat",
    });
    await db.postRecord('messages', { user_id, message: JSON.stringify(completion.choices[0].message) });

    await db.postRecord('messages', { user_id, message: JSON.stringify({ role: 'user', content: 'Yes, tell me more.' }) })
    messages = await db.getAllRecords('messages', { user_id });
    completion = await openai.chat.completions.create({
        messages: parseMessages(messages),
        model: "deepseek-chat",
    });
    await db.postRecord('messages', { user_id, message: JSON.stringify(completion.choices[0].message) });

    console.log(parseMessages(messages));

})();
