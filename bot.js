import { chromium } from "playwright";

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const NOTIFY_EMAIL = process.env.NOTIFY_EMAIL;

// ==============================
// チケットWeb松竹
// ==============================
const SHOCHIKU_URL = "https://www1.ticket-web-shochiku.com/t/";

// ==============================
// チケットぴあ
// ==============================
const PIA_URL =
  "https://t.pia.jp/pia/event/event.do?eventBundleCd=b2670832";


async function notifyByEmail(subject, title, message, url) {
  if (!RESEND_API_KEY) {
    console.log("⚠️ RESEND_API_KEYが設定されていません");
    return;
  }

  if (!NOTIFY_EMAIL) {
    console.log("⚠️ NOTIFY_EMAILが設定されていません");
    return;
  }

  console.log("📧 メール通知を送信します");

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${RESEND_API_KEY}`
    },
    body: JSON.stringify({
      from: "onboarding@resend.dev",
      to: [NOTIFY_EMAIL],
      subject,
      html: `
        <h2>${title}</h2>
        <p>${message}</p>
        <p>
          <a href="${url}">
            チケットページを開く
          </a>
        </p>
      `
    })
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(
      `Resendメール送信エラー: ${response.status} ${JSON.stringify(data)}`
    );
  }

  console.log("📧 メール送信成功:", data.id);
}


// ==============================
// 松竹監視
// ==============================
async function checkShochiku(browser) {
  const page = await browser.newPage({
    viewport: {
      width: 1280,
      height: 1000
    }
  });

  try {
    console.log("① チケットWeb松竹を開きます");

    await page.goto(SHOCHIKU_URL, {
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

    await page.waitForTimeout(3000);

    console.log("③ IMPACT26を探します");

    await page.waitForFunction(() => {
      return [...document.querySelectorAll("p")]
        .some(el => el.textContent?.trim() === "ＩＭＰＡＣＴ２６");
    }, null, {
      timeout: 30000000
    });

    console.log("IMPACT26発見！");

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
            text
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
      throw new Error("IMPACT26が見つかりませんでした");
    }

    if (!result.statusFound) {
      throw new Error("IMPACT26の取扱状況が見つかりませんでした");
    }

    if (result.text.includes("空席あり")) {
      console.log("🚨 松竹：空席あり！");

      await notifyByEmail(
        "🚨 IMPACT26 S席 空席通知",
        "🚨 IMPACT26 空席あり",
        "チケットWeb松竹で空席を確認しました。",
        SHOCHIKU_URL
      );

    } else if (result.text.includes("空席なし")) {
      console.log("松竹：空席なし。");

    } else {
      console.log("⚠️ 松竹：空席状況を判定できませんでした。");
    }

  } finally {
    await page.close();
  }
}


// ==============================
// チケットぴあ監視
// ==============================
async function checkPia(browser) {
  const page = await browser.newPage({
    viewport: {
      width: 1280,
      height: 1000
    }
  });

  try {
    console.log("🎫 チケットぴあを開きます");

    await page.goto(PIA_URL, {
      waitUntil: "domcontentloaded",
      timeout: 30000
    });

    await page.waitForTimeout(3000);

    const pageText = await page.locator("body").innerText();

    console.log("===== チケットぴあ =====");

    if (pageText.includes("販売期間中")) {
      console.log("🚨 ぴあ：「販売期間中」を確認！");

      await notifyByEmail(
        "🚨 チケットぴあ 販売開始通知",
        "🚨 チケットぴあ「販売期間中」になりました",
        "「予定枚数終了」から「販売期間中」になった可能性があります。すぐにチケットぴあを確認してください。",
        PIA_URL
      );

    } else if (pageText.includes("予定枚数終了")) {
      console.log("ぴあ：予定枚数終了。今回は通知しません。");

    } else {
      console.log(
        "⚠️ ぴあ：「販売期間中」「予定枚数終了」のどちらも確認できませんでした。"
      );

      console.log(
        pageText.substring(0, 2000)
      );
    }

    console.log("========================");

  } finally {
    await page.close();
  }
}


// ==============================
// メイン
// ==============================
async function main() {
  const browser = await chromium.launch({
    headless: true
  });

  try {
    console.log("================================");
    console.log("🎫 チケット監視スタート");
    console.log("================================");

    // 松竹
    await checkShochiku(browser);

    // ぴあ
    await checkPia(browser);

    console.log("================================");
    console.log("✅ 監視終了");
    console.log("================================");

  } finally {
    await browser.close();
  }
}


main().catch((error) => {
  console.error("❌ エラー:", error);
  process.exit(1);
});
