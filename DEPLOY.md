# KidQuest Deployment

## Production
- **Target**: Firebase Hosting (project `gen-lang-client-0281831277`)
- **Current URL**: https://gen-lang-client-0281831277.web.app
- **Canonical URL** (after DNS migration): https://kidquest.pyxora.app

## Commands

```bash
# Full deploy: build + hosting + Firestore rules + Storage rules
npm run deploy

# Hosting only (after a UI-only change)
npm run deploy:hosting

# Rules only (no rebuild)
npm run deploy:rules
```

All three scripts target the `prod` alias defined in `.firebaserc`.

## One-time: connect kidquest.pyxora.app

The production URL will move from `gen-lang-client-0281831277.web.app` to
`kidquest.pyxora.app` as a subdomain of the pyxora ecosystem. This is a
**one-time DNS + config migration**. Until every step below is complete,
the site keeps running on the firebaseapp.com URL — nothing breaks.

### Step 1 — Add custom domain in Firebase Console
1. Open https://console.firebase.google.com/project/gen-lang-client-0281831277/hosting/sites
2. Pick the `gen-lang-client-0281831277` site → **"커스텀 도메인 추가"**
3. Enter `kidquest.pyxora.app` → continue
4. Firebase will display **one of two verification options**:
   - **TXT record** (domain ownership) — usually on the apex (`pyxora.app`)
   - Then **A records** (two IPs) pointing to the subdomain
5. Leave this tab open — we need the values in step 2.

### Step 2 — Add DNS records in Cloudflare
1. Open the Cloudflare dashboard for `pyxora.app`
2. DNS → Records → Add the records Firebase gave you:
   - TXT record (if required): Name = `@` or as shown, Value = the Firebase token
   - A records: Name = `kidquest`, IPv4 = (two IPs from Firebase), **Proxy status = DNS only (grey cloud)** ⚠️
   - The grey cloud is critical — if Cloudflare proxies the record, Firebase's SSL provisioning fails.
3. Save. Back in Firebase, click "확인" — it may take a few minutes for the TXT to propagate.

### Step 3 — Wait for SSL provisioning
- Firebase issues a managed SSL cert for `kidquest.pyxora.app`
- Usually completes within 20 minutes, can take up to 24 hours
- Status shows in Firebase Console → Hosting → Domains
- Test: `curl -I https://kidquest.pyxora.app/` should return 200 with a valid cert

### Step 4 — Add the domain to Firebase Auth authorized list
1. Firebase Console → Authentication → Settings → Authorized domains
2. Add `kidquest.pyxora.app`
3. (Keep `gen-lang-client-0281831277.web.app` in the list as a fallback.)

### Step 5 — Flip `authDomain` in firebase config
Once Step 3 is green, ask Claude (or edit directly):
- [`firebase-applet-config.json`](firebase-applet-config.json): `"authDomain": "kidquest.pyxora.app"`
- Redeploy: `npm run deploy`
- **Bonus**: the Google login popup will now say
  `kidquest.pyxora.app(으)로 이동` instead of the firebaseapp.com string.

### Step 6 — Update OAuth consent screen branding
1. Google Cloud Console → Google 인증 플랫폼 → **브랜딩**
2. 앱 홈페이지 → `https://kidquest.pyxora.app/`
3. 개인정보처리방침 → `https://kidquest.pyxora.app/privacy.html`
4. 이용약관 → `https://kidquest.pyxora.app/terms.html`
5. 저장

### Step 7 — Update pyxora-site README
Already done — `D:\AI Workspaces\pyxora-site\README.md` lists
`kidquest.pyxora.app` under the subdomain ecosystem.

---

## Notes

- **Don't deploy between Step 1 and Step 5** — the current
  `gen-lang-client-0281831277.web.app` deploy keeps running and users are
  unaffected. Only redeploy once DNS + SSL is verified.
- The old URL stays active indefinitely as a secondary origin; no
  redirect is strictly required, but if desired, add a Cloudflare Page
  Rule or a static redirect from the old URL to the new one after
  migration.
- Firestore / Storage rules are deployed automatically via
  `npm run deploy`, so changes in [firestore.rules](firestore.rules)
  and [storage.rules](storage.rules) ship alongside the hosting bundle.
