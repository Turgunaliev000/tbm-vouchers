import { test, expect } from "@playwright/test";

test("set stock, activate, reject empty stock, keep users isolated", async ({
  page,
  request,
}) => {
  const userId = 3;
  await request.put(`/api/users/${userId}/balances/1`, {
    data: { quantity: 1 },
  });
  const before = await (
    await request.get(`/api/users/${userId}/activations`)
  ).json();
  await page.goto("/");
  await page.getByLabel("Текущий пользователь").selectOption(String(userId));
  const product = page.getByRole("article", { name: "Stage 1", exact: true });
  await expect(
    product.getByRole("button", { name: "Активировать", exact: true }),
  ).toBeEnabled();
  await product
    .getByRole("button", { name: "Активировать", exact: true })
    .click();
  await expect(
    page.getByRole("status").filter({ hasText: "Stage 1: ваучер активирован" }),
  ).toBeVisible();
  await expect(
    product.getByRole("button", { name: "Ваучеры закончились" }),
  ).toBeDisabled();
  const after = await (
    await request.get(`/api/users/${userId}/activations`)
  ).json();
  expect(after.total).toBe(before.total + 1);
  await page.getByLabel("Продукт", { exact: true }).selectOption("1");
  await page.getByLabel("Количество ваучеров").fill("4");
  await page.getByRole("button", { name: "Сохранить запас" }).click();
  await expect(
    page.getByRole("status").filter({ hasText: "Запас сохранён: 4" }),
  ).toBeVisible();
  await expect(
    product.getByRole("button", { name: "Активировать", exact: true }),
  ).toBeEnabled();
  await page.getByLabel("Количество ваучеров").fill("-1");
  await page.getByRole("button", { name: "Сохранить запас" }).click();
  await expect(page.getByRole("alert")).toContainText("Укажите целое число");
  await page.getByLabel("Текущий пользователь").selectOption("2");
  await expect(page.getByText("maria@example.com")).toBeVisible();
  await expect(page.getByRole("alert")).toHaveCount(0);
});

test("server conflict refreshes balance and shows a clear message", async ({
  page,
  request,
}) => {
  await request.put("/api/users/3/balances/1", { data: { quantity: 1 } });
  await page.goto("/");
  await page.getByLabel("Текущий пользователь").selectOption("3");
  const product = page.getByRole("article", { name: "Stage 1", exact: true });
  await expect(
    product.getByRole("button", { name: "Активировать", exact: true }),
  ).toBeEnabled();
  await request.post("/api/users/3/activations/1");
  await product
    .getByRole("button", { name: "Активировать", exact: true })
    .click();
  await expect(page.getByRole("alert")).toContainText(
    "Ваучеры на этот продукт закончились",
  );
  await expect(
    product.getByRole("button", { name: "Ваучеры закончились" }),
  ).toBeDisabled();
});

test("initial API error can be retried", async ({ page }) => {
  await page.route("**/api/users", (route) =>
    route.fulfill({
      status: 500,
      contentType: "application/json",
      body: JSON.stringify({
        code: "internal_error",
        message: "Ошибка сервера",
      }),
    }),
  );
  await page.goto("/");
  await expect(page.getByRole("alert")).toContainText("Ошибка сервера");
  await page.unroute("**/api/users");
  await page.getByRole("button", { name: "Повторить попытку" }).click();
  await expect(page.getByLabel("Текущий пользователь")).toBeVisible();
});

test("mobile layout has no horizontal overflow", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Управление запасом" }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
});
