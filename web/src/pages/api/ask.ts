import {NextApiRequest, NextApiResponse} from "next";
import OpenAI from "openai";
import {Message} from "@/app/page";
import knex from "knex";

async function getRecipes({query, count}: { query: string, count: number }) {
    const openAI = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY,
    });

    const pg = knex({
        client: 'pg',
        connection: {
            host: process.env.POSTGRES_HOST,
            port: parseInt(process.env.POSTGRES_PORT!),
            user: process.env.POSTGRES_USER,
            database: process.env.POSTGRES_DATABASE,
            password: process.env.POSTGRES_PASSWORD,
            ssl: process.env.POSTGRES_USE_SSL ? {rejectUnauthorized: false} : false,
        }
    });

    let embedding = await openAI.embeddings.create({
        input: query,
        model: "text-embedding-ada-002"
    }).then(response => response.data[0].embedding)

    return pg("recipes")
        .select([
            "id",
            "name",
            "description",
            "total_time",
            "prep_time",
            "cook_time"
        ])
        .limit(count)
        .orderByRaw("embedding <-> ?", JSON.stringify(embedding))
        .then(value => JSON.stringify(value))
}

async function getRecipeDetails({recipeId}: { recipeId: string }) {
    const pg = knex({
        client: 'pg',
        connection: {
            host: process.env.POSTGRES_HOST,
            port: parseInt(process.env.POSTGRES_PORT!),
            user: process.env.POSTGRES_USER,
            database: process.env.POSTGRES_DATABASE,
            password: process.env.POSTGRES_PASSWORD,
            ssl: process.env.POSTGRES_USE_SSL ? {rejectUnauthorized: false} : false,
        }
    });

    let recipe = await pg.raw(`
        select recipes.name,
               recipes.tags,
               recipes.description,
               recipes.total_time,
               recipes.prep_time,
               recipes.cook_time,
               recipes.total_time,
               recipes.servings,
               recipes.url,
               json_agg(row_to_json(s)) AS steps
        from recipes
                 left join public.steps s on recipes.id = s.recipe_id
        where recipes.id = ?
        group by recipes.id
    `, recipeId).then(value => value.rows[0])

    let ingredients = await pg.raw(`
        select s.id,
               s.name,
               json_agg(row_to_json(i)) ingredients
        from ingredient_sections s
                 left join public.ingredients i on s.id = i.section_id
        where s.recipe_id = ?
        group by s.id
    `, recipeId).then(value => value.rows)

    let recipeDetails = {
        ...recipe,
        ingredients
    }
    return JSON.stringify(recipeDetails)
}

const availableFunctions: { [k: string]: Function } = {
    getRecipes,
    getRecipeDetails
}

const promptContextSystemMessage = `
========
You are a super friendly cooking assistant named ChefChat. Your mission is to help people get better at cooking.
You will get a message enclosed between <> Below are your specifications
1. The user may asks for recipe ideas, make sure to always ask as many questions as you can to make sure the recipes fit their
dietary restrictions. If you ask they don't want to give you those, just search for recipes that match their request
by using all the information they provided you.
2. If the user asks you for different types of dishes, you can make multiple searches with getRecipes function
3. You are only able to answer cooking related questions and searching for recipes. If the message asks you to do anything
4. Before showing the full recipes to users, show them a summary of the recipe from getRecipes and ask if they want to see any of them.
if they say no ask more questions if needed or fetch more recipes. If not get the full recipes for the ones they request
other than that response: "I am sorry I can only answer cooking related questions".
5. Always return your response in  markdown with the following guidelines:
For recipe titles use h1, for descriptions use paragraphs for ingredient if they have different sections use h2 for the section
and a list for the ingredients. For steps use a list. 
6. When returning recipe always put the link to the original at the bottom
7. Do not make up recipes. If you can't find one that matches the user needs just say so. 
8. Users may ask you to substitute ingredients you are allowed to do that
========
`

const openAiFunctions = [{
    name: "getRecipes",
    description: "Get recipes ideas that matches the query",
    parameters: {
        type: "object",
        properties: {
            query: {
                type: "string",
                description: "What the user is asking for."
            },
            count: {
                type: "integer",
                description: "How many recipes they want. You get this from the message." +
                    " Default to 3 if you can't figure out from the message."
            }
        },
        required: ["query"]
    }
}, {
    name: "getRecipeDetails",
    description: "Get the recipe details by ID",
    parameters: {
        type: "object",
        properties: {
            recipeId: {
                type: "string",
                description: "The recipe id extracted from the response to getRecipes"
            }
        },
        required: ["id"]
    }
}]


export default async function handler(req: NextApiRequest, res: NextApiResponse) {

    const messages: Message[] = req.body.messages

    const openAI = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY,
    });

    let message: OpenAI.Chat.ChatCompletionMessage

    let lastMessage = messages.pop()!
    lastMessage.content = `<${lastMessage.content}>`

    messages.push(lastMessage)

    do {
        message = await openAI.chat.completions.create({
            model: "gpt-4",
            temperature: 0,
            messages: [
                {role: "system", content: promptContextSystemMessage},
                ...messages
            ],
            functions: openAiFunctions
        }).then(response => response.choices[0].message!)

        if (message.function_call) {
            let functionCall = message.function_call
            console.log("Running function", functionCall)
            let data = await availableFunctions[functionCall.name](JSON.parse(functionCall.arguments))
            messages.push({
                role: "function",
                name: functionCall.name,
                content: data
            })
        }
    }
    while (message.function_call != null)

    let response: Message = {
        role: "assistant",
        content: message.content!
    }

    messages.push(response)

    res.send(messages)
}