/**
 * ╔════════════════════════════════════════════════════════════════════╗
 * ║   INSTAGRAM GROWTH PIPELINE — Multi-Agent Orchestration            ║
 * ║   Scout → Image Generator → Video Strategy → Publisher             ║
 * ║   Powered by OpenAI (GPT-4o + DALL-E 3)                            ║
 * ╚════════════════════════════════════════════════════════════════════╝
 *
 * Usage:
 *   1. Copy .env.example → .env and fill in your keys
 *      - APIFY_API_TOKEN
 *      - OPENAI_API_KEY
 *   2. npm install
 *   3. node pipeline.js [hashtag]        e.g.  node pipeline.js fitness
 */

import { ApifyClient } from "apify-client";
import OpenAI from "openai";
import chalk from "chalk";
import dotenv from "dotenv";
import fs from "fs";
import path from "path";

dotenv.config();

// ─── CONFIG ──────────────────────────────────────────────────────────────────
const HASHTAG    = process.argv[2] || process.env.HASHTAG || "fitness";
const RESULTS_LIMIT = 30; // How many posts Apify scrapes before we rank them

// ─── CLIENTS ─────────────────────────────────────────────────────────────────
const apify = new ApifyClient({ token: process.env.APIFY_API_TOKEN });
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY || "" });

// ─── LOGGING HELPERS ─────────────────────────────────────────────────────────
const ts   = () => chalk.dim(new Date().toLocaleTimeString("en", { hour12: false }));
const info = (msg)  => console.log(`${ts()} ${chalk.cyan("INFO")}    ${msg}`);
const ok   = (msg)  => console.log(`${ts()} ${chalk.green("✓ OK")}    ${msg}`);
const step = (msg)  => console.log(`\n${chalk.bold.white("══")} ${chalk.bold.white(msg)}`);
const apifyLog = (msg) => console.log(`${ts()} ${chalk.hex("#FF6B35")("APIFY")}   ${msg}`);
const agent = (name, msg) => console.log(`${ts()} ${chalk.hex("#A78BFA")(`[${name}]`)} ${msg}`);

function formatNum(n) {
  if (!n) return "0";
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M";
  if (n >= 1_000)     return (n / 1_000).toFixed(1) + "K";
  return String(n);
}

function engagementScore(post) {
  return (post.likesCount || 0) + (post.commentsCount || 0) * 3;
}

// ─── AGENT PROMPTS ───────────────────────────────────────────────────────────
const PROMPTS = {
  scout: `You are a social media trend intelligence agent given REAL scraped Instagram data.
Identify the single hottest post worth replicating and output:

🔥 TRENDING POST SELECTED
• Username | URL | Caption snippet

📊 ENGAGEMENT BREAKDOWN
• Likes | Comments | Engagement rate | Why exceptional

🎯 VIRAL HOOKS (3 reasons it explodes)

📌 CONTENT BLUEPRINT
• Format | Structure | Tone | Key visual elements

⚡ REPLICATION SCORE: X/10 + one sentence reasoning`,

  generator: `You are a video content synthesis agent. Given a real trending post blueprint, create:

🎬 VIDEO CONCEPT (one punchy sentence)

⏱️ SECOND-BY-SECOND PACING (15-30s Reel)
0-3s | 3-8s | 8-18s | 18-28s

🪝 OPENING HOOK (exact words/action for first 3 seconds)

🎵 AUDIO DIRECTION

📝 ON-SCREEN TEXT & OVERLAYS (with timing)

🎨 VISUAL STYLE (color grade, transitions, aesthetic)

📱 INSTAGRAM CAPTION (full, ready to copy-paste with CTA)`,

  publisher: `You are an Instagram distribution agent. Create:

🕐 OPTIMAL POSTING WINDOW (day, time, timezone + reasoning)

#️⃣ HASHTAG STRATEGY — 30 total
  Niche (10) | Mid-tier (10) | Broad (10)

📣 STORY AMPLIFICATION SEQUENCE (3 story slides to boost Reel)

🤝 COLLABORATION & TAGGING STRATEGY

💬 COMMENT SEEDING (3 pinned comments)

📈 PROJECTED PERFORMANCE
  Reach | Engagement | Viral probability + reasoning

✅ PUBLISH STATUS — confirm ready to go live`,
};

