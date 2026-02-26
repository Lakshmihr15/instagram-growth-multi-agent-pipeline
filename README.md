📈 Instagram Growth Pipeline — Multi-Agent AI System

A multi-agent orchestration system that automates Instagram trend analysis, content generation, and publishing strategy using AI.

Built with Node.js, Apify, GPT-4o, and DALL-E 3.

🚀 Features
🔎 Scout Agent

Scrapes Instagram posts using Apify

Ranks posts by engagement score

Generates trend intelligence using GPT-4o

🎬 Video Agent

Creates structured Reel production plans

Generates hook, pacing, overlays, caption, CTA

🖼 DALL-E Image Agent

Generates infographic-style trend summaries

Saves visual reports locally

📤 Publish Agent

Recommends posting window

Builds 30-hashtag strategy

Suggests story amplification & engagement tactics

🧠 Architecture

Sequential multi-agent orchestration:

Apify Scrape → GPT Scout → DALL-E Report → GPT Video Plan → GPT Publish Strategy

Each agent:

Has single responsibility

Passes structured context forward

Produces reproducible outputs (Markdown + JSON)

🛠 Tech Stack

Node.js

Apify Instagram Scraper

OpenAI GPT-4o

OpenAI DALL-E 3

dotenv

chalk

fs
