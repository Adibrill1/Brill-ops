import { expect, test, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const archivePath = '/archive/the-big-bang-2020';

const accessibilityRoutes = [
  { path: '/', heading: 'Brill Ops' },
  { path: '/agents', heading: 'Agent directory' },
  { path: archivePath, heading: 'The Big Bang' },
] as const;

async function expectHealthyPage(page: Page, path: string, heading: string | RegExp) {
  const response = await page.goto(path);

  expect(response?.ok(), `${path} should return a successful response`).toBe(true);
  await expect(page.getByRole('heading', { level: 1, name: heading })).toBeVisible();
  await expect(page.getByText('Something went wrong')).toHaveCount(0);
}

for (const route of accessibilityRoutes) {
  test(`${route.path} has no automatically detectable WCAG A/AA violations`, async ({ page }) => {
    await expectHealthyPage(page, route.path, route.heading);

    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
      .analyze();
    const summary = results.violations
      .map((violation) => `${violation.id}: ${violation.nodes.length} node(s) — ${violation.help}`)
      .join('\n');

    expect(results.violations, summary || 'No accessibility violations').toEqual([]);
  });
}

test('public routes render and natural cards navigate', async ({ page }) => {
  await expectHealthyPage(page, '/', 'Brill Ops');
  await expect(page.getByText(/There is no campaign running at the moment/i)).toBeVisible();

  const archiveCard = page.locator('main a[href^="/archive/"]').first();
  await expect(archiveCard).toBeVisible();
  await archiveCard.click();
  await expect(page).toHaveURL(new RegExp(`${archivePath}$`));
  await expect(page.getByRole('heading', { level: 1, name: 'The Big Bang' })).toBeVisible();

  await expectHealthyPage(page, '/archive', 'Archive');
  await expectHealthyPage(page, '/agents', 'Agent directory');

  const agentCard = page.locator('main a[href^="/agent/"]').first();
  const agentHref = await agentCard.getAttribute('href');
  expect(agentHref).toMatch(/^\/agent\/[A-Za-z0-9_-]+$/);
  await agentCard.click();
  await expect(page).toHaveURL(new RegExp(`${agentHref}$`));
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(/@.+/);
  await expect(page.getByRole('heading', { name: 'Campaign participation' })).toBeVisible();
});

test('agent directory is paginated and country flags stay decorative', async ({ page }) => {
  await expectHealthyPage(page, '/agents', 'Agent directory');

  const cards = page.locator('main a[href^="/agent/"]');
  await expect(cards).toHaveCount(48);
  await expect(page.getByText('Page 1 of 3')).toBeVisible();

  const hasFlagEmoji = await page.locator('main').evaluate((main) =>
    /[\u{1F1E6}-\u{1F1FF}]{2}/u.test(main.textContent ?? ''),
  );
  expect(hasFlagEmoji).toBe(true);

  const decorativeFlags = page.locator('main span[aria-hidden="true"]').filter({
    hasText: /[\u{1F1E6}-\u{1F1FF}]{2}/u,
  });
  expect(await decorativeFlags.count()).toBeGreaterThan(0);

  await page.getByRole('link', { name: 'Next' }).click();
  await expect(page).toHaveURL(/\/agents\?page=2$/);
  await expect(page.getByText('Page 2 of 3')).toBeVisible();
});

test('agent faction and sort choices are visible button controls on mobile', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await expectHealthyPage(page, '/agents', 'Agent directory');

  await expect(page.locator('main select')).toHaveCount(0);
  const faction = page.getByRole('group', { name: 'Filter by faction' });
  const sort = page.getByRole('group', { name: 'Sort agents' });
  await expect(faction.getByRole('link')).toHaveCount(3);
  await expect(sort.getByRole('link')).toHaveCount(3);
  await expect(faction.getByRole('link', { name: 'All factions' })).toHaveAttribute(
    'aria-current',
    'page',
  );
  await expect(sort.getByRole('link', { name: 'A–Z' })).toHaveAttribute('aria-current', 'page');

  const targets = await page
    .locator('[role="group"] a')
    .evaluateAll((links) => links.map((link) => {
      const box = link.getBoundingClientRect();
      return { width: box.width, height: box.height };
    }));
  for (const target of targets) {
    expect(target.width).toBeGreaterThanOrEqual(44);
    expect(target.height).toBeGreaterThanOrEqual(44);
  }

  await faction.getByRole('link', { name: 'Blue · Resistance' }).click();
  await expect(page).toHaveURL(/\/agents\?faction=blue$/);
  await expect(
    page.getByRole('group', { name: 'Filter by faction' }).getByRole('link', {
      name: 'Blue · Resistance',
    }),
  ).toHaveAttribute('aria-current', 'page');

  await page.getByRole('group', { name: 'Sort agents' }).getByRole('link', {
    name: 'By contribution',
  }).click();
  await expect(page).toHaveURL(/\/agents\?faction=blue&sort=contribution$/);

  const hasViewportOverflow = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
  );
  expect(hasViewportOverflow).toBe(false);
});

