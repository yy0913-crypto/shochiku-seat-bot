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
    await page.waitForTimeout(3000);
    console.log("③ IMPACT26を探します");
    const impact = page.getByText("ＩＭＰＡＣＴ２６", {
      exact: false
    }).first();
    await impact.waitFor({
      state: "visible",
      timeout: 30000
    });
    console.log("IMPACT26発見！");
    /*
     * IMPACT26の公演カードを取得
     *
     * IMPACT26
     * ↓
     * performance-content-1
     * ↓
     * columns
     * ↓
     * performance-content
     */
    const card = impact.locator(
      "xpath=ancestor::div[contains(@class,'performance-content-1')][1]"
    );
    console.log("④ IMPACT26公演カード取得");
    console.log(
      "カード内容:",
      await card.innerText()
    );
    // IMPACT26カード内の「空席照会」だけを取得
    const seatLink = card.getByText("空席照会", {
      exact: true
    });
    const seatLinkCount = await seatLink.count();
    console.log(
      "⑤ IMPACT26カード内の空席照会件数:",
      seatLinkCount
    );
    if (seatLinkCount === 0) {
      throw new Error(
        "IMPACT26の公演カード内に空席照会が見つかりません"
      );
    }
    await seatLink.first().scrollIntoViewIfNeeded();
    console.log("⑥ 空席照会をクリックします");
    await seatLink.first().click();
    await page.waitForLoadState("domcontentloaded");
    console.log("空席照会後 URL:", page.url());
    console.log("空席照会後タイトル:", await page.title());
    console.log("⑦ 空席照会ページ到達！");
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
