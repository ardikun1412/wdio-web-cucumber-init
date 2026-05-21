# WDIO Cucumber SauceDemo Automation Framework

Framework automation test berbasis WebdriverIO v9, Cucumber/Gherkin, Allure 3, Babel, Docker, GitHub Actions, multi environment, dan data-driven test.

## Tech Stack

- WebdriverIO v9
- JavaScript ES Modules (`import/export`)
- Cucumber / Gherkin
- Data-driven test via JSON fixtures
- Allure Report 3 CLI
- Babel
- Docker + Docker Compose
- GitHub Actions
- Target test: https://www.saucedemo.com

## Requirement Lokal

- Node.js 20 atau lebih baru, direkomendasikan Node.js 22
- Java 17 untuk generate/open Allure report lokal
- Chrome browser terinstall

## Instalasi

```bash
npm install
cp .env.example .env
```

## Menjalankan Test

```bash
npm run test:dev
```

Filter by tag:

```bash
TAGS='@e2e' npm run test:dev
TAGS='@smoke' npm run test:dev
```

## Allure 3 Report

```bash
npm run allure:generate
npm run allure:open
```

Atau langsung serve:

```bash
npm run allure:serve
```

## Docker

```bash
docker compose up --build --abort-on-container-exit
```

## Multi Environment

Environment dikontrol oleh `TEST_ENV`:

```bash
npm run test:dev
npm run test:staging
npm run test:prod
```

Konfigurasi environment ada di `config/env.config.js`. Untuk staging/prod, override URL via `.env`:

```env
STAGING_BASE_URL=https://www.saucedemo.com
PROD_BASE_URL=https://www.saucedemo.com
```

## Screenshot Tiap Step

Hook `afterStep` di `wdio.conf.js` akan:

1. Menyimpan screenshot fisik ke folder `screenshots/`.
2. Melampirkan screenshot ke Allure result sebagai attachment per step.

## Struktur Folder

```text
.
├── .github/workflows/wdio-tests.yml
├── config/env.config.js
├── data
│   ├── checkout.json
│   ├── products.json
│   └── users.json
├── features
│   ├── e2e-checkout.feature
│   ├── login.feature
│   └── step-definitions
├── pages
├── utils/test-data.js
├── wdio.conf.js
├── Dockerfile
└── docker-compose.yml
```

## Skenario Yang Disediakan

1. Login valid dan locked-out user menggunakan Scenario Outline.
2. End-to-end checkout: login, tambah produk ke cart, checkout, isi data customer, review total, finish order.