test('mobile navigation and agent search retain accessible names', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await expectHealthyPage(page, '/agents', 'Agent directory');

  const navigation = page.getByRole('navigation', { name: 'Primary navigation' });
  for (const name of ['Campaign', 'Agents', 'Archive']) {
    await expect(navigation.getByRole('link', { name, exact: true })).toBeVisible();
  }
  await expect(page.getByRole('searchbox', { name: 'Search agents' })).toBeVisible();
});

test('archive ranking and mobile faction filter preserve meaning and layout', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await expectHealthyPage(page, archivePath, 'The Big Bang');

  const podium = page
    .getByRole('heading', { name: 'Top contributors' })
    .locator('xpath=following-sibling::ol[1]/li');
  await expect(podium).toHaveCount(10);
  await expect(podium.nth(0).getByText('Rank 1')).toBeAttached();
  await expect(podium.nth(1).getByText('Rank 2')).toBeAttached();
  await expect(podium.nth(2).getByText('Rank 3')).toBeAttached();

  const podiumColours = await podium.evaluateAll((rows) =>
    rows.slice(0, 3).map((row) => getComputedStyle(row).backgroundColor),
  );
  expect(new Set(podiumColours).size).toBe(3);

  const filter = page.getByRole('group', { name: 'Filter teams by faction' });
  const buttons = filter.getByRole('button');
  await expect(buttons).toHaveCount(4);
  await expect(page.getByRole('button', { name: 'All' })).toHaveAttribute('aria-pressed', 'true');

  const targetSizes = await buttons.evaluateAll((items) =>
    items.map((item) => {
      const box = item.getBoundingClientRect();
      return { width: box.width, height: box.height };
    }),
  );
  for (const target of targetSizes) {
    expect(target.width).toBeGreaterThanOrEqual(44);
    expect(target.height).toBeGreaterThanOrEqual(44);
  }

  await page.getByRole('button', { name: 'Green · Enlightened' }).click();
  await expect(page).toHaveURL(new RegExp(`${archivePath}\\?faction=green$`));
  await expect(page.getByRole('button', { name: 'Green · Enlightened' })).toHaveAttribute(
    'aria-pressed',
    'true',
  );

  const hasViewportOverflow = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
  );
  expect(hasViewportOverflow).toBe(false);
});

test('keyboard focus is visible and interactive markup is not nested', async ({ page }) => {
  await expectHealthyPage(page, '/archive', 'Archive');

  await page.keyboard.press('Tab');
  const focused = page.locator(':focus');
  await expect(focused).toBeVisible();
  const focusStyle = await focused.evaluate((element) => {
    const style = getComputedStyle(element);
    return {
      outlineStyle: style.outlineStyle,
      outlineWidth: style.outlineWidth,
      boxShadow: style.boxShadow,
    };
  });
  expect(
    focusStyle.outlineStyle !== 'none' ||
      focusStyle.outlineWidth !== '0px' ||
      focusStyle.boxShadow !== 'none',
  ).toBe(true);

  const nestedInteractive = await page.locator('a a, a button, button a').count();
  expect(nestedInteractive).toBe(0);
});