// ─── AGENT 1: SCOUT (Apify real scrape) ──────────────────────────────────────
async function runScoutAgent() {
  step("SCOUT AGENT — Apify Instagram Hashtag Scraper");
  apifyLog(`Launching actor for #${HASHTAG} (fetching ${RESULTS_LIMIT} posts)...`);

  const run = await apify.actor("apify/instagram-hashtag-scraper").call({
    hashtags:     [HASHTAG],
    resultsLimit: RESULTS_LIMIT,
    resultsType:  "posts",
  });

  apifyLog(`Run ID: ${run.id} | Status: ${run.status}`);

  if (run.status !== "SUCCEEDED") {
    throw new Error(`Apify run ended with status: ${run.status}`);
  }

  const { items } = await apify.dataset(run.defaultDatasetId).listItems();
  apifyLog(`${items.length} posts scraped. Ranking by engagement...`);

  if (!items || items.length === 0) {
    throw new Error("Apify returned 0 posts. Try a more popular hashtag.");
  }

  const ranked = [...items].sort((a, b) => engagementScore(b) - engagementScore(a));
  const top    = ranked[0];
  const top5   = ranked.slice(0, 5);

  ok(`Top post: @${top.ownerUsername} — ❤ ${formatNum(top.likesCount)}  💬 ${formatNum(top.commentsCount)}`);
  if (top.shortCode) ok(`URL: https://www.instagram.com/p/${top.shortCode}/`);

  // Build rich context string for Claude
  const realData = `
REAL SCRAPED DATA — Apify Instagram Hashtag Scraper (#${HASHTAG})
Scraped: ${new Date().toISOString()} | Total posts analysed: ${items.length}

━━ TOP POST (ranked #1 by engagement score) ━━
• Username:    @${top.ownerUsername || "unknown"}
• URL:         ${top.shortCode ? `https://www.instagram.com/p/${top.shortCode}/` : "N/A"}
• Likes:       ${formatNum(top.likesCount)}
• Comments:    ${formatNum(top.commentsCount)}
• Video Views: ${formatNum(top.videoViewCount) || "N/A (image post)"}
• Type:        ${top.type || "unknown"}
• Posted:      ${top.timestamp || "N/A"}
• Caption:
${(top.caption || "(no caption)").slice(0, 500)}${(top.caption || "").length > 500 ? "\n...[truncated]" : ""}
• Hashtags used: ${(top.hashtags || []).slice(0, 25).join(", ") || "none"}
• Mentions:      ${(top.mentions || []).join(", ") || "none"}

━━ OTHER TOP POSTS (for niche context) ━━
${top5.slice(1).map((p, i) =>
  `#${i + 2}: @${p.ownerUsername} | ❤ ${formatNum(p.likesCount)} 💬 ${formatNum(p.commentsCount)}\n    "${(p.caption || "").slice(0, 100)}..."`
).join("\n")}
  `.trim();

  // OpenAI analyses the real data
  step("SCOUT AGENT — OpenAI analysis of real post");
  agent("Scout", "Analysing real scraped post data with OpenAI...");

  const prompt = `${PROMPTS.scout}

Analyse this real Instagram data:

${realData}`;

  process.stdout.write(chalk.hex("#00FFB2")("\n[Scout Agent Output]\n"));

  const stream = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [{ role: "user", content: prompt }],
    stream: true,
  });

  let scoutOutput = "";

  for await (const chunk of stream) {
    const content = chunk.choices[0]?.delta?.content || "";
    process.stdout.write(content);
    scoutOutput += content;
  }
  console.log("\n");

  return { scoutOutput, realData, topPost: top, allScrapedData: items };
}

// ─── AGENT 2: VIDEO GENERATOR ─────────────────────────────────────────────────
async function runVideoAgent({ scoutOutput, realData }) {
  step("VIDEO AGENT — Reel Production Brief");
  agent("Video", "Generating original Reel concept from real post data...");

  const prompt = `${PROMPTS.generator}

Scout Agent analysis:

${scoutOutput}

Original real post data:
${realData}

Create a complete, original Reel production brief.`;

  process.stdout.write(chalk.hex("#FF6B35")("\n[Video Agent Output]\n"));

  const stream = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [{ role: "user", content: prompt }],
    stream: true,
  });

  let videoOutput = "";

  for await (const chunk of stream) {
    const content = chunk.choices[0]?.delta?.content || "";
    process.stdout.write(content);
    videoOutput += content;
  }
  console.log("\n");

  return videoOutput;
}

// ─── AGENT 3: DALL-E IMAGE GENERATOR ──────────────────────────────────────────
async function runImageAgent({ allScrapedData }) {
  step("DALL-E IMAGE AGENT — Photo Summary Generation");
  agent("DALL-E", "Sending all Apify data to DALL-E for image summary generation...");

  try {
    // Prepare comprehensive content summary from all scraped posts
    const imagePrompt = `Create a professional Instagram-style infographic image summarizing #${HASHTAG} trends:

TOTAL POSTS ANALYZED: ${allScrapedData.length}

TOP 5 POSTS BY ENGAGEMENT:
${allScrapedData.slice(0, 5).map((post, idx) => `
${idx + 1}. @${post.ownerUsername || "unknown"} - ${formatNum(post.likesCount)}❤ ${formatNum(post.commentsCount)}💬
`).join("")}

KEY TRENDING HASHTAGS: ${Array.from(new Set(allScrapedData.flatMap(p => p.hashtags || []))).slice(0, 10).join(", ")}

Design: Modern Instagram infographic, bold "#${HASHTAG} TRENDS REPORT" title, vibrant colors (blues, greens, oranges), clean typography, date stamp: ${new Date().toLocaleDateString()}, "Powered by AI Analytics" at bottom.`.trim();

    info(`Preparing image generation with ${allScrapedData.length} posts...`);
    info("Generating infographic summary image...");
    process.stdout.write(chalk.hex("#FF9500")("\n[DALL-E Image Generation]\n"));

    // Generate image using DALL-E 3
    const response = await openai.images.generate({
      model: "dall-e-3",
      prompt: imagePrompt,
      n: 1,
      size: "1024x1024",
      quality: "standard",
      response_format: "url"
    });

    let imageUrl = null;

    if (response.data && response.data[0]?.url) {
      const generatedUrl = response.data[0].url;
      info(`Image generated! URL: ${generatedUrl}`);

      // Download and save the image
      const imageDir = "./output/images";
      if (!fs.existsSync(imageDir)) fs.mkdirSync(imageDir, { recursive: true });

      const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
      const imageFile = path.join(imageDir, `summary-${HASHTAG}-${timestamp}.png`);

      // Download image from URL
      const imageResponse = await fetch(generatedUrl);
      const imageBuffer = await imageResponse.arrayBuffer();
      fs.writeFileSync(imageFile, Buffer.from(imageBuffer));

      imageUrl = imageFile;
      ok(`Image saved → ${imageFile}`);
    }

    const imageResponseData = {
      status: imageUrl ? "SUCCESS" : "PARTIAL",
      message: imageUrl
        ? `Infographic successfully generated and saved to ${imageUrl}`
        : "Image generation completed but no image file was returned",
      imageUrl: imageUrl,
      imagePrompt: imagePrompt,
      dataProcessed: {
        totalPosts: allScrapedData.length,
        hashtag: HASHTAG,
        timestamp: new Date().toISOString()
      },
      revisedPrompt: response.data[0]?.revised_prompt || null
    };

    if (imageUrl) {
      ok("Image summary generated and saved successfully!");
    } else {
      info("Image generation completed - check response for details");
    }

    return imageResponseData;
  } catch (error) {
    console.error(chalk.red(`DALL-E Image error: ${error.message}`));

    return {
      status: "ERROR",
      error: error.message,
      errorDetails: error.toString(),
      fallback: "Image generation failed. Check your OpenAI API key and quota.",
      dataProcessed: {
        totalPosts: allScrapedData.length,
        hashtag: HASHTAG,
        timestamp: new Date().toISOString()
      }
    };
  }
}

// ─── AGENT 4: PUBLISHER ───────────────────────────────────────────────────────
async function runPublishAgent({ videoOutput, topPost }) {
  step("PUBLISH AGENT — Distribution Strategy");
  agent("Publisher", "Building data-driven publishing plan...");

  const prompt = `${PROMPTS.publisher}

Video production brief:

${videoOutput}

Niche: #${HASHTAG}
Real engagement benchmark: top post has ${formatNum(topPost.likesCount)} likes / ${formatNum(topPost.commentsCount)} comments.

Create the complete publishing strategy.`;

  process.stdout.write(chalk.hex("#A78BFA")("\n[Publish Agent Output]\n"));

  const stream = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [{ role: "user", content: prompt }],
    stream: true,
  });

  let publishOutput = "";

  for await (const chunk of stream) {
    const content = chunk.choices[0]?.delta?.content || "";
    process.stdout.write(content);
    publishOutput += content;
  }
  console.log("\n");

  return publishOutput;
}

// ─── SAVE RESULTS ─────────────────────────────────────────────────────────────
function saveResults({ scoutOutput, videoOutput, publishOutput, topPost, imageResponse }) {
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const outDir  = "./output";
  const outFile = path.join(outDir, `pipeline-${HASHTAG}-${timestamp}.md`);
  const jsonFile = path.join(outDir, `image-data-${HASHTAG}-${timestamp}.json`);

  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir);

  const md = `# Instagram Growth Pipeline — #${HASHTAG}
Generated: ${new Date().toLocaleString()}

---

## 🏆 Source Post
- **Account:** @${topPost.ownerUsername}
- **URL:** ${topPost.shortCode ? `https://www.instagram.com/p/${topPost.shortCode}/` : "N/A"}
- **Likes:** ${formatNum(topPost.likesCount)} | **Comments:** ${formatNum(topPost.commentsCount)}

---

## ◉ Scout Agent Analysis
${scoutOutput}

---

## 🖼️ DALL-E Image — Photo Summary
**Status:** ${imageResponse.status}
${imageResponse.message ? `**Message:** ${imageResponse.message}\n` : ""}
${imageResponse.imageUrl ? `\n**Generated Image:** ${imageResponse.imageUrl}\n` : ""}
${imageResponse.revisedPrompt ? `\n**DALL-E Revised Prompt:** ${imageResponse.revisedPrompt}\n` : ""}
${imageResponse.imagePrompt ? `\n### Original Image Generation Prompt:\n${imageResponse.imagePrompt}\n` : ""}
${imageResponse.error ? `\n**Error Details:** ${imageResponse.error}\n` : ""}
${imageResponse.dataProcessed ? `\n**Data Processed:**
- Total Posts: ${imageResponse.dataProcessed.totalPosts}
- Hashtag: #${imageResponse.dataProcessed.hashtag}
- Timestamp: ${imageResponse.dataProcessed.timestamp}\n` : ""}

---

## ◈ Video Agent — Production Brief
${videoOutput}

---

## ◎ Publish Agent — Distribution Strategy
${publishOutput}
`;

  fs.writeFileSync(outFile, md, "utf-8");
  ok(`Results saved → ${outFile}`);

  // Save full image data to JSON
  if (imageResponse) {
    fs.writeFileSync(jsonFile, JSON.stringify(imageResponse, null, 2), "utf-8");
    ok(`Image data saved → ${jsonFile}`);
  }

  return outFile;
}

// ─── MAIN ORCHESTRATOR ────────────────────────────────────────────────────────
async function main() {
  console.log(chalk.bold.white(`
╔═════════════════════════════════════════════════════════════╗
║    INSTAGRAM GROWTH PIPELINE · Multi-Agent System           ║
║    Apify Scrape → OpenAI GPT-4o → DALL-E → Video → Publish ║
║    Powered by OpenAI                                        ║
╚═════════════════════════════════════════════════════════════╝`));

  info(`Target hashtag: ${chalk.bold("#" + HASHTAG)}`);
  info(`Apify token:    ${process.env.APIFY_API_TOKEN ? chalk.green("✓ set") : chalk.red("✗ missing — set APIFY_API_TOKEN in .env")}`);
  info(`OpenAI API key: ${process.env.OPENAI_API_KEY ? chalk.green("✓ set") : chalk.red("✗ missing — set OPENAI_API_KEY in .env")}`);

  if (!process.env.APIFY_API_TOKEN) throw new Error("APIFY_API_TOKEN not set in .env");
  if (!process.env.OPENAI_API_KEY) throw new Error("OPENAI_API_KEY not set in .env");

  const start = Date.now();

  // Run all agents sequentially, passing context between them
  const { scoutOutput, realData, topPost, allScrapedData } = await runScoutAgent();
  const imageResponse = await runImageAgent({ allScrapedData });
  const videoOutput   = await runVideoAgent({ scoutOutput, realData });
  const publishOutput = await runPublishAgent({ videoOutput, topPost });

  // Save to markdown file
  const outFile = saveResults({ scoutOutput, videoOutput, publishOutput, topPost, imageResponse });

  const elapsed = ((Date.now() - start) / 1000).toFixed(1);
  console.log(chalk.bold.green(`
╔══════════════════════════════════════════════════════════╗
║  ✅ PIPELINE COMPLETE                                     ║
║  All 4 agents finished in ${elapsed}s
║  Results: ${outFile}
╚══════════════════════════════════════════════════════════╝`));
}

main().catch(err => {
  console.error(chalk.red(`\n❌ Pipeline error: ${err.message}`));
  process.exit(1);
});