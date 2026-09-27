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

    console.log("② 新橋演舞場へ");

    await page.getByText("新橋演舞場", { exact: true }).first().click();
    await page.waitForLoadState("domcontentloaded");

    console.log("③ IMPACT26を探します");

    const impact = page.getByText("IMPACT26", {
      exact: false
    }).first();

    await impact.waitFor({
      state: "visible",
      timeout: 30000
    });

    await impact.scrollIntoViewIfNeeded();

    console.log("IMPACT26発見！");

    // IMPACT26を含む公演カードを探す
    const card = impact.locator(
      "xpath=ancestor::div[contains(@class,'performance-content')][1]"
    );

    console.log("④ 公演カード取得");

    console.log(
      "カード内テキスト:",
      await card.innerText()
    );

    // カード内のリンクを全部調査
    const links = await card.locator("a").evaluateAll((els) =>
      els.map((el) => ({
        text: (el.innerText || "").trim(),
        href: el.href || "",
        className: el.className || ""
      }))
    );

    console.log("===== IMPACT26カード内リンク =====");
    console.log(JSON.stringify(links, null, 2));
    console.log("===== リンク調査終了 =====");

    console.log("⑤ 調査完了");
    console.log("今回はまだクリックしていません。");

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
