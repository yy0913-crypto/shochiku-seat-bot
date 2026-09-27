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

    console.log("URL:", page.url());
    console.log("タイトル:", await page.title());

    console.log("② 公演一覧へ");

    await page.getByText("公演一覧へ", { exact: true }).click();
    await page.waitForLoadState("domcontentloaded");

    console.log("公演一覧 URL:", page.url());
    console.log("公演一覧タイトル:", await page.title());

    console.log("③ 新橋演舞場");

    await page.getByText("新橋演舞場", { exact: true }).first().click();
    await page.waitForLoadState("domcontentloaded");

    console.log("新橋演舞場 URL:", page.url());
    console.log("新橋演舞場タイトル:", await page.title());

    // IMPACT26 がページ上に存在するか確認
    const impactLocator = page.getByText("ＩＭＰＡＣＴ２６", {
      exact: false
    });

    const impactCount = await impactLocator.count();

    console.log("④ IMPACT26 件数:", impactCount);

    if (impactCount === 0) {
      console.log("❌ IMPACT26 が見つかりません");

      // ページ内のテキストを調査用に出力
      const bodyText = await page.locator("body").innerText();

      console.log("===== ページ内テキスト START =====");
      console.log(bodyText.slice(0, 10000));
      console.log("===== ページ内テキスト END =====");

      throw new Error("IMPACT26 がページ上に見つかりません");
    }

    const impact = impactLocator.first();

    await impact.waitFor({
      state: "visible",
      timeout: 30000
    });

    await impact.scrollIntoViewIfNeeded();

    console.log("⑤ IMPACT26 発見！");
    console.log("IMPACT26 の文字:", await impact.innerText());

    // IMPACT26 の周辺にあるHTML構造を調査
    const parentInfo = await impact.evaluate((el) => {
      const parents = [];
      let node = el;

      for (let i = 0; i < 6 && node; i++) {
        parents.push({
          level: i,
          tag: node.tagName,
          className: node.className || "",
          id: node.id || "",
          text: (node.innerText || "").slice(0, 2000)
        });

        node = node.parentElement;
      }

      return parents;
    });

    console.log("===== IMPACT26 周辺構造 START =====");
    console.log(JSON.stringify(parentInfo, null, 2));
    console.log("===== IMPACT26 周辺構造 END =====");

    console.log("⑥ 調査完了");
    console.log("今回は空席照会ボタンはクリックしていません。");

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
