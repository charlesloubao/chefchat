import dotenv from 'dotenv'

dotenv.config()

import {chromium} from 'playwright';
import knex from "knex";
import OpenAI from "openai";

const openAI = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

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

async function getTastyRecipes() {

    const browser = await chromium.launch({headless: true});
    const context = await browser.newContext();
    const page = await context.newPage();

    let tags = ["breakfast", "lunch", "dinner", "desserts", "snacks"]

    await context.route('**\/*.{png,jpg,jpeg,css,webp}', route => route.abort());

    for (let tag of tags) {
        console.log(`Getting ${tag} recipes`)
        let url = `https://tasty.co/tag/${tag}`

        await page.goto(url, {waitUntil: "domcontentloaded"});

        let pages = 0
        let hasShowMoreButton
        do {
            hasShowMoreButton = await page.getByText("Show more").click({timeout: 5000}).then(() => true).catch(() => false)
            pages += 1
        } while (hasShowMoreButton)

        let recipeLinks = await page.evaluate(() => {
            return Array.from(document.querySelectorAll('a[href*="/recipe/"]')).map(e => e.getAttribute("href"))
        })

        console.log(`${recipeLinks.length} found`)
        for (let i = 0; i < recipeLinks.length; i++) {
            let link = recipeLinks[i]

            let recipeUrl = new URL(link, new URL(page.url()).origin).toString()
            let recipeId = Buffer.from(link).toString("base64url")

            let recipe = await pg.from("recipes")
                .select("id")
                .where({id: recipeId})
                .first()

            if (recipe != null) {
                console.log(`Skipping ${recipe.id}`)
                continue
            }

            console.log(`${i}/${recipeLinks.length}: ${link}`)
            let response = await page.goto(recipeUrl, {waitUntil: "domcontentloaded"})

            if (!response.ok()) {
                console.log(`An error occurred on ${link}`, {statusCode: response.status()})
                continue
            }


            let name = await page.$(".recipe-name").then(handle => handle?.textContent())
            let description = (await page.$('.description').then(handle => handle?.textContent())) ?? ""
            let steps = await page.$$('.prep-steps > li').then(listItems => Promise.all(listItems.map(locator => locator.innerText())))
            let tags = await page.$$(".breadcrumb_item ").then(breadcrumbs => Promise.all(breadcrumbs.map(value => value.innerText())))
            let servings = await (await page.$(".servings-display"))?.innerText().then(text => parseInt(text.replaceAll(/\D/g, '').trim()) ?? null)

            let ingredientSections = await page.$$(".ingredients__section ")
                .then(sections => Promise.all(sections.map(async section => {
                    let name = await section.$('.ingredient-section-name').then(sectionName => sectionName?.innerText())
                    //.catch(() => null)
                    let ingredientListItems = (await section.$$('li'))
                    let items = await Promise.all(ingredientListItems.map(it => it.innerText()))
                    return {name, items}
                })))

            let timing
            let recipeTimeContainer = await page.$(".recipe-time-container")
            if (recipeTimeContainer) {
                let [totalTime, prepTime, cookTime] = await recipeTimeContainer.$$(".recipe-time")
                    .then(sections => Promise.all(sections.map(section => section.innerText().then(text => text.split("\n\n").pop()))))

                timing = {totalTime, prepTime, cookTime}
            }


            let recipeAsText = `${name}\n\n` +
                `${description}\n\n` +
                `Tags: ${tags.join(",")}\n\n` +
                `Ingredients\n\n` +
                `${ingredientSections.map(section => (
                    `${section.name}\n` +
                    `${section.items.map(item => `- ${item}`).join("\n")}`
                )).join("\n\n")}\n\n` +
                "Steps\n\n" +
                `${steps.map(step => `- ${step}`).join("\n")}`

            let embedding = await openAI.embeddings.create({
                input: recipeAsText,
                model: "text-embedding-ada-002"
            }).then(response => response.data[0].embedding)

            await pg.transaction(async trx => {
                // Save recipe
                await trx("recipes").insert({
                    id: recipeId,
                    name,
                    description,
                    tags,
                    servings,
                    embedding: JSON.stringify(embedding),
                    url: recipeUrl,
                    total_time: timing?.totalTime,
                    prep_time: timing?.prepTime,
                    cook_time: timing?.cookTime
                })

                // Save ingredients under each section when application
                for (let j = 0; j < ingredientSections.length; j++) {
                    let section = ingredientSections[j]

                    let sectionId = await trx("ingredient_sections").insert({
                        recipe_id: recipeId,
                        name: section.name,
                        index: j
                    }, "id").then(value => value[0].id)

                    for (let k = 0; k < section.items.length; k++) {
                        await trx("ingredients").insert({
                            name: section.items[k],
                            index: k,
                            recipe_id: recipeId,
                            section_id: sectionId
                        })
                    }
                }

                // Save steps
                await trx.insert(steps.map((step, index) => ({
                    index,
                    content: step,
                    recipe_id: recipeId
                }))).into("steps")
            })
        }

    }

    // Teardown
    await context.close();
    await browser.close();
}


async function saveRecipesToDb() {
}

getTastyRecipes()
