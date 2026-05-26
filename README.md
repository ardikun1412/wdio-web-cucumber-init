# WDIO Cucumber SauceDemo Automation Framework

Framework automation test berbasis **WebdriverIO v9**, **Cucumber/Gherkin**, **Allure Report 3**, **Docker + Selenium Grid 4**, **GitHub Actions**, multi-environment, multi-browser, headless mode, dan terintegrasi dengan **Jira Xray** untuk sinkronisasi hasil test secara otomatis.

---

## 📦 Tech Stack

| Komponen | Versi / Detail |
|---|---|
| **WebdriverIO** | v9.27.1 |
| **Cucumber / Gherkin** | `@wdio/cucumber-framework` v9.27.0 |
| **Allure Reporter** | `@wdio/allure-reporter` v9.27.1 |
| **Allure CLI** | v3.8.0 |
| **JavaScript** | ES Modules (`import`/`export`) |
| **Node.js** | ≥ 20 (disarankan v22) |
| **Axios** | v1.9.0 (Jira Xray HTTP client) |
| **dotenv** | v17.2.3 |
| **Docker** | Selenium Grid 4 (Hub + Chromium Node) |
| **GitHub Actions** | CI/CD otomatis |
| **Target Application** | [https://www.saucedemo.com](https://www.saucedemo.com) |

---

## ⚙️ Requirement

### Lokal
- **Node.js** v20 atau lebih baru (disarankan v22)
- **Java 17** — diperlukan untuk generate/open Allure report secara lokal
- **Chrome** atau **Firefox** terinstall (mode non-grid)
- **Docker Desktop** — diperlukan untuk mode Selenium Grid

---

## 🚀 Instalasi

```bash
npm install
cp .env.example .env
```

Edit file `.env` sesuai konfigurasi lokal Anda (lihat bagian [Environment Variables](#-environment-variables)).

---

## ▶️ Menjalankan Test

### Mode Standar (lokal, native browser)

```bash
# Dev environment
npm run test:dev

# Staging environment
npm run test:staging
```

### Filter by Tag

```bash
TAGS='@smoke' npm run test:dev
TAGS='@e2e' npm run test:dev
TAGS='@smoke and @L3' npm run test:dev
```

### Override Browser

```bash
BROWSER=firefox npm run test:dev
BROWSER=chrome npm run test:dev    # default
```

### Mode Headless

```bash
HEADLESS=true npm run test:dev
```

### Mode Parallel

```bash
MAX_INSTANCES=3 npm run test:dev
```

### Mode Selenium Grid (Docker)

Jalankan grid terlebih dahulu, lalu test:

```bash
npm run grid:start
USE_GRID=true npm run test:dev
npm run grid:stop
```

---

## 📊 Allure Report

### Generate & Buka Laporan

```bash
# Generate dari allure-results
npm run allure:generate

# Buka laporan di browser
npm run allure:open
```

### Atau langsung serve (tanpa generate manual)

```bash
npm run allure:serve
```

> **Catatan:** Setiap run test akan otomatis membersihkan `allure-results` dan `allure-report` sebelum eksekusi dimulai (`npm run clean`).

---

## 🐳 Docker — Selenium Grid

Framework ini menggunakan **Selenium Grid 4** dengan Docker Compose:

| Service | Image | Detail |
|---|---|---|
| `selenium-hub` | `selenium/hub:4.21.0` | Hub utama Grid, port `4444` |
| `chrome` | `selenium/node-chromium:4.21.0` | Chrome Node, `scale: 3` |

```bash
# Start Selenium Grid (detached)
npm run grid:start

# Stop Selenium Grid
npm run grid:stop

# Atau jalankan langsung dengan output log di terminal
docker compose up --build --abort-on-container-exit
```

Saat `USE_GRID=true`, framework otomatis terhubung ke `SELENIUM_HOST:SELENIUM_PORT` (default: `localhost:4444`).

---

## 🌍 Multi Environment

Environment dikendalikan via variabel `TEST_ENV`. Konfigurasi base URL ada di [`config/env.config.js`](./config/env.config.js).

| Script | Environment | Base URL |
|---|---|---|
| `npm run test:dev` | `dev` | `https://www.saucedemo.com/` |
| `npm run test:staging` | `staging` | `https://www.saucedemo.com/` |

Untuk override URL secara dinamis, set variabel berikut di `.env`:

```env
TEST_ENV=staging
```

---

## 🔗 Jira Xray Integration

Framework ini dilengkapi dengan pipeline sinkronisasi hasil test ke **Jira Xray** secara otomatis, mencakup:

| Entitas Jira | Aksi |
|---|---|
| **Test Case** | `getOrCreate` — buat baru atau gunakan yang sudah ada |
| **Pre-Condition** | `getOrCreate` — buat & link ke Test Case |
| **Test Set** | `getOrCreate` — buat & tambahkan Test Case |
| **Test Execution** | `init` — buat baru atau gunakan key yang sudah ada |
| **Test Run Status** | Update status `PASSED` / `FAILED` |
| **Evidence (Screenshot)** | Upload screenshot per step ke Test Execution |

### Alur Pipeline Upload

```
npm run upload:xray
     │
     ├─ 1. result:enrich  →  scripts/enrich-result.js
     │       └─ Baca allure-results/ + .metadata/
     │       └─ Gabungkan metadata eksekusi (feature, background, scenario, env)
     │       └─ Hapus background steps dari steps scenario
     │       └─ Output → allure-results/enriched-results/*-enriched-result.json
     │
     └─ 2. upload:xray    →  helper/jira/index.js
             └─ Login ke Jira (Basic Auth)
             └─ Init/reuse Test Execution
             └─ Untuk setiap scenario:
                 ├─ getOrCreate Test Set (per Feature)
                 ├─ getOrCreate Test Case
                 ├─ getOrCreate Pre-Condition → link ke Test Case
                 ├─ Tambah Test Case ke Test Set
                 ├─ Tambah Test Case ke Test Execution
                 ├─ Update status Test Run
                 └─ Upload screenshot sebagai Evidence
```

### Konfigurasi Jira Xray

File konfigurasi: [`config/jira-xray.config.js`](./config/jira-xray.config.js)

| Konfigurasi | Nilai |
|---|---|
| Issue Type: Test | `Test` |
| Issue Type: Pre-Condition | `Pre-Condition` |
| Issue Type: Test Set | `Test Set` |
| Issue Type: Sub Test Execution | `Sub Test Execution` |
| Test Type default | `Cucumber` |
| Platform default | `Desktop \| Browser` |
| Testing Group | `Automated Testing` |
| Cucumber Steps Type | `Scenario` |

### Jalankan Upload ke Jira

```bash
npm run upload:xray
```

> Pipeline ini menjalankan `result:enrich` terlebih dahulu, kemudian upload ke Jira Xray.

---

## 🗂️ Execution Metadata Pipeline

Setelah setiap scenario selesai, hook `afterScenario` di `wdio.conf.js` menyimpan metadata ke:

```
allure-results/.metadata/execution_metadata_<scenario-name>.json
```

File ini berisi:

- Detail feature, background, dan scenario (nama + steps + tags)
- Status eksekusi (`PASSED` / `FAILED`) & durasi
- Environment info (env name, base URL, browser, headless, grid, host, port, node version)
- Timestamp ISO eksekusi

Script `enrich-result.js` membaca metadata ini, menggabungkannya ke Allure result JSON, lalu membuat file `*-enriched-result.json` di folder `allure-results/enriched-results/`. Metadata asli (`.metadata/`) dihapus setelah enrich selesai.

---

## 📸 Screenshot & Reporting

Dua mekanisme screenshot aktif secara bersamaan:

| Hook | Aksi |
|---|---|
| `afterStep` | Screenshot diambil **setiap step**, dilampirkan ke Allure report sebagai attachment |
| `afterScenario` (on failure) | Screenshot tambahan diambil jika scenario **FAILED** |

Screenshot fisik tersimpan di folder `screenshots/`.

### Allure Report — Environment Info

Setiap report Allure menyertakan environment info berikut:

| Field | Sumber |
|---|---|
| `Environment` | `TEST_ENV` |
| `Base_URL` | Dari `env.config.js` |
| `Browser` | `BROWSER` |
| `Headless` | `HEADLESS` |
| `Use_Grid` | `USE_GRID` |
| `Selenium_Host` | `SELENIUM_HOST` |
| `Selenium_Port` | `SELENIUM_PORT` |
| `Node_Version` | `process.version` |

### Allure Report — Label Per Scenario

Setiap scenario di-enrich dengan label Allure berikut:
- `environment`, `browser`, `baseUrl`
- `feature` (nama Feature dari file `.feature`)
- `story` (nama Scenario)
- `background` (nama Background jika ada)
- `tag` (semua tag Cucumber dari scenario)

---

## 📁 Struktur Folder

```text
.
├── .github/
│   └── workflows/
│       └── wdio-tests.yml          # CI/CD GitHub Actions
│
├── config/
│   ├── env.config.js               # Konfigurasi multi-environment (base URL, timeout)
│   └── jira-xray.config.js         # Konfigurasi Jira Xray (issue types, custom fields)
│
├── helper/
│   └── jira/
│       ├── index.js                # Orchestrator upload ke Jira Xray
│       ├── client.js               # HTTP client Axios + login Jira (Basic Auth)
│       ├── allure-reader.js        # Baca enriched-results dan parsing data
│       ├── test-case.js            # getOrCreate Test Case di Jira
│       ├── test-set.js             # getOrCreate Test Set + add test
│       ├── test-execution.js       # Init/reuse Test Execution + manage tests
│       ├── precondition.js         # getOrCreate Pre-Condition + link ke test
│       └── evidence.js             # Upload screenshot + update Test Run status
│
├── scripts/
│   └── enrich-result.js            # Enrich Allure results dengan execution metadata
│
├── test/
│   ├── data/
│   │   └── users.json              # Data-driven test users (dev/staging)
│   ├── features/
│   │   ├── login.feature           # Skenario login
│   │   └── checkout.feature        # Skenario end-to-end checkout
│   ├── pages/
│   │   ├── base.page.js            # Base Page Object (utilitas bersama)
│   │   ├── login.page.js           # Page Object halaman login
│   │   ├── inventory.page.js       # Page Object halaman inventory/produk
│   │   ├── cart.page.js            # Page Object halaman cart
│   │   └── checkout.page.js        # Page Object halaman checkout
│   └── step-definitions/
│       ├── login.steps.js          # Step definitions untuk login
│       └── checkout.steps.js       # Step definitions untuk checkout
│
├── utils/
│   ├── gherkin-metadata.js         # Parser feature file (feature, background, tags, steps)
│   ├── execution-metadata.js       # Simpan metadata eksekusi per scenario ke file JSON
│   ├── test-data.js                # Loader data JSON berdasarkan TEST_ENV
│   └── sanitize.js                 # Sanitasi nama file (untuk metadata filename)
│
├── .env                            # File environment lokal (tidak di-commit)
├── .env.example                    # Template environment variables
├── docker-compose.yml              # Selenium Grid 4: Hub + Chromium Node (scale 3)
├── package.json                    # NPM scripts + dependencies
└── wdio.conf.js                    # Konfigurasi utama WebdriverIO
```

---

## 📋 Skenario Test

### Feature: Login (`login.feature`)

| Tag | Tipe | Skenario |
|---|---|---|
| `@smoke @L2` | Scenario Outline | Login dengan **valid user** → sukses masuk ke inventory |
| `@smoke @L2` | Scenario Outline | Login dengan **locked-out user** → tampil pesan error |

Data user diambil dari `test/data/users.json` berdasarkan environment aktif.

### Feature: End-to-End Checkout (`checkout.feature`)

Background: User sudah login sebagai `validUser` sebelum setiap scenario.

| Tag | Skenario |
|---|---|
| `@smoke @L3` | Checkout **1 produk** (Sauce Labs Backpack) → konfirmasi order |
| `@smoke @L3` | Checkout **2 produk** (Sauce Labs Backpack + Bike Light) → konfirmasi order |

---

## 🌐 GitHub Actions (CI/CD)

Workflow: [`.github/workflows/wdio-tests.yml`](./.github/workflows/wdio-tests.yml)

**Trigger:** `push` ke `main`, `pull_request` ke `main`, dan `workflow_dispatch` (manual).

| Step | Detail |
|---|---|
| Setup Node.js v22 | Cache npm dependencies |
| `npm ci` | Install dependencies bersih |
| `npm run test:dev` | Jalankan test (`HEADLESS=true`, `USE_GRID=false`) |
| `allure:generate` | Generate Allure report (berjalan meski test gagal) |
| Upload `allure-report` | Artifact tersimpan di GitHub Actions |
| Upload `screenshots` | Artifact tersimpan di GitHub Actions |

---

## 🔑 Environment Variables

Semua variabel dikonfigurasi melalui file `.env`. Salin dari `.env.example`:

```bash
cp .env.example .env
```

### Framework

| Variable | Default | Keterangan |
|---|---|---|
| `TEST_ENV` | `dev` | Environment aktif (`dev` / `staging`) |
| `BROWSER` | `chrome` | Browser yang digunakan (`chrome` / `firefox`) |
| `HEADLESS` | `false` | Jalankan browser tanpa UI (`true` / `false`) |
| `USE_GRID` | `true` | Pakai Selenium Grid (`true`) atau native browser lokal (`false`) |
| `SELENIUM_HOST` | `localhost` | Host Selenium Grid |
| `SELENIUM_PORT` | `4444` | Port Selenium Grid |
| `MAX_INSTANCES` | `2` | Jumlah instance paralel |
| `WINDOW_WIDTH` | `1920` | Lebar window browser (pixel) |
| `WINDOW_HEIGHT` | `1080` | Tinggi window browser (pixel) |
| `LOG_LEVEL` | `info` | Level log WDIO (`trace` / `debug` / `info` / `warn` / `error`) |
| `WAIT_FOR_TIMEOUT` | `10000` | Timeout element wait (ms) |
| `STEP_TIMEOUT` | `60000` | Timeout per step Cucumber (ms) |
| `TAGS` | _(kosong)_ | Filter tag Cucumber (contoh: `@smoke`, `@e2e`) |

### Jira Xray

| Variable | Keterangan |
|---|---|
| `JIRA_BASEURL` | URL base Jira (contoh: `https://jira.example.com`) |
| `JIRA_USERNAME` | Username Jira untuk Basic Auth |
| `JIRA_PASSWORD` | Password Jira untuk Basic Auth |
| `PROJECT_KEY` | Project key Jira (contoh: `PROJ`) |
| `PROJECT_TCM_KEY` | Project key TCM/Xray (bisa sama dengan `PROJECT_KEY`) |
| `PARENT_ISSUE_KEY` | Issue key parent untuk Test Case baru |
| `TEST_EXECUTION_KEY` | Key Test Execution yang sudah ada (kosongkan untuk auto-create) |
| `SUMMARY_EXECUTION` | Judul Test Execution yang akan dibuat |

---

## 📜 NPM Scripts Reference

| Script | Perintah | Keterangan |
|---|---|---|
| `test` | `npm run clean && wdio run ./wdio.conf.js` | Hapus hasil lama + jalankan semua test |
| `test:dev` | `TEST_ENV=dev npm run test` | Test di environment dev |
| `test:staging` | `TEST_ENV=staging npm run test` | Test di environment staging |
| `test:e2e` | `TAGS='@e2e' npm run test:dev` | Test dengan filter tag `@e2e` |
| `clean` | `rm -rf allure-results allure-report` | Hapus semua hasil test & report |
| `allure:generate` | `npx allure generate allure-results -o allure-report` | Generate Allure report |
| `allure:open` | `npx allure open allure-report` | Buka Allure report di browser |
| `allure:serve` | `allure serve allure-results` | Serve langsung dari hasil test |
| `result:enrich` | `node scripts/enrich-result.js` | Enrich Allure results dengan metadata |
| `upload:xray` | `npm run result:enrich && node helper/jira/index.js` | Upload hasil ke Jira Xray |
| `grid:start` | `docker compose up -d` | Start Selenium Grid (background) |
| `grid:stop` | `docker compose down` | Stop Selenium Grid |
