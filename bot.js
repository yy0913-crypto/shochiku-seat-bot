import { chromium } from "playwright";

const WEBHOOK = process.env.DISCORD_WEBHOOK_URL;
const BASE_URL = "https://www1.ticket-web-shochiku.com/t/";

async function notify(message) {
  if (!WEBHOOK) {
    console.log(message);
    return;
  }

  const res = await fetch(WEBHOOK, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ content: message })
  });

  if (!res.ok) {
    throw new Error(`Discord webhook error: ${res.status}`);
  }
}

async function main() {
  const browser = await chromium.launch({ headless: true });

  const page = await browser.newPage({
    viewport: { width: 1280, height: 1000 }
  });

  try {
    console.log("① チケットぴあを開きます");

    await page.goto(BASE_URL, {
      waitUntil: "domcontentloaded",
      timeout: 30000
    });

    await page.getByText("公演一覧へ", { exact: true }).click();
    await page.waitForLoadState("domcontentloaded");
    await page.waitForTimeout(3000);

    console.log("② 新橋演舞場へ");

    await page.getByText("新橋演舞場", { exact: true }).first().click();
    await page.waitForLoadState("domcontentloaded");

    console.log("③ IMPACT26を調査します");

    const impactLocator = page.getByText("IMPACT26", {
      exact: false
    });

    const count = await impactLocator.count();

    console.log("IMPACT26 件数:", count);

    for (let i = 0; i < count; i++) {
      const item = impactLocator.nth(i);

      console.log(`--- IMPACT26候補 ${i + 1} ---`);

      console.log(
        "tag:",
        await item.evaluate(el => el.tagName)
      );

      console.log(
        "class:",
        await item.evaluate(el => el.className || "")
      );

      console.log(
        "text:",
        await item.innerText()
      );

      console.log(
        "visible:",
        await item.isVisible()
      );

      console.log(
        "HTML:",
        (await item.evaluate(el => el.outerHTML)).slice(0, 2000)
      );
    }

    console.log("④ 調査完了");

  } finally {
    await browser.close();
  }
}

main().catch(async (error) => {
  console.error("❌ エラー:", error);

  if (WEBHOOK) {
    await notify(
      `⚠️ IMPACT26空席監視Bot 調査エラー\n${error.message}`
    ).catch(() => {});
  }

  process.exit(1);
});
