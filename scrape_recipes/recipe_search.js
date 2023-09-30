import dotenv from 'dotenv'

dotenv.config()

import knex from "knex";
import OpenAI from "openai";

(async () => {
    let recipeId = 'L3JlY2lwZS9ob21lbWFkZS1jaW5uYW1vbi1yb2xscw'
    const pg = knex({
        client: 'pg',
        connection: {
            host: process.env.POSTGRES_HOST,
            port: process.env.POSTGRES_PORT,
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

    let response = {
        ...recipe,
        ingredients
    }
    console.log(response)
})()

/*(async () => {
    const pg = knex({
        client: 'pg',
        connection: {
            host: process.env.POSTGRES_HOST,
            port: process.env.POSTGRES_PORT,
            user: process.env.POSTGRES_USER,
            database: process.env.POSTGRES_DATABASE,
            password: process.env.POSTGRES_PASSWORD,
            ssl: process.env.POSTGRES_USE_SSL ? {rejectUnauthorized: false} : false,
        }
    });

    const openAI = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY,
    });

    let embedding = await openAI.embeddings.create({
        input: "Chicken, rice taco bowl",
        model: "text-embedding-ada-002"
    }).then(response => response.data[0].embedding)

    let results = await pg("recipes")
        .limit(5)
        .orderByRaw("embedding <-> ?", JSON.stringify(embedding))

    results.forEach(({name, description, url}) => console.log({name, description, url}))
})()*/