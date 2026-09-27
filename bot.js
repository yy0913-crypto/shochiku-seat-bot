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

    // 公演一覧が表示されるまで少し待つ
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

    // IMPACT26から上方向にたどって、
    // 「IMPACT26」と「空席照会」が同じ公演カードに入っている
    // performance-content-1 を取得
    const card = impact.locator(
      "xpath=ancestor::div[contains(@class,'performance-content-1')][1]"
    );

    console.log("④ IMPACT26公演カードを確認します");

    // innerText() は使わず、空席照会だけを直接探す
    const seatLink = card.getByText("空席照会", {
      exact: true
    });

    await seatLink.first().waitFor({
      state: "visible",
      timeout: 30000
    });

    console.log("⑤ IMPACT26の空席照会を発見！");

    await seatLink.first().scrollIntoViewIfNeeded();

    console.log("⑥ 空席照会をクリックします");

    await seatLink.first().click();

    await page.waitForLoadState("domcontentloaded");

    // 念のため少し待つ
    await page.waitForTimeout(2000);

    console.log("⑦ 空席照会ページ到達！");
    console.log("URL:", page.url());
    console.log("タイトル:", await page.title());

    const bodyText = await page.locator("body").innerText();

    console.log("===== 空席照会ページ本文 START =====");
    console.log(bodyText.slice(0, 15000));
    console.log("===== 空席照会ページ本文 END =====");

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
