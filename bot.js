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
    await page.goto(BASE_URL, {
      waitUntil: "domcontentloaded",
      timeout: 30000
    });

    await page.getByText("公演一覧へ", { exact: true }).click();
    await page.waitForLoadState("domcontentloaded");

    await page.getByText("新橋演舞場", { exact: true }).first().click();
    await page.waitForLoadState("domcontentloaded");

    const impact = page.getByText("IMPACT26", { exact: false }).first();
    await impact.scrollIntoViewIfNeeded();

    const buttons = page.getByText("空席照会", { exact: true });
    await buttons.first().click();

    await page.waitForLoadState("domcontentloaded");

    const seats = await page.evaluate(() => {
      const results = [];

      for (const table of document.querySelectorAll("table")) {
        const rows = [...table.querySelectorAll("tr")];

        if (!rows.length) continue;

        const headers =
          [...rows[0].querySelectorAll("th,td")]
            .map(x => x.innerText.trim());

        const sIndex =
          headers.findIndex(x => x.includes("S席"));

        if (sIndex === -1) continue;

        for (const row of rows.slice(1)) {
          const cells =
            [...row.querySelectorAll("th,td")]
              .map(x => x.innerText.trim());

          if (cells.length <= sIndex) continue;

          const date = cells[0] || "";
          const time = cells[1] || "";
          const status = cells[sIndex] || "";

          if (
            date &&
            time &&
            (status.includes("○") ||
             status.includes("△"))
          ) {
            results.push({
              date,
              time,
              status
            });
          }
        }
      }

      return results;
    });

    console.log("S席空席:", seats);

    if (seats.length > 0) {
      const message =
        "🚨 IMPACT26 S席 空席発生！\n" +
        "新橋演舞場\n\n" +
        seats
          .map(x =>
            `📅 ${x.date} ${x.time}　💺 S席 ${x.status}`
          )
          .join("\n");

      await notify(message);
    }

  } finally {
    await browser.close();
  }
}

main().catch(async error => {
  console.error(error);

  if (WEBHOOK) {
    await notify(
      `⚠️ IMPACT26空席監視Bot エラー\n${error.message}`
    ).catch(() => {});
  }

  process.exit(1);
});
