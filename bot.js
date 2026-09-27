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
    console.log("① チケットWeb松竹を開きます");

    await page.goto(BASE_URL, {
      waitUntil: "domcontentloaded",
      timeout: 30000
    });

    await page.getByText("公演一覧へ", { exact: true }).click();
    await page.waitForLoadState("domcontentloaded");

    console.log("② 新橋演舞場へ");

    await page.getByText("新橋演舞場", { exact: true }).first().click();
    await page.waitForLoadState("domcontentloaded");

    await page.waitForTimeout(3000);

    console.log("③ IMPACT26を探します");

    const impact = page.getByText("ＩＭＰＡＣＴ２６", {
      exact: true
    }).first();

    await impact.waitFor({
      state: "visible",
      timeout: 30000
    });

    console.log("IMPACT26発見！");

    // IMPACT26を含む公演カード
    const card = impact.locator(
      "xpath=ancestor::div[contains(@class,'performance-content-1')][1]"
    );

    // 公演カードのテキストをブラウザ側で取得
    const statusText = await card.evaluate((el) => el.innerText);

    console.log("===== IMPACT26 公演情報 =====");
    console.log(statusText);
    console.log("============================");

    if (statusText.includes("空席あり")) {
      console.log("🚨 空席あり！");

      await notify(
        "🚨 IMPACT26 空席あり！\n\n" +
        "新橋演舞場\n" +
        "IMPACT26\n" +
        "公演一覧で「空席あり」を確認しました。"
      );

    } else if (statusText.includes("空席なし")) {
      console.log("空席なし。今回は通知しません。");

    } else {
      console.log("⚠️ 空席状況を判定できませんでした。");
    }

  } finally {
    await browser.close();
  }
}

main().catch(async (error) => {
  console.error("❌ エラー:", error);

  if (WEBHOOK) {
    await notify(
      `⚠️ IMPACT26空席監視Bot エラー\n${error.message}`
    ).catch(() => {});
  }

  process.exit(1);
});
