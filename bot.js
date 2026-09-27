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
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      content: message
    })
  });

  if (!res.ok) {
    throw new Error(`Discord webhook error: ${res.status}`);
  }
}

async function main() {
  const browser = await chromium.launch({
    headless: true
  });

  const page = await browser.newPage({
    viewport: {
      width: 1280,
      height: 1000
    }
  });

  try {
    console.log("① チケットWeb松竹を開きます");

    await page.goto(BASE_URL, {
      waitUntil: "domcontentloaded",
      timeout: 30000
    });

    await page.getByText("公演一覧へ", {
      exact: true
    }).click();

    await page.waitForLoadState("domcontentloaded");

    console.log("② 新橋演舞場へ");

    await page.getByText("新橋演舞場", {
      exact: true
    }).first().click();

    await page.waitForLoadState("domcontentloaded");

    // 公演一覧が表示されるまで少し待つ
    await page.waitForTimeout(3000);

    console.log("③ IMPACT26を探します");

    // IMPACT26がDOMに出るまで待つ
    await page.waitForFunction(() => {
      return [...document.querySelectorAll("p")]
        .some(el => el.textContent?.trim() === "ＩＭＰＡＣＴ２６");
    }, null, {
      timeout: 300000000
    });

    console.log("IMPACT26発見！");

    // IMPACT26から親要素を上にたどり、
    // 「取扱状況」が含まれる範囲を探す
    const result = await page.evaluate(() => {
      const impact = [...document.querySelectorAll("p")]
        .find(el => el.textContent?.trim() === "ＩＭＰＡＣＴ２６");

      if (!impact) {
        return {
          found: false,
          statusFound: false,
          text: ""
        };
      }

      let current = impact;

      for (let i = 0; i < 8 && current; i++) {
        const text = current.innerText || "";

        if (text.includes("取扱状況")) {
          return {
            found: true,
            statusFound: true,
            text: text
          };
        }

        current = current.parentElement;
      }

      return {
        found: true,
        statusFound: false,
        text: impact.parentElement?.innerText || impact.innerText
      };
    });

    console.log("===== IMPACT26 公演情報 =====");
    console.log(result.text);
    console.log("============================");

    if (!result.found) {
      throw new Error(
        "IMPACT26が見つかりませんでした"
      );
    }

    if (!result.statusFound) {
      throw new Error(
        "IMPACT26の取扱状況が見つかりませんでした"
      );
    }

    // 空席ありの場合
    if (result.text.includes("空席あり")) {
      console.log("🚨 空席あり！");

      await notify(
        "🚨 IMPACT26 空席あり！\n\n" +
        "新橋演舞場\n" +
        "IMPACT26\n" +
        "公演一覧で「空席あり」を確認しました。"
      );

    // 空席なしの場合
    } else if (result.text.includes("空席なし")) {
      console.log(
        "空席なし。今回は通知しません。"
      );

    // どちらでもない場合
    } else {
      console.log(
        "⚠️ 空席状況を判定できませんでした。"
      );
    }

  } finally {
    await browser.close();
  }
}

main().catch(async (error) => {
  console.error("❌ エラー:", error);

  if (WEBHOOK) {
    await notify(
      "⚠️ IMPACT26空席監視Bot エラー\n" +
      error.message
    ).catch(() => {});
  }

  process.exit(1);
});
